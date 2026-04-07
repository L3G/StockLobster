import { loadConfig } from "./config.js";
import { startScheduler } from "./scheduler.js";
import { log } from "../../utils/logger.js";
import type { Stock } from "../../core/types.js";

const config = loadConfig();

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

  log("info", `${stocks.length} stock(s) passed all filters — notifying`);

  // 4. Send to notifiers
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
