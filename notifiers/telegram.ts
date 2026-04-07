import type { Stock, Notifier } from "../core/types.js";
import { log } from "../utils/logger.js";

export interface TelegramOptions {
  botToken?: string;
  chatId?: string;
}

function formatStock(s: Stock): string {
  const sign = s.percentChange >= 0 ? "+" : "";
  const trend = s.trendLabel ? `Trend: ${s.trendLabel}${s.trendScore != null ? ` (${s.trendScore})` : ""}` : "";
  const chart = s.chartUrl ?? `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(s.symbol)}`;

  return [
    `*${s.symbol}* ${sign}${s.percentChange.toFixed(2)}%`,
    `Price: $${s.price.toFixed(2)}`,
    `Volume: ${formatVolume(s.volume)}`,
    ...(trend ? [trend] : []),
    `Chart: ${chart}`,
  ].join("\n");
}

function formatMessage(stocks: Stock[]): string {
  return `🚨 *Momentum Candidates*\n\n${stocks.map(formatStock).join("\n\n")}`;
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toString();
}

export function createTelegramNotifier(opts: TelegramOptions = {}): Notifier {
  const botToken = opts.botToken ?? process.env.TELEGRAM_BOT_TOKEN;
  const chatId = opts.chatId ?? process.env.TELEGRAM_CHAT_ID;

  return {
    name: "telegram",

    async send(stocks: Stock[]): Promise<void> {
      if (!botToken || !chatId) {
        log("warn", "[telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID — skipping");
        return;
      }

      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const text = formatMessage(stocks);

      log("info", `[telegram] Sending alert for ${stocks.length} stocks`);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
        }),
      });

      if (!res.ok) {
        throw new Error(`Telegram responded with ${res.status}: ${res.statusText}`);
      }

      log("info", `[telegram] Alert sent successfully`);
    },
  };
}
