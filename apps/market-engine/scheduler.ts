import { log } from "../../utils/logger.js";
import { isWithinTimeWindow } from "../../utils/time.js";
import type { EngineConfig } from "../../core/types.js";

export function startScheduler(config: EngineConfig, tick: () => Promise<void>): void {
  log("info", `Scheduler started — polling every ${config.pollIntervalMs / 1000}s`);

  if (config.timeWindow) {
    log("info", `Time window: ${config.timeWindow.startHour}:00 – ${config.timeWindow.endHour}:00`);
  }

  const run = async () => {
    if (config.timeWindow) {
      const { startHour, endHour } = config.timeWindow;
      if (!isWithinTimeWindow(startHour, endHour)) {
        log("info", "Outside time window — skipping cycle");
        return;
      }
    }

    try {
      await tick();
    } catch (err) {
      log("error", `Cycle failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Run immediately on start
  void run();

  setInterval(() => void run(), config.pollIntervalMs);
}
