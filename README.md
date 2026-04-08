# StockLobster

A generic, modular stock/asset screening engine designed to integrate with [OpenClaw](https://github.com/L3G/OpenClaw). StockLobster is **not** a trading bot — it's a configurable data pipeline and signal engine. Strategy lives in pluggable filters and user-defined strategies.

## Architecture

```
/apps/market-engine   — Entry point, config, scheduler
/core                 — Data fetching, normalization, shared types
/filters              — Composable filter modules (price, volume, trend, etc.)
/strategies           — Named strategy definitions (compose filters into a pipeline)
/notifiers            — Output channels (OpenClaw)
/utils                — Logger, time helpers, market-hours utilities
```

### Data Flow

```
Fetch → Normalize → Strategy Filters (chained) → Dedupe → Notify (OpenClaw)
```

### Key Concepts

| Concept | Description |
|---|---|
| **DataSource** | Fetches and normalizes raw market data into `Stock[]` |
| **Filter** | Takes `Stock[]`, returns filtered `Stock[]`. Composable and stateless. |
| **Strategy** | A named collection of filters that defines a screening pipeline |
| **Notifier** | Delivers filtered signals to an external system (OpenClaw) |

## Quick Start

```bash
npm install
npm run dev
```

## Strategies

StockLobster ships with three built-in strategies. Select one via the `STRATEGY` env var:

### `momentum` (default)

Screens for stocks with price movement, volume, and optional trend quality analysis.

```bash
STRATEGY=momentum MIN_PRICE=10 MIN_PERCENT_CHANGE=2 MIN_VOLUME=1000000 npm run dev
```

### `breakout`

Higher percent-change floor and relative volume requirement to catch range breakouts.

```bash
STRATEGY=breakout MIN_PRICE=5 MIN_PERCENT_CHANGE=5 REL_VOLUME=2.0 npm run dev
```

### `default`

Minimal screening — price and volume gates only. Good starting point for custom setups.

```bash
STRATEGY=default MIN_PRICE=1 MIN_VOLUME=100000 npm run dev
```

## Environment Variables

### Strategy & Filters

| Variable | Description | Default |
|---|---|---|
| `STRATEGY` | Strategy to use: `momentum`, `breakout`, `default` | `momentum` |
| `MIN_PRICE` | Minimum stock price | varies by strategy |
| `MAX_PRICE` | Maximum stock price | — |
| `MIN_PERCENT_CHANGE` | Minimum percent change | varies by strategy |
| `MAX_PERCENT_CHANGE` | Maximum percent change | — |
| `MIN_VOLUME` | Minimum volume | varies by strategy |
| `REL_VOLUME` | Minimum relative volume (vs avg) | — |

### Trend Filter

| Variable | Description | Default |
|---|---|---|
| `TREND_FILTER_ENABLED` | Enable/disable trend analysis | `true` |
| `TREND_WEAK_THRESHOLD` | Min score for weak_uptrend (0–100) | `40` |
| `TREND_STRONG_THRESHOLD` | Min score for strong_uptrend (0–100) | `65` |
| `RECENT_WINDOW_SIZE` | Bars in recent window | `8` |
| `ACCELERATION_WEIGHT` | Weight of acceleration in scoring | `0.10` |
| `RECENT_WEIGHT_MULTIPLIER` | Amplifies recent slope | `1.5` |
| `CHART_INTERVAL` | Bar interval for chart data | `5m` |
| `CHART_RANGE` | Time range for chart data | `1d` |

### Engine

| Variable | Description | Default |
|---|---|---|
| `OPENCLAW_GATEWAY_URL` | OpenClaw ingest endpoint | `http://localhost:3000/api/ingest` |
| `OPENCLAW_API_KEY` | API key for OpenClaw | — |
| `POLL_INTERVAL_MS` | Polling interval (ms) | `300000` (5 min) |
| `TIME_WINDOW_START` | Hour to start running (0-23) | — |
| `TIME_WINDOW_END` | Hour to stop running (0-23) | — |
| `DEDUPE_COOLDOWN_MS` | Suppress duplicate symbol alerts (ms) | `900000` (15 min) |
| `MAX_ALERTS` | Max signals per cycle | `5` |
| `YAHOO_CRUMB` | Yahoo Finance API crumb | — |
| `YAHOO_COOKIE` | Yahoo Finance cookie | — |

## Writing a Custom Strategy

Create a file in `/strategies/`:

```typescript
import type { Strategy } from "../core/types.js";
import { createPriceFilter } from "../filters/price.js";
import { createVolumeFilter } from "../filters/volume.js";
import { createPercentChangeFilter } from "../filters/percent-change.js";

export function createMyStrategy(): Strategy {
  return {
    name: "my-strategy",
    description: "Custom screening logic",
    filters: [
      createPriceFilter({ min: 5, max: 200 }),
      createVolumeFilter({ minVolume: 500_000, minRelativeVolume: 1.5 }),
      createPercentChangeFilter({ min: 1 }),
    ],
  };
}
```

Then add a case for it in `apps/market-engine/config.ts` `loadStrategy()`.

## Writing a Custom Filter

Create a file in `/filters/`:

```typescript
import type { Stock, StockFilter } from "../core/types.js";

export function createMyFilter(): StockFilter {
  return {
    name: "my-filter",
    async apply(stocks: Stock[]): Promise<Stock[]> {
      return stocks.filter((s) => /* your logic */);
    },
  };
}
```

Then include it in a strategy's `filters` array.

## Writing a Custom Data Source

Implement the `DataSource` interface:

```typescript
import type { DataSource, Stock } from "../core/types.js";

export const mySource: DataSource = {
  name: "my-source",
  async fetch(): Promise<unknown> {
    // fetch raw data from any API
  },
  normalize(raw: unknown): Stock[] {
    // convert to Stock[]
  },
};
```

Then set it as `dataSource` in `apps/market-engine/config.ts`.

## Market Hours (Optional)

Market-specific time checks are available in `utils/markets/` but are **not** enforced by the core engine. Use them in your own strategy or time-window config:

```typescript
import { isUSMarketOpen } from "../utils/markets/us.js";
import { isCryptoMarketOpen } from "../utils/markets/crypto.js";
```

Or use the generic `TIME_WINDOW_START` / `TIME_WINDOW_END` env vars to restrict polling hours.

## OpenClaw Payload Format

```json
{
  "type": "signal_batch",
  "strategy": "momentum",
  "timestamp": 1712520000000,
  "meta": {
    "count": 3
  },
  "signals": [
    {
      "symbol": "AAPL",
      "price": 185.50,
      "percentChange": 3.2,
      "volume": 12345678,
      "trendLabel": "strong_uptrend",
      "trendScore": 78,
      "acceleration": 0.42,
      "chartUrl": "https://www.tradingview.com/chart/?symbol=AAPL"
    }
  ]
}
```

## Deploy on Mac Mini with OpenClaw

```bash
git clone https://github.com/L3G/StockLobster.git
cd StockLobster
npm install && npm run build

export STRATEGY=momentum
export OPENCLAW_GATEWAY_URL="http://localhost:3000/api/ingest"
export OPENCLAW_API_KEY="your-key"

nohup node dist/apps/market-engine/index.js > stocklobster.log 2>&1 &
```

Or use `launchd` for a persistent service — see the `.plist` example below:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.stocklobster.engine</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/path/to/StockLobster/dist/apps/market-engine/index.js</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/stocklobster.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/stocklobster.err</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>STRATEGY</key>
    <string>momentum</string>
    <key>OPENCLAW_GATEWAY_URL</key>
    <string>http://localhost:3000/api/ingest</string>
  </dict>
</dict>
</plist>
```

Load it:

```bash
launchctl load ~/Library/LaunchAgents/com.stocklobster.engine.plist
```

## License

MIT
