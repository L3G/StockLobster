export type TrendLabel = "strong_uptrend" | "weak_uptrend" | "choppy";

export interface Stock {
  symbol: string;
  price: number;
  percentChange: number;
  volume: number;
  avgVolume?: number;
  timestamp: number;
  trendLabel?: TrendLabel;
  trendScore?: number;
  chartUrl?: string;
}

export interface StockFilter {
  name: string;
  apply(stocks: Stock[]): Promise<Stock[]>;
}

export interface Notifier {
  name: string;
  send(stocks: Stock[]): Promise<void>;
}

export interface DataSource {
  name: string;
  fetch(): Promise<unknown>;
  normalize(raw: unknown): Stock[];
}

export interface EngineConfig {
  dataSource: DataSource;
  filters: StockFilter[];
  notifiers: Notifier[];
  pollIntervalMs: number;
  dedupeCooldownMs: number;
  maxAlerts: number;
  timeWindow?: {
    startHour: number; // 0-23, in local time
    endHour: number;
  };
}
