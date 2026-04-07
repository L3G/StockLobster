import type { Stock } from "../core/types.js";
import { log } from "./logger.js";

export function createDeduplicator(cooldownMs: number) {
  const lastAlerted = new Map<string, number>();

  return {
    filter(stocks: Stock[]): Stock[] {
      const now = Date.now();
      const passed: Stock[] = [];
      const suppressed: string[] = [];

      for (const stock of stocks) {
        const last = lastAlerted.get(stock.symbol);
        if (last && now - last < cooldownMs) {
          suppressed.push(stock.symbol);
          continue;
        }
        passed.push(stock);
      }

      if (suppressed.length > 0) {
        log("info", `[dedupe] Suppressed ${suppressed.length} duplicate(s): ${suppressed.join(", ")}`);
      }

      // Mark passed symbols as alerted
      for (const stock of passed) {
        lastAlerted.set(stock.symbol, now);
      }

      // Prune entries older than 2x cooldown to prevent unbounded growth
      for (const [symbol, ts] of lastAlerted) {
        if (now - ts > cooldownMs * 2) {
          lastAlerted.delete(symbol);
        }
      }

      return passed;
    },
  };
}
