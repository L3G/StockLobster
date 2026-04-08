import type { Strategy } from "../core/types.js";
import { createPriceFilter } from "../filters/price.js";
import { createVolumeFilter } from "../filters/volume.js";
import { createPercentChangeFilter } from "../filters/percent-change.js";
import { createTrendFilter } from "../filters/trend.js";

export interface MomentumStrategyOptions {
  minPrice?: number;
  maxPrice?: number;
  minPercentChange?: number;
  maxPercentChange?: number;
  minVolume?: number;
  minRelativeVolume?: number;
  trendEnabled?: boolean;
  trendWeakThreshold?: number;
  trendStrongThreshold?: number;
  recentWindowSize?: number;
  accelerationWeight?: number;
  recentWeightMultiplier?: number;
  chartInterval?: string;
  chartRange?: string;
}

export function createMomentumStrategy(opts: MomentumStrategyOptions = {}): Strategy {
  return {
    name: "momentum",
    description: "Screens for stocks with strong price movement, high volume, and clean upward trend",
    filters: [
      createPriceFilter({
        min: opts.minPrice,
        max: opts.maxPrice,
      }),
      createVolumeFilter({
        minVolume: opts.minVolume,
        minRelativeVolume: opts.minRelativeVolume,
      }),
      createPercentChangeFilter({
        min: opts.minPercentChange,
        max: opts.maxPercentChange,
      }),
      ...(opts.trendEnabled !== false
        ? [createTrendFilter({
            weakThreshold: opts.trendWeakThreshold,
            strongThreshold: opts.trendStrongThreshold,
            recentWindowSize: opts.recentWindowSize,
            accelerationWeight: opts.accelerationWeight,
            recentWeightMultiplier: opts.recentWeightMultiplier,
            interval: opts.chartInterval,
            range: opts.chartRange,
          })]
        : []),
    ],
  };
}
