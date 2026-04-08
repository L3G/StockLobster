import type { Stock, Notifier, SignalMeta } from "../core/types.js";
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

    async send(stocks: Stock[], meta?: SignalMeta): Promise<void> {
      const payload = {
        type: "signal_batch",
        strategy: meta?.strategy ?? "unknown",
        timestamp: Date.now(),
        meta: {
          count: stocks.length,
        },
        signals: stocks.map((s) => ({
          symbol: s.symbol,
          price: s.price,
          percentChange: s.percentChange,
          volume: s.volume,
          trendLabel: s.trendLabel,
          trendScore: s.trendScore,
          acceleration: s.acceleration,
          chartUrl: s.chartUrl ?? `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(s.symbol)}`,
        })),
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      log("info", `[openclaw] Sending ${stocks.length} signal(s) to ${gatewayUrl} (strategy=${meta?.strategy ?? "unknown"})`);

      const res = await fetch(gatewayUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        log("error", `[openclaw] HTTP ${res.status} ${res.statusText} from ${gatewayUrl}`);
        throw new Error(`OpenClaw responded with ${res.status}: ${res.statusText}`);
      }

      log("info", `[openclaw] Delivered ${stocks.length} signal(s) — HTTP ${res.status}`);
    },
  };
}
