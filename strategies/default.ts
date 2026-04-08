import type { Strategy } from "../core/types.js";
import { createPriceFilter } from "../filters/price.js";
import { createVolumeFilter } from "../filters/volume.js";

/**
 * Default strategy: minimal filtering — price and volume gates only.
 * Useful as a starting point or when users want to define everything via env vars.
 */
export function createDefaultStrategy(opts: {
  minPrice?: number;
  maxPrice?: number;
  minVolume?: number;
} = {}): Strategy {
  return {
    name: "default",
    description: "Basic price and volume screening with no strategy-specific logic",
    filters: [
      createPriceFilter({ min: opts.minPrice ?? 1, max: opts.maxPrice }),
      createVolumeFilter({ minVolume: opts.minVolume ?? 100_000 }),
    ],
  };
}
