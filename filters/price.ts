import type { Stock, StockFilter } from "../core/types.js";
import { log } from "../utils/logger.js";

export interface PriceFilterOptions {
  min?: number;
  max?: number;
}

export function createPriceFilter(opts: PriceFilterOptions = {}): StockFilter {
  const min = opts.min ?? 0;
  const max = opts.max ?? Infinity;

  return {
    name: "price",

    async apply(stocks: Stock[]): Promise<Stock[]> {
      const filtered = stocks.filter((s) => s.price >= min && s.price <= max);
      log("info", `[price] ${filtered.length}/${stocks.length} stocks in range $${min}–$${max === Infinity ? "∞" : max}`);
      return filtered;
    },
  };
}
