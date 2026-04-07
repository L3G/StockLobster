import type { Stock } from "./types.js";
import type { YahooGainersResponse } from "./fetch.js";

export function normalizeYahooGainers(raw: YahooGainersResponse): Stock[] {
  const quotes = raw?.finance?.result?.[0]?.quotes;
  if (!quotes || !Array.isArray(quotes)) {
    return [];
  }

  const now = Date.now();

  return quotes
    .filter((q) => q.symbol && typeof q.regularMarketPrice === "number")
    .map((q) => ({
      symbol: q.symbol,
      price: q.regularMarketPrice,
      percentChange: q.regularMarketChangePercent ?? 0,
      volume: q.regularMarketVolume ?? 0,
      avgVolume: q.averageDailyVolume3Month,
      timestamp: now,
    }));
}
