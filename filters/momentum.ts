import type { Stock, StockFilter } from "../core/types.js";
import { log } from "../utils/logger.js";

export interface MomentumFilterOptions {
  minPrice?: number;
  minPercentChange?: number;
  maxPercentChange?: number;
  minVolume?: number;
}

const DEFAULTS: Required<MomentumFilterOptions> = {
  minPrice: 10,
  minPercentChange: 2,
  maxPercentChange: 6,
  minVolume: 1_000_000,
};

export function createMomentumFilter(opts: MomentumFilterOptions = {}): StockFilter {
  const config = { ...DEFAULTS, ...opts };

  return {
    name: "momentum",

    async apply(stocks: Stock[]): Promise<Stock[]> {
      const filtered = stocks.filter(
        (s) =>
          s.price > config.minPrice &&
          s.percentChange >= config.minPercentChange &&
          s.percentChange <= config.maxPercentChange &&
          s.volume > config.minVolume
      );

      log("info", `[momentum] ${filtered.length}/${stocks.length} stocks passed filter`);
      return filtered;
    },
  };
}
