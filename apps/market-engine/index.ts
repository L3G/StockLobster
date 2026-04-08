import { loadConfig } from "./config.js";
import { startScheduler } from "./scheduler.js";
import { log } from "../../utils/logger.js";
import { createDeduplicator } from "../../utils/dedupe.js";
import type { Stock } from "../../core/types.js";

const config = loadConfig();
const dedupe = createDeduplicator(config.dedupeCooldownMs);

async function tick(): Promise<void> {
  // 1. Fetch raw data
  const raw = await config.dataSource.fetch();

  // 2. Normalize
  let stocks: Stock[] = config.dataSource.normalize(raw);
  log("info", `Normalized ${stocks.length} stocks`);

  // 3. Apply strategy filters (chained)
  for (const filter of config.strategy.filters) {
    stocks = await filter.apply(stocks);
  }

  if (stocks.length === 0) {
    log("info", "No stocks matched filters — skipping notification");
    return;
  }

  // 4. Sort: scored stocks first (by trendScore desc, then acceleration desc),
  //    then unscored stocks (by percentChange desc)
  stocks.sort((a, b) => {
    const aHasScore = a.trendScore != null;
    const bHasScore = b.trendScore != null;

    // Scored stocks always rank above unscored
    if (aHasScore !== bHasScore) return aHasScore ? -1 : 1;

    if (aHasScore && bHasScore) {
      const scoreDiff = b.trendScore! - a.trendScore!;
      if (scoreDiff !== 0) return scoreDiff;
      return (b.acceleration ?? 0) - (a.acceleration ?? 0);
    }

    // Both unscored — sort by percentChange
    return (b.percentChange ?? 0) - (a.percentChange ?? 0);
  });
  stocks = stocks.slice(0, config.maxAlerts);

  // 5. Deduplicate
  stocks = dedupe.filter(stocks);

  if (stocks.length === 0) {
    log("info", "All stocks suppressed by dedupe — skipping notification");
    return;
  }

  log("info", `${stocks.length} stock(s) passed all filters — notifying`);

  // 6. Send to notifiers
  const meta = { strategy: config.strategy.name, count: stocks.length };
  for (const notifier of config.notifiers) {
    try {
      await notifier.send(stocks, meta);
    } catch (err) {
      log("error", `Notifier [${notifier.name}] failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

log("info", "🦞 StockLobster starting up...");
startScheduler(config, tick);
