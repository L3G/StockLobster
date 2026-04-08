export type TrendLabel = "strong_uptrend" | "weak_uptrend" | "choppy" | "unknown";

export interface Stock {
  symbol: string;
  price: number;
  percentChange: number;
  volume: number;
  avgVolume?: number;
  timestamp: number;
  trendLabel?: TrendLabel;
  trendScore?: number;
  recentSlope?: number;
  acceleration?: number;
  chartUrl?: string;
}

export interface StockFilter {
  name: string;
  apply(stocks: Stock[]): Promise<Stock[]>;
}

export interface Notifier {
  name: string;
  send(stocks: Stock[], meta?: SignalMeta): Promise<void>;
}

export interface DataSource {
  name: string;
  fetch(): Promise<unknown>;
  normalize(raw: unknown): Stock[];
}

export interface Strategy {
  name: string;
  description?: string;
  filters: StockFilter[];
}

export interface SignalMeta {
  strategy: string;
  count: number;
}

export interface EngineConfig {
  dataSource: DataSource;
  strategy: Strategy;
  notifiers: Notifier[];
  pollIntervalMs: number;
  dedupeCooldownMs: number;
  maxAlerts: number;
  timeWindow?: {
    startHour: number;
    endHour: number;
  };
}
