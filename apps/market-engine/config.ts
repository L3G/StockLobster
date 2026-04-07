import type { EngineConfig, DataSource } from "../../core/types.js";
import { fetchYahooGainers } from "../../core/fetch.js";
import { normalizeYahooGainers } from "../../core/normalize.js";
import { createMomentumFilter } from "../../filters/momentum.js";
import { createTrendFilter } from "../../filters/trend.js";
import { createOpenClawNotifier } from "../../notifiers/openclaw.js";
import { createTelegramNotifier } from "../../notifiers/telegram.js";

const yahooGainersSource: DataSource = {
  name: "yahoo-gainers",
  fetch: fetchYahooGainers,
  normalize: normalizeYahooGainers,
};

export function loadConfig(): EngineConfig {
  const trendEnabled = process.env.TREND_FILTER_ENABLED !== "false"; // on by default

  return {
    dataSource: yahooGainersSource,
    filters: [
      createMomentumFilter(),
      ...(trendEnabled
        ? [createTrendFilter({
            weakThreshold: Number(process.env.TREND_WEAK_THRESHOLD) || undefined,
            strongThreshold: Number(process.env.TREND_STRONG_THRESHOLD) || undefined,
            recentWindowSize: Number(process.env.RECENT_WINDOW_SIZE) || undefined,
            accelerationWeight: Number(process.env.ACCELERATION_WEIGHT) || undefined,
            recentWeightMultiplier: Number(process.env.RECENT_WEIGHT_MULTIPLIER) || undefined,
          })]
        : []),
    ],
    notifiers: [
      createOpenClawNotifier(),
      ...(process.env.TELEGRAM_BOT_TOKEN ? [createTelegramNotifier()] : []),
    ],
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 5 * 60 * 1000,
    dedupeCooldownMs: Number(process.env.DEDUPE_COOLDOWN_MS) || 15 * 60 * 1000, // 15 minutes
    maxAlerts: Number(process.env.MAX_ALERTS) || 5,
    timeWindow: process.env.TIME_WINDOW_START && process.env.TIME_WINDOW_END
      ? {
          startHour: Number(process.env.TIME_WINDOW_START),
          endHour: Number(process.env.TIME_WINDOW_END),
        }
      : undefined,
  };
}
