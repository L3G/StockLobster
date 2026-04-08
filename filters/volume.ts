import type { Stock, StockFilter } from "../core/types.js";
import { log } from "../utils/logger.js";

export interface VolumeFilterOptions {
  minVolume?: number;
  minRelativeVolume?: number;
}

export function createVolumeFilter(opts: VolumeFilterOptions = {}): StockFilter {
  const minVol = opts.minVolume ?? 0;
  const minRelVol = opts.minRelativeVolume;

  return {
    name: "volume",

    async apply(stocks: Stock[]): Promise<Stock[]> {
      const filtered = stocks.filter((s) => {
        if (s.volume < minVol) return false;
        if (minRelVol != null && s.avgVolume && s.avgVolume > 0) {
          if (s.volume / s.avgVolume < minRelVol) return false;
        }
        return true;
      });

      log("info", `[volume] ${filtered.length}/${stocks.length} stocks passed (min=${minVol}${minRelVol ? `, relVol>=${minRelVol}x` : ""})`);
      return filtered;
    },
  };
}
