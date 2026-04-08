import type { Stock, StockFilter } from "../core/types.js";
import { log } from "../utils/logger.js";

export interface PercentChangeFilterOptions {
  min?: number;
  max?: number;
}

export function createPercentChangeFilter(opts: PercentChangeFilterOptions = {}): StockFilter {
  const min = opts.min ?? -Infinity;
  const max = opts.max ?? Infinity;

  return {
    name: "percent-change",

    async apply(stocks: Stock[]): Promise<Stock[]> {
      const filtered = stocks.filter((s) => s.percentChange >= min && s.percentChange <= max);
      const minLabel = min === -Infinity ? "-∞" : `${min}%`;
      const maxLabel = max === Infinity ? "∞" : `${max}%`;
      log("info", `[percent-change] ${filtered.length}/${stocks.length} stocks in range ${minLabel}–${maxLabel}`);
      return filtered;
    },
  };
}
