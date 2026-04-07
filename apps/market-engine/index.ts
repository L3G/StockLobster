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

  // 3. Apply filters (chained)
  for (const filter of config.filters) {
    stocks = await filter.apply(stocks);
  }

  if (stocks.length === 0) {
    log("info", "No stocks matched filters — skipping notification");
    return;
  }

  // 4. Sort by trend score (descending) and cap at maxAlerts
  stocks.sort((a, b) => (b.trendScore ?? 0) - (a.trendScore ?? 0));
  stocks = stocks.slice(0, config.maxAlerts);

  // 5. Deduplicate
  stocks = dedupe.filter(stocks);

  if (stocks.length === 0) {
    log("info", "All stocks suppressed by dedupe — skipping notification");
    return;
  }

  log("info", `${stocks.length} stock(s) passed all filters — notifying`);

  // 6. Send to notifiers
  for (const notifier of config.notifiers) {
    try {
      await notifier.send(stocks);
    } catch (err) {
      log("error", `Notifier [${notifier.name}] failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

log("info", "🦞 StockLobster starting up...");
startScheduler(config, tick);
