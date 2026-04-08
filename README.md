# StockLobster

Modular stock monitoring engine designed to integrate with [OpenClaw](https://github.com/L3G/OpenClaw). This is **not** a trading bot — it's a data pipeline and signal engine where strategy lives in pluggable filters.

## Architecture

```
/apps/market-engine   — Entry point, config, scheduler
/core                 — Data fetching, normalization, shared types
/filters              — Pluggable filter modules
/notifiers            — Pluggable notification channels
/utils                — Logger, time helpers
```

### Data Flow

```
Fetch → Normalize → Filter (chained) → Notify
```

## Quick Start (Local / MacBook)

```bash
# Install dependencies
npm install

# Run in dev mode (uses tsx for direct TS execution)
npm run dev

# Or build and run
npm run build
npm start
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `OPENCLAW_GATEWAY_URL` | OpenClaw ingest endpoint | `http://localhost:3000/api/ingest` |
| `OPENCLAW_API_KEY` | API key for OpenClaw | — |
| `POLL_INTERVAL_MS` | Polling interval in milliseconds | `300000` (5 min) |
| `TIME_WINDOW_START` | Hour to start running (0-23) | — |
| `TIME_WINDOW_END` | Hour to stop running (0-23) | — |
| `YAHOO_CRUMB` | Yahoo Finance API crumb (if needed) | — |
| `YAHOO_COOKIE` | Yahoo Finance cookie (if needed) | — |

Create a `.env` file or export these in your shell before running.

## Deploy on Mac Mini with OpenClaw

1. Clone the repo and install:
   ```bash
   git clone https://github.com/L3G/StockLobster.git
   cd StockLobster
   npm install
   npm run build
   ```

2. Set environment variables (point to your OpenClaw instance):
   ```bash
   export OPENCLAW_GATEWAY_URL="http://localhost:3000/api/ingest"
   export OPENCLAW_API_KEY="your-key"
   export POLL_INTERVAL_MS=300000
   export TIME_WINDOW_START=9
   export TIME_WINDOW_END=16
   ```

3. Run as a background process:
   ```bash
   nohup node dist/apps/market-engine/index.js > stocklobster.log 2>&1 &
   ```

   Or use `launchd` for persistent service (create a plist in `~/Library/LaunchAgents/`):
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

## Writing a Custom Filter

Create a new file in `/filters/`:

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

Then add it to the `filters` array in `apps/market-engine/config.ts`.

## Writing a Custom Notifier

Create a new file in `/notifiers/`:

```typescript
import type { Stock, Notifier } from "../core/types.js";

export function createMyNotifier(): Notifier {
  return {
    name: "my-notifier",
    async send(stocks: Stock[]): Promise<void> {
      // send stocks somewhere
    },
  };
}
```

Then add it to the `notifiers` array in `apps/market-engine/config.ts`.

## Writing a Custom Data Source

Implement the `DataSource` interface:

```typescript
import type { DataSource, Stock } from "../core/types.js";

export const mySource: DataSource = {
  name: "my-source",
  async fetch(): Promise<unknown> {
    // fetch raw data
  },
  normalize(raw: unknown): Stock[] {
    // convert to Stock[]
  },
};
```

Then set it as `dataSource` in `apps/market-engine/config.ts`.

## License

MIT
