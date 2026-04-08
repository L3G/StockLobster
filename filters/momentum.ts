import type { Stock, StockFilter } from "../core/types.js";
import { log } from "../utils/logger.js";
import { createPriceFilter } from "./price.js";
import { createVolumeFilter } from "./volume.js";
import { createPercentChangeFilter } from "./percent-change.js";

export interface MomentumFilterOptions {
  minPrice?: number;
  maxPrice?: number;
  minPercentChange?: number;
  maxPercentChange?: number;
  minVolume?: number;
  minRelativeVolume?: number;
}

/**
 * Convenience filter that composes price + volume + percent-change filters.
 * All thresholds are configurable — no hardcoded strategy assumptions.
 */
export function createMomentumFilter(opts: MomentumFilterOptions = {}): StockFilter {
  const chain: StockFilter[] = [
    createPriceFilter({ min: opts.minPrice, max: opts.maxPrice }),
    createVolumeFilter({ minVolume: opts.minVolume, minRelativeVolume: opts.minRelativeVolume }),
    createPercentChangeFilter({ min: opts.minPercentChange, max: opts.maxPercentChange }),
  ];

  return {
    name: "momentum",

    async apply(stocks: Stock[]): Promise<Stock[]> {
      let result = stocks;
      for (const filter of chain) {
        result = await filter.apply(result);
      }
      log("info", `[momentum] ${result.length}/${stocks.length} stocks passed composite filter`);
      return result;
    },
  };
}
