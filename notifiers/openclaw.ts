import type { Stock, Notifier, SignalMeta } from "../core/types.js";
import { log } from "../utils/logger.js";

export interface OpenClawOptions {
  hooksUrl?: string;
  hooksToken?: string;
  /** @deprecated Use hooksUrl */
  gatewayUrl?: string;
  /** @deprecated Use hooksToken */
  apiKey?: string;
}

export function createOpenClawNotifier(opts: OpenClawOptions = {}): Notifier {
  const hooksUrl =
    opts.hooksUrl ??
    opts.gatewayUrl ??
    process.env.OPENCLAW_HOOKS_URL ??
    process.env.OPENCLAW_GATEWAY_URL ??
    "http://127.0.0.1:18789/hooks/stocklobster";

  const hooksToken =
    opts.hooksToken ??
    opts.apiKey ??
    process.env.OPENCLAW_HOOKS_TOKEN ??
    process.env.OPENCLAW_API_KEY;

  return {
    name: "openclaw",

    async send(stocks: Stock[], meta?: SignalMeta): Promise<void> {
      const strategy = meta?.strategy ?? "unknown";
      const now = new Date().toISOString();

      log("info", `[openclaw] Sending ${stocks.length} signal(s) to ${hooksUrl}`);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (hooksToken) {
        headers["Authorization"] = `Bearer ${hooksToken}`;
      }

      const results = await Promise.allSettled(
        stocks.map((s) => {
          const payload = {
            source: "stocklobster",
            event: "screen_hit",
            symbol: s.symbol,
            message: `${s.symbol} hit ${strategy} criteria`,
            timestamp: now,
            data: {
              price: s.price,
              changePct: s.percentChange,
              volume: s.volume,
              strategy,
            },
          };

          return fetch(hooksUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
          }).then(async (res) => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status} for ${s.symbol}`);
            }
            return s.symbol;
          });
        })
      );

      let succeeded = 0;
      for (const result of results) {
        if (result.status === "fulfilled") {
          succeeded++;
        } else {
          log("error", `[openclaw] Failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
        }
      }

      log("info", `[openclaw] Delivered ${succeeded}/${stocks.length} signal(s)`);
    },
  };
}
