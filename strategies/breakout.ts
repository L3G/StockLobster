import type { Strategy } from "../core/types.js";
import { createPriceFilter } from "../filters/price.js";
import { createVolumeFilter } from "../filters/volume.js";
import { createPercentChangeFilter } from "../filters/percent-change.js";
import { createTrendFilter } from "../filters/trend.js";

export interface BreakoutStrategyOptions {
  minPrice?: number;
  maxPrice?: number;
  minPercentChange?: number;
  minVolume?: number;
  minRelativeVolume?: number;
  trendEnabled?: boolean;
  trendWeakThreshold?: number;
  trendStrongThreshold?: number;
  chartInterval?: string;
  chartRange?: string;
}

/**
 * Breakout strategy: higher percent-change floor and heavier volume
 * requirement to catch stocks breaking out of ranges.
 */
export function createBreakoutStrategy(opts: BreakoutStrategyOptions = {}): Strategy {
  return {
    name: "breakout",
    description: "Screens for high-volume breakouts with strong percent moves and clean trend",
    filters: [
      createPriceFilter({
        min: opts.minPrice ?? 5,
        max: opts.maxPrice,
      }),
      createVolumeFilter({
        minVolume: opts.minVolume ?? 500_000,
        minRelativeVolume: opts.minRelativeVolume ?? 2.0,
      }),
      createPercentChangeFilter({
        min: opts.minPercentChange ?? 5,
      }),
      ...(opts.trendEnabled !== false
        ? [createTrendFilter({
            weakThreshold: opts.trendWeakThreshold ?? 35,
            strongThreshold: opts.trendStrongThreshold ?? 60,
            interval: opts.chartInterval,
            range: opts.chartRange,
          })]
        : []),
    ],
  };
}
