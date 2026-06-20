# PerpScope

PerpScope is a read-only Percolator risk cockpit plus a small terminal adapter kit for Solana perps interfaces.

It is built around a simple idea: traders should understand market health, liquidation runway, oracle/crank freshness, funding pressure, and execution quality without reading a wall of raw protocol output.

![PerpScope desktop cockpit](docs/screenshots/perpscope-desktop.png)

![PerpScope healthy-to-risk demo](docs/screenshots/perpscope-demo.gif)

![PerpScope CLI adapter demo](docs/screenshots/perpscope-adapter.png)

![PerpScope mobile cockpit](docs/screenshots/perpscope-mobile.png)

## Why This Exists

Solana perps terminals are getting better, but terminal teams still have to decode protocol state, reconcile risk math, and present safety-critical data clearly. PerpScope is the neutral read-only layer:

- a cockpit traders can keep open while checking perps risk
- a fixture-first adapter kit terminal builders can embed or test against
- a safety boundary that never connects wallets, signs, sends, routes, or recommends trades

## Run

```bash
npm start
```

Then open the printed local URL.

## Check

```bash
npm run check
```

## Try Imports

Open the cockpit and use `Try CLI` for the bundled Percolator command demo. You can also use `Import`, or drag JSON/captured stdout into the adapter dock:

```text
examples/decoded-slab.snapshot.json
examples/percolator-cli.bundle.json
examples/percolator-list-markets.stdout.json
examples/read-only-rpc.fetch.json
```

The import path accepts full PerpScope snapshots shaped as:

```js
{
  source: { label, mode, generatedAt },
  cluster,
  currentSlot,
  markets: [
    {
      id, name, base, quote, slab, program,
      header,
      config,
      oracle,
      engine,
      account,
      execution
    }
  ]
}
```

Snapshots containing wallet, keypair, seed, mnemonic, private, or secret-looking fields are rejected before rendering.

It also accepts Percolator CLI command bundles and captured stdout shaped as:

```js
{
  label: "Percolator CLI demo",
  cluster: "mainnet-beta",
  market: { symbol, base, quote, slab, program },
  commands: [
    { command: "list-markets", output },
    { command: "slab:get", output },
    { command: "slab:params", output },
    { command: "slab:engine", output },
    { command: "best-price", output },
    { command: "slab:account", output },
    { command: "slab:accounts", output },
    { command: "slab:bitmap", output }
  ]
}
```

Captured `stdout`, `stdoutText`, `output`, `data`, and `result` fields are parsed through the same read-only path. Raw protocol integer fields such as `capital`, `pnl`, `positionBasisQ`, `vault`, or unscaled `price` are not displayed as USD unless the input uses explicit USD fields like `collateralUsd`, `unrealizedPnlUsd`, `vaultUsd`, `priceUsd`, or includes price decimals.

## Schemas

Published JSON schema contracts live in:

```text
schemas/perpscope-snapshot.schema.json
schemas/percolator-cli-bundle.schema.json
schemas/read-only-rpc-fetch.schema.json
```

## Terminal Builder Quickstart

```js
import {
  detectPercolatorInputShape,
  normalizePercolatorSnapshot,
  simulatePriceShock
} from "./src/lib/percolator-adapter.js";

const inputShape = detectPercolatorInputShape(decodedJson);
const snapshot = normalizePercolatorSnapshot(decodedJson);
const market = snapshot.markets[0];
const stress = simulatePriceShock(market, -5);
```

Use the normalized DTO to render your own terminal modules without coupling the terminal UI to raw Percolator CLI output. Today the adapter understands PerpScope snapshots plus captured stdout and read-only bundles from `list-markets`, `slab:get`, `slab:params`, `slab:engine`, `best-price`, `slab:account`, `slab:accounts`, and `slab:bitmap`.

## Read-Only RPC Fetcher

The RPC helper is intentionally injectable and read-only. It validates owner, data length, magic bytes, and mutating field names, then converts decoded account data through the same adapter:

```js
import { buildReadOnlyRpcSnapshot } from "./src/lib/read-only-rpc-fetcher.js";

const snapshot = buildReadOnlyRpcSnapshot(decodedFixture);
```

`fetchReadOnlyRpcSnapshot(request, client)` accepts a client with `getAccountInfo()`. It does not create wallets, sign, send, route, or place orders.

## Adapter API

```js
import {
  detectPercolatorInputShape,
  normalizePercolatorSnapshot,
  simulatePriceShock
} from "./src/lib/percolator-adapter.js";

const shape = detectPercolatorInputShape(decodedPercolatorState);
const snapshot = normalizePercolatorSnapshot(decodedPercolatorState);
const market = snapshot.markets[0];
const stress = simulatePriceShock(market, -5);
```

The normalized market DTO includes:

- `healthScore` and `status`
- `price`, `crank`, `funding`, `marketStructure`, and `solvency`
- `account` liquidation distance, margin buffer, equity, PnL, and funding PnL
- `execution` spread, impact, markout, latency, and fill-quality score
- `flags` for stale oracle, crank lag, thin insurance, stress caps, and liquidation tightness

## Product Surface

- `src/lib/percolator-adapter.js` normalizes Percolator-like slab, oracle, crank, funding, insurance, account, and execution data into terminal-ready DTOs.
- `src/lib/read-only-rpc-fetcher.js` validates read-only RPC slab fixtures and injected account fetches.
- `src/fixtures/percolator-market.js` contains sample decoded market/account state.
- `src/app.js` renders the read-only cockpit.
- `schemas/` contains the public input contracts.
- `test/percolator-adapter.test.js` covers adapter safety and risk math.

## Design Principles

- Cockpit first, landing page second.
- Gauges, chips, bands, and sparklines before prose.
- Read-only status visible without scrolling.
- No `Connect`, `Trade`, `Long`, `Short`, `Sign`, or wallet-adjacent affordances.
- Risk state is semantic color plus label, never color alone.
- Mobile keeps the market switcher and risk summary reachable before secondary panels.

## Safety Boundary

PerpScope does not connect wallets, read keypair files, sign transactions, submit transactions, route orders, or give trade recommendations. It is an observability and simulation surface.

Production adapters should validate account owner, data length, discriminators/magic bytes, market config, oracle freshness, and source terms before displaying live data.

## Deployment

This is a static app. Any static host can serve the repo root after checks pass.

```bash
npm run check
npm start
```

Current public site: [williamclay8.github.io/perpscope](https://williamclay8.github.io/perpscope/).

## Roadmap

- Execution-quality receipt timeline.
- Funding/skew history with source-aware candles.
- Live RPC adapter examples for selected Percolator deployments.
- Builder package split for `@perpscope/percolator`.
