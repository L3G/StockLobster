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
  barCount: 24,
  recentWindowSize: 8,
  recentWeightMultiplier: 1.5,
  accelerationWeight: 0.10,
  interval: "5m",
  range: "1d",
};

const MIN_BARS = 5;

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

// --- Safe number helper ---

/** Clamp NaN / Infinity to 0. */
export function safe(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value;
}

// --- Exported helpers (unit-test-friendly) ---

export function computeSlope(closes: number[]): number {
  if (closes.length <= 1) return 0;
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
  if (mean === 0) return 0;
  return safe((slope / mean) * 100);
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
    if (closes[i - 2] === 0 || closes[i - 1] === 0) continue;
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
  if (high === 0) return 0;
  return safe(recent / high);
}

/** Filter out bars with invalid numeric values. */
export function sanitizeBars(bars: Bar[]): Bar[] {
  return bars.filter(
    (b) =>
      Number.isFinite(b.close) &&
      Number.isFinite(b.high) &&
      Number.isFinite(b.low) &&
      b.close > 0 &&
      b.high > 0 &&
      b.low > 0
  );
}

const ZERO_METRICS: TrendMetrics = { slope: 0, hhRatio: 0, hlRatio: 0, revRatio: 0, nearHigh: 0 };

const CHOPPY_ANALYSIS: TrendAnalysis = {
  overall: ZERO_METRICS,
  recent: ZERO_METRICS,
  acceleration: 0,
  score: 0,
  label: "choppy",
};

/** Compute all trend metrics for a set of bars. */
export function computeMetrics(bars: Bar[]): TrendMetrics {
  if (bars.length <= 1) return ZERO_METRICS;

  const closes = bars.map((b) => b.close);
  const n = Math.max(bars.length - 1, 1);
  const maxRev = Math.max(bars.length - 2, 1);

  return {
    slope: safe(computeSlope(closes)),
    hhRatio: safe(countHigherHighs(bars) / n),
    hlRatio: safe(countHigherLows(bars) / n),
    revRatio: safe(countReversals(closes) / maxRev),
    nearHigh: safe(nearRecentHigh(closes)),
  };
}

/**
 * Score a trend using both overall and recent-window metrics.
 * All inputs are wrapped with safe() to prevent NaN propagation.
 * Final score is clamped to 0–100.
 */
export function scoreTrendWithAcceleration(
  overall: TrendMetrics,
  recent: TrendMetrics,
  acceleration: number,
  accelerationWeight: number,
  recentMultiplier: number,
): number {
  const toSlopeScore = (s: number) => Math.min(Math.max(safe(s) * 20, 0), 100);

  const overallSlopeScore = toSlopeScore(overall.slope);
  const recentSlopeScore = toSlopeScore(safe(recent.slope) * safe(recentMultiplier));

  const overallHHScore = safe(overall.hhRatio) * 100;
  const overallHLScore = safe(overall.hlRatio) * 100;
  const recentHHScore = safe(recent.hhRatio) * 100;
  const recentHLScore = safe(recent.hlRatio) * 100;

  const overallRevScore = (1 - safe(overall.revRatio)) * 100;
  const recentRevScore = (1 - safe(recent.revRatio)) * 100;

  const nearHighScore = safe(overall.nearHigh) * 100;

  const accelScore = Math.min(Math.max(50 + safe(acceleration) * 30, 0), 100);

  const aw = safe(accelerationWeight);
  const baseWeight = 1 - aw;

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

  const score = safe(base) * baseWeight + accelScore * aw;
  return Math.round(Math.min(Math.max(safe(score), 0), 100));
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
  if (recentRevRatio > 0.6) return "choppy";
  if (score >= strongThreshold && acceleration >= -0.5) return "strong_uptrend";
  if (score >= weakThreshold) return "weak_uptrend";
  return "choppy";
}

/**
 * Full trend analysis: splits bars into overall + recent, computes
 * metrics, acceleration, score, and classification.
 * Returns a safe choppy default if data is insufficient.
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
  const clean = sanitizeBars(bars);
  if (clean.length < MIN_BARS) return CHOPPY_ANALYSIS;

  const overall = computeMetrics(clean);

  const recentBars = clean.slice(-Math.min(recentWindowSize, clean.length));
  const recent = recentBars.length >= 2 ? computeMetrics(recentBars) : ZERO_METRICS;

  const acceleration = safe(recent.slope - overall.slope);

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

// --- Legacy compat ---

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
          const clean = sanitizeBars(bars);

          if (clean.length < MIN_BARS) {
            log("warn", `[trend] ${stock.symbol}: insufficient valid bars (${clean.length}/${bars.length}) — defaulting to choppy`);
            continue;
          }

          const analysis = analyzeTrend(clean, config.recentWindowSize, {
            weakThreshold: config.weakThreshold,
            strongThreshold: config.strongThreshold,
            accelerationWeight: config.accelerationWeight,
            recentWeightMultiplier: config.recentWeightMultiplier,
          });

          const recentUsable = clean.length >= config.recentWindowSize;

          log(
            "info",
            `[trend] ${stock.symbol}: ${analysis.label} ` +
            `score=${analysis.score} ` +
            `slope=${safe(analysis.overall.slope).toFixed(3)} ` +
            `recentSlope=${safe(analysis.recent.slope).toFixed(3)} ` +
            `accel=${safe(analysis.acceleration).toFixed(3)} ` +
            `bars=${clean.length} recentWindow=${recentUsable ? "ok" : "partial"}`
          );

          if (analysis.label === "choppy") continue;

          results.push({
            ...stock,
            trendLabel: analysis.label,
            trendScore: analysis.score,
            recentSlope: safe(Math.round(analysis.recent.slope * 1000) / 1000),
            acceleration: safe(Math.round(analysis.acceleration * 1000) / 1000),
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
