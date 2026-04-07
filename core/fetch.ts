import { log } from "../utils/logger.js";

const YAHOO_GAINERS_URL =
  "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=100";

export interface YahooGainersResponse {
  finance: {
    result: Array<{
      quotes: Array<{
        symbol: string;
        regularMarketPrice: number;
        regularMarketChangePercent: number;
        regularMarketVolume: number;
        averageDailyVolume3Month?: number;
      }>;
    }>;
  };
}

export async function fetchYahooGainers(): Promise<YahooGainersResponse> {
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0",
  };

  const crumb = process.env.YAHOO_CRUMB;
  const cookie = process.env.YAHOO_COOKIE;

  let url = YAHOO_GAINERS_URL;
  if (crumb) {
    url += `&crumb=${encodeURIComponent(crumb)}`;
  }
  if (cookie) {
    headers["Cookie"] = cookie;
  }

  log("info", "Fetching data from Yahoo Finance gainers...");

  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`Yahoo Finance responded with ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as YahooGainersResponse;
  const quoteCount = data?.finance?.result?.[0]?.quotes?.length ?? 0;
  log("info", `Fetched ${quoteCount} quotes from Yahoo Finance`);

  return data;
}
