import type { EngineConfig, DataSource } from "../../core/types.js";
import { fetchYahooGainers } from "../../core/fetch.js";
import { normalizeYahooGainers } from "../../core/normalize.js";
import { createMomentumFilter } from "../../filters/momentum.js";
import { createOpenClawNotifier } from "../../notifiers/openclaw.js";
import { createTelegramNotifier } from "../../notifiers/telegram.js";

const yahooGainersSource: DataSource = {
  name: "yahoo-gainers",
  fetch: fetchYahooGainers,
  normalize: normalizeYahooGainers,
};

export function loadConfig(): EngineConfig {
  return {
    dataSource: yahooGainersSource,
    filters: [
      createMomentumFilter(),
    ],
    notifiers: [
      createOpenClawNotifier(),
      ...(process.env.TELEGRAM_BOT_TOKEN ? [createTelegramNotifier()] : []),
    ],
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 5 * 60 * 1000, // 5 minutes
    timeWindow: process.env.TIME_WINDOW_START && process.env.TIME_WINDOW_END
      ? {
          startHour: Number(process.env.TIME_WINDOW_START),
          endHour: Number(process.env.TIME_WINDOW_END),
        }
      : undefined,
  };
}
