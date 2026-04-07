import type { Stock, StockFilter, TrendLabel } from "../core/types.js";
import { log } from "../utils/logger.js";

export interface TrendFilterOptions {
  /** Minimum score to qualify as weak_uptrend (0–100) */
  weakThreshold?: number;
  /** Minimum score to qualify as strong_uptrend (0–100) */
  strongThreshold?: number;
  /** Number of recent 5m bars to analyze */
  barCount?: number;
  /** Yahoo chart interval */
  interval?: string;
  /** Yahoo chart range */
  range?: string;
}

const DEFAULTS: Required<TrendFilterOptions> = {
  weakThreshold: 40,
  strongThreshold: 65,
  barCount: 24, // ~2 hours of 5m bars
  interval: "5m",
  range: "1d",
};

interface Bar {
  close: number;
  high: number;
  low: number;
}

// --- Exported helpers (unit-test-friendly) ---

export function computeSlope(closes: number[]): number {
  if (closes.length < 2) return 0;
  const n = closes.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += closes[i];
    sumXY += i * closes[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  const slope = (n * sumXY - sumX * sumY) / denom;
  // Normalize to percent of mean price
  const mean = sumY / n;
  return mean === 0 ? 0 : (slope / mean) * 100;
}

export function countHigherHighs(bars: Bar[]): number {
  let count = 0;
  for (let i = 1; i < bars.length; i++) {
    if (bars[i].high > bars[i - 1].high) count++;
  }
  return count;
}

export function countHigherLows(bars: Bar[]): number {
  let count = 0;
  for (let i = 1; i < bars.length; i++) {
    if (bars[i].low > bars[i - 1].low) count++;
  }
  return count;
}

export function countReversals(closes: number[], threshold: number = 0.003): number {
  if (closes.length < 3) return 0;
  let reversals = 0;
  for (let i = 2; i < closes.length; i++) {
    const prev = (closes[i - 1] - closes[i - 2]) / closes[i - 2];
    const curr = (closes[i] - closes[i - 1]) / closes[i - 1];
    if (Math.abs(prev) > threshold && Math.abs(curr) > threshold && Math.sign(prev) !== Math.sign(curr)) {
      reversals++;
    }
  }
  return reversals;
}

export function nearRecentHigh(closes: number[]): number {
  if (closes.length === 0) return 0;
  const recent = closes[closes.length - 1];
  const high = Math.max(...closes);
  return high === 0 ? 0 : recent / high;
}

export function scoreTrend(bars: Bar[]): number {
  if (bars.length < 3) return 0;

  const closes = bars.map((b) => b.close);
  const n = bars.length - 1; // max possible count for higher-high/low

  // Component scores (each 0–100)
  const slope = computeSlope(closes);
  const slopeScore = Math.min(Math.max(slope * 20, 0), 100); // positive slope → higher score

  const hhRatio = n > 0 ? countHigherHighs(bars) / n : 0;
  const hhScore = hhRatio * 100;

  const hlRatio = n > 0 ? countHigherLows(bars) / n : 0;
  const hlScore = hlRatio * 100;

  const maxReversals = Math.max(bars.length - 2, 1);
  const revRatio = countReversals(closes) / maxReversals;
  const revScore = (1 - revRatio) * 100; // fewer reversals → higher score

  const nearHigh = nearRecentHigh(closes);
  const nearHighScore = nearHigh * 100;

  // Weighted composite
  const score =
    slopeScore * 0.30 +
    hhScore * 0.20 +
    hlScore * 0.20 +
    revScore * 0.15 +
    nearHighScore * 0.15;

  return Math.round(score);
}

export function classifyTrend(score: number, weakThreshold: number, strongThreshold: number): TrendLabel {
  if (score >= strongThreshold) return "strong_uptrend";
  if (score >= weakThreshold) return "weak_uptrend";
  return "choppy";
}

// --- Chart data fetching ---

async function fetchIntradayBars(symbol: string, interval: string, range: string, barCount: number): Promise<Bar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;

  const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0" };
  const crumb = process.env.YAHOO_CRUMB;
  const cookie = process.env.YAHOO_COOKIE;
  if (cookie) headers["Cookie"] = cookie;

  let fullUrl = url;
  if (crumb) fullUrl += `&crumb=${encodeURIComponent(crumb)}`;

  const res = await fetch(fullUrl, { headers });
  if (!res.ok) {
    throw new Error(`Yahoo chart API ${res.status} for ${symbol}`);
  }

  const data = await res.json() as {
    chart: {
      result: Array<{
        indicators: {
          quote: Array<{
            close: (number | null)[];
            high: (number | null)[];
            low: (number | null)[];
          }>;
        };
      }>;
    };
  };

  const result = data?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!quote) return [];

  const closes = quote.close ?? [];
  const highs = quote.high ?? [];
  const lows = quote.low ?? [];

  const bars: Bar[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (closes[i] != null && highs[i] != null && lows[i] != null) {
      bars.push({ close: closes[i]!, high: highs[i]!, low: lows[i]! });
    }
  }

  // Take only the most recent N bars
  return bars.slice(-barCount);
}

// --- Filter factory ---

export function createTrendFilter(opts: TrendFilterOptions = {}): StockFilter {
  const config = { ...DEFAULTS, ...opts };

  return {
    name: "trend",

    async apply(stocks: Stock[]): Promise<Stock[]> {
      const results: Stock[] = [];

      for (const stock of stocks) {
        try {
          const bars = await fetchIntradayBars(stock.symbol, config.interval, config.range, config.barCount);

          if (bars.length < 3) {
            log("warn", `[trend] ${stock.symbol}: insufficient bars (${bars.length}) — skipping`);
            continue;
          }

          const score = scoreTrend(bars);
          const label = classifyTrend(score, config.weakThreshold, config.strongThreshold);

          log("info", `[trend] ${stock.symbol}: ${label} (score=${score})`);

          if (label === "choppy") continue;

          results.push({
            ...stock,
            trendLabel: label,
            trendScore: score,
            chartUrl: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(stock.symbol)}`,
          });
        } catch (err) {
          log("error", `[trend] ${stock.symbol}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      log("info", `[trend] ${results.length}/${stocks.length} stocks passed filter`);
      return results;
    },
  };
}
