import type { Stock, StockFilter, TrendLabel } from "../core/types.js";
import { log } from "../utils/logger.js";

export interface TrendFilterOptions {
  /** Minimum score to qualify as weak_uptrend (0–100) */
  weakThreshold?: number;
  /** Minimum score to qualify as strong_uptrend (0–100) */
  strongThreshold?: number;
  /** Total number of recent 5m bars to fetch */
  barCount?: number;
  /** Number of bars in the recent window (last N bars) */
  recentWindowSize?: number;
  /** Weight multiplier for recent-window metrics vs overall */
  recentWeightMultiplier?: number;
  /** Weight for acceleration bonus in scoring (0–1) */
  accelerationWeight?: number;
  /** Yahoo chart interval */
  interval?: string;
  /** Yahoo chart range */
  range?: string;
}

const DEFAULTS: Required<TrendFilterOptions> = {
  weakThreshold: 40,
  strongThreshold: 65,
  barCount: 24,            // ~2 hours of 5m bars
  recentWindowSize: 8,     // ~40 minutes of 5m bars
  recentWeightMultiplier: 1.5,
  accelerationWeight: 0.10,
  interval: "5m",
  range: "1d",
};

export interface Bar {
  close: number;
  high: number;
  low: number;
}

export interface TrendMetrics {
  slope: number;
  hhRatio: number;
  hlRatio: number;
  revRatio: number;
  nearHigh: number;
}

export interface TrendAnalysis {
  overall: TrendMetrics;
  recent: TrendMetrics;
  acceleration: number;
  score: number;
  label: TrendLabel;
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

/** Compute all trend metrics for a set of bars. */
export function computeMetrics(bars: Bar[]): TrendMetrics {
  const closes = bars.map((b) => b.close);
  const n = Math.max(bars.length - 1, 1);
  const maxRev = Math.max(bars.length - 2, 1);

  return {
    slope: computeSlope(closes),
    hhRatio: countHigherHighs(bars) / n,
    hlRatio: countHigherLows(bars) / n,
    revRatio: countReversals(closes) / maxRev,
    nearHigh: nearRecentHigh(closes),
  };
}

/**
 * Score a trend using both overall and recent-window metrics.
 *
 * Weights (default, before acceleration):
 *   overall slope:     15%
 *   recent slope:      20%
 *   overall HH/HL:     10% (5% each)
 *   recent HH/HL:      15% (7.5% each)
 *   overall reversals: 10% (penalty)
 *   recent reversals:  10% (penalty, weighted heavier per bar)
 *   near high (full):  10%
 *   acceleration:      10% (bonus/penalty)
 *
 * All component scores are 0–100 before weighting.
 * Final score is clamped to 0–100.
 */
export function scoreTrendWithAcceleration(
  overall: TrendMetrics,
  recent: TrendMetrics,
  acceleration: number,
  accelerationWeight: number,
  recentMultiplier: number,
): number {
  // Convert raw metrics to 0–100 component scores
  const toSlopeScore = (s: number) => Math.min(Math.max(s * 20, 0), 100);

  const overallSlopeScore = toSlopeScore(overall.slope);
  const recentSlopeScore = toSlopeScore(recent.slope * recentMultiplier);

  const overallHHScore = overall.hhRatio * 100;
  const overallHLScore = overall.hlRatio * 100;
  const recentHHScore = recent.hhRatio * 100;
  const recentHLScore = recent.hlRatio * 100;

  const overallRevScore = (1 - overall.revRatio) * 100;
  const recentRevScore = (1 - recent.revRatio) * 100;

  const nearHighScore = overall.nearHigh * 100;

  // Acceleration: positive = strengthening, scale to 0–100 centered at 50
  const accelScore = Math.min(Math.max(50 + acceleration * 30, 0), 100);

  // Remaining weight after acceleration
  const baseWeight = 1 - accelerationWeight;

  const base =
    overallSlopeScore * 0.15 +
    recentSlopeScore * 0.20 +
    overallHHScore * 0.05 +
    overallHLScore * 0.05 +
    recentHHScore * 0.075 +
    recentHLScore * 0.075 +
    overallRevScore * 0.10 +
    recentRevScore * 0.10 +
    nearHighScore * 0.10;

  const score = base * baseWeight + accelScore * accelerationWeight;
  return Math.round(Math.min(Math.max(score, 0), 100));
}

/**
 * Classify trend using score AND acceleration.
 * - strong_uptrend: high score AND acceleration >= -0.5
 * - weak_uptrend: moderate score OR acceleration slightly negative
 * - choppy: low score OR very high recent reversal ratio
 */
export function classifyTrend(
  score: number,
  acceleration: number,
  recentRevRatio: number,
  weakThreshold: number,
  strongThreshold: number,
): TrendLabel {
  // High reversal in recent window → choppy regardless of score
  if (recentRevRatio > 0.6) return "choppy";

  if (score >= strongThreshold && acceleration >= -0.5) return "strong_uptrend";
  if (score >= weakThreshold) return "weak_uptrend";
  return "choppy";
}

/**
 * Full trend analysis: splits bars into overall + recent, computes
 * metrics, acceleration, score, and classification.
 */
export function analyzeTrend(
  bars: Bar[],
  recentWindowSize: number,
  opts: {
    weakThreshold: number;
    strongThreshold: number;
    accelerationWeight: number;
    recentWeightMultiplier: number;
  },
): TrendAnalysis {
  const overall = computeMetrics(bars);

  const recentBars = bars.slice(-recentWindowSize);
  const recent = computeMetrics(recentBars);

  const acceleration = recent.slope - overall.slope;

  const score = scoreTrendWithAcceleration(
    overall,
    recent,
    acceleration,
    opts.accelerationWeight,
    opts.recentWeightMultiplier,
  );

  const label = classifyTrend(score, acceleration, recent.revRatio, opts.weakThreshold, opts.strongThreshold);

  return { overall, recent, acceleration, score, label };
}

// --- Legacy compat: keep old function signatures for any external callers ---

export function scoreTrend(bars: Bar[]): number {
  const analysis = analyzeTrend(bars, Math.min(8, bars.length), {
    weakThreshold: DEFAULTS.weakThreshold,
    strongThreshold: DEFAULTS.strongThreshold,
    accelerationWeight: DEFAULTS.accelerationWeight,
    recentWeightMultiplier: DEFAULTS.recentWeightMultiplier,
  });
  return analysis.score;
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

          const analysis = analyzeTrend(bars, Math.min(config.recentWindowSize, bars.length), {
            weakThreshold: config.weakThreshold,
            strongThreshold: config.strongThreshold,
            accelerationWeight: config.accelerationWeight,
            recentWeightMultiplier: config.recentWeightMultiplier,
          });

          log(
            "info",
            `[trend] ${stock.symbol}: ${analysis.label} ` +
            `score=${analysis.score} ` +
            `slope=${analysis.overall.slope.toFixed(3)} ` +
            `recentSlope=${analysis.recent.slope.toFixed(3)} ` +
            `accel=${analysis.acceleration.toFixed(3)}`
          );

          if (analysis.label === "choppy") continue;

          results.push({
            ...stock,
            trendLabel: analysis.label,
            trendScore: analysis.score,
            recentSlope: Math.round(analysis.recent.slope * 1000) / 1000,
            acceleration: Math.round(analysis.acceleration * 1000) / 1000,
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
