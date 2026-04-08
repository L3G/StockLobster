import type { EngineConfig, DataSource, Strategy } from "../../core/types.js";
import { fetchYahooGainers } from "../../core/fetch.js";
import { normalizeYahooGainers } from "../../core/normalize.js";
import { createMomentumStrategy } from "../../strategies/momentum.js";
import { createBreakoutStrategy } from "../../strategies/breakout.js";
import { createDefaultStrategy } from "../../strategies/default.js";
import { createOpenClawNotifier } from "../../notifiers/openclaw.js";
import { log } from "../../utils/logger.js";

const yahooGainersSource: DataSource = {
  name: "yahoo-gainers",
  fetch: fetchYahooGainers,
  normalize: normalizeYahooGainers,
};

function envNum(key: string): number | undefined {
  const v = process.env[key];
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function loadStrategy(): Strategy {
  const name = (process.env.STRATEGY ?? "momentum").toLowerCase();

  switch (name) {
    case "momentum":
      return createMomentumStrategy({
        minPrice: envNum("MIN_PRICE"),
        maxPrice: envNum("MAX_PRICE"),
        minPercentChange: envNum("MIN_PERCENT_CHANGE"),
        maxPercentChange: envNum("MAX_PERCENT_CHANGE"),
        minVolume: envNum("MIN_VOLUME"),
        minRelativeVolume: envNum("REL_VOLUME"),
        trendEnabled: process.env.TREND_FILTER_ENABLED !== "false",
        trendWeakThreshold: envNum("TREND_WEAK_THRESHOLD"),
        trendStrongThreshold: envNum("TREND_STRONG_THRESHOLD"),
        recentWindowSize: envNum("RECENT_WINDOW_SIZE"),
        accelerationWeight: envNum("ACCELERATION_WEIGHT"),
        recentWeightMultiplier: envNum("RECENT_WEIGHT_MULTIPLIER"),
        chartInterval: process.env.CHART_INTERVAL,
        chartRange: process.env.CHART_RANGE,
      });

    case "breakout":
      return createBreakoutStrategy({
        minPrice: envNum("MIN_PRICE"),
        maxPrice: envNum("MAX_PRICE"),
        minPercentChange: envNum("MIN_PERCENT_CHANGE"),
        minVolume: envNum("MIN_VOLUME"),
        minRelativeVolume: envNum("REL_VOLUME"),
        trendEnabled: process.env.TREND_FILTER_ENABLED !== "false",
        trendWeakThreshold: envNum("TREND_WEAK_THRESHOLD"),
        trendStrongThreshold: envNum("TREND_STRONG_THRESHOLD"),
        chartInterval: process.env.CHART_INTERVAL,
        chartRange: process.env.CHART_RANGE,
      });

    case "default":
      return createDefaultStrategy({
        minPrice: envNum("MIN_PRICE"),
        maxPrice: envNum("MAX_PRICE"),
        minVolume: envNum("MIN_VOLUME"),
      });

    default:
      log("warn", `Unknown strategy "${name}" — falling back to default`);
      return createDefaultStrategy({
        minPrice: envNum("MIN_PRICE"),
        maxPrice: envNum("MAX_PRICE"),
        minVolume: envNum("MIN_VOLUME"),
      });
  }
}

export function loadConfig(): EngineConfig {
  const strategy = loadStrategy();
  log("info", `Strategy: ${strategy.name}${strategy.description ? ` — ${strategy.description}` : ""}`);

  return {
    dataSource: yahooGainersSource,
    strategy,
    notifiers: [
      createOpenClawNotifier(),
    ],
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 5 * 60 * 1000,
    dedupeCooldownMs: Number(process.env.DEDUPE_COOLDOWN_MS) || 15 * 60 * 1000,
    maxAlerts: Number(process.env.MAX_ALERTS) || 5,
    timeWindow: process.env.TIME_WINDOW_START && process.env.TIME_WINDOW_END
      ? {
          startHour: Number(process.env.TIME_WINDOW_START),
          endHour: Number(process.env.TIME_WINDOW_END),
        }
      : undefined,
  };
}
