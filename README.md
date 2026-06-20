# PerpScope

PerpScope is a read-only Percolator risk cockpit plus a small terminal adapter kit for Solana perps interfaces.

It is built around a simple idea: traders should understand market health, liquidation runway, oracle/crank freshness, funding pressure, and execution quality without reading a wall of raw protocol output.

![PerpScope desktop cockpit](docs/screenshots/perpscope-desktop.png)

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

## Try JSON Import

Open the cockpit and use `Import JSON`, or drag this example into the adapter dock:

```text
examples/decoded-slab.snapshot.json
```

The import path accepts decoded Percolator-like snapshots shaped as:

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

## Adapter API

```js
import {
  normalizePercolatorSnapshot,
  simulatePriceShock
} from "./src/lib/percolator-adapter.js";

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
- `src/fixtures/percolator-market.js` contains sample decoded market/account state.
- `src/app.js` renders the read-only cockpit.
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

Current status: local preview only until a remote repo and deployment target are configured.

## Roadmap

- Real decoded-slab import adapters from Percolator CLI output.
- Read-only RPC fetcher with owner/data-length/magic validation.
- Execution-quality receipt timeline.
- Funding/skew history with source-aware candles.
- Builder package split for `@perpscope/percolator`.
