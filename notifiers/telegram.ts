import type { Stock, Notifier } from "../core/types.js";
import { log } from "../utils/logger.js";

export interface TelegramOptions {
  botToken?: string;
  chatId?: string;
}

function formatMessage(stocks: Stock[]): string {
  const lines = stocks.map(
    (s) =>
      `*${s.symbol}* — $${s.price.toFixed(2)} (${s.percentChange >= 0 ? "+" : ""}${s.percentChange.toFixed(2)}%) | Vol: ${formatVolume(s.volume)}`
  );
  return `🦞 *StockLobster Alert*\n${stocks.length} signal(s) detected:\n\n${lines.join("\n")}`;
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
