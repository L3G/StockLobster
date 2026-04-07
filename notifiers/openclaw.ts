import type { Stock, Notifier } from "../core/types.js";
import { log } from "../utils/logger.js";

export interface OpenClawOptions {
  gatewayUrl?: string;
  apiKey?: string;
}

export function createOpenClawNotifier(opts: OpenClawOptions = {}): Notifier {
  const gatewayUrl = opts.gatewayUrl ?? process.env.OPENCLAW_GATEWAY_URL ?? "http://localhost:3000/api/ingest";
  const apiKey = opts.apiKey ?? process.env.OPENCLAW_API_KEY;

  return {
    name: "openclaw",

    async send(stocks: Stock[]): Promise<void> {
      const payload = {
        source: "stocklobster",
        timestamp: Date.now(),
        signals: stocks.map((s) => ({
          symbol: s.symbol,
          price: s.price,
          percentChange: s.percentChange,
          volume: s.volume,
          avgVolume: s.avgVolume,
          timestamp: s.timestamp,
        })),
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      log("info", `[openclaw] Sending ${stocks.length} signals to ${gatewayUrl}`);

      const res = await fetch(gatewayUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`OpenClaw responded with ${res.status}: ${res.statusText}`);
      }

      log("info", `[openclaw] Successfully delivered ${stocks.length} signals`);
    },
  };
}
