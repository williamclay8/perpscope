# PerpScope

PerpScope is a read-only Percolator risk cockpit plus a terminal adapter kit for Solana perps builders.

It helps two groups:

- **Terminal builders** can turn sanitized Percolator-like decoded output into stable frontend DTOs, compatibility reports, CI checks, and shareable badges.
- **Perps traders and risk dashboards** can inspect market health, liquidation runway, oracle/crank freshness, funding/skew pressure, execution quality, and receipts without a wallet or order form.

Live demo: [williamclay8.github.io/perpscope](https://williamclay8.github.io/perpscope/)

![PerpScope desktop cockpit](docs/screenshots/perpscope-desktop.png)

## Embed In Your Terminal In 60 Seconds

```html
<iframe title="PerpScope feed" src="https://williamclay8.github.io/perpscope/?embed=feed"></iframe>
<iframe title="PerpScope hot markets" src="https://williamclay8.github.io/perpscope/?embed=radar&filter=hot"></iframe>
<iframe title="PerpScope market risk" src="https://williamclay8.github.io/perpscope/?embed=market&market=wif-perp"></iframe>
```

```js
import { summarizePerpScopeExport } from "@perpscope/percolator-adapter";

const response = await fetch("https://raw.githubusercontent.com/williamclay8/perpscope/main/examples/perpscope-export.sample.json");
const payload = await response.json();

if (payload.schema !== "perpscope.export.v1") throw new Error("Unexpected export schema");

const summary = summarizePerpScopeExport(payload);
```

Use `docs/embed-integration.md` for the copy-paste guide, `examples/copy-integration/` for a live copy page, and `examples/embed-consumer/` for the terminal side-rail mock.

## 2-Minute Terminal Builder Check

```bash
npm install @perpscope/percolator-adapter
npx perpscope init perpscope.capture.json
npx perpscope compat doctor perpscope.capture.json --strict
npx perpscope compat badge perpscope.capture.json
```

Edit `perpscope.capture.json` with sanitized read-only decoded state, rerun doctor, then share the badge or open a GitHub issue.

Doctor exit codes are CI-ready:

- `0`: required fields pass
- `1`: rejected capture or required fields missing
- `2`: strict mode found useful-field gaps, unknown fields, or alias suggestions

## Safety Boundary

PerpScope is observability only. It does not connect wallets, read keypairs, sign transactions, submit transactions, route orders, place trades, or give trade recommendations.

PerpScope rejects wallet paths, private keys, mnemonics, seeds, signers, signatures, transactions, instructions, order payloads, API keys, and user-identifying account data.

## What You Get

- a clean DTO for decoded Percolator-like market, account, execution, and receipt data
- compatibility reports for pasted or dropped decoded captures
- compatibility diffing and alias suggestions when decoded terminal shapes drift
- `perpscope init`, `compat doctor`, and `compat badge` for local and CI workflows
- fixture packs for CLI logs, captured stdout, read-only RPC fixtures, carry history, and terminal adapter demos
- a visual cockpit reference for presenting risk without dumping protocol JSON
- decoded live source loading via `?decodedSource=https://...` for CORS-readable read-only protocol feeds
- a read-only decoder worker that emits `/perpscope.json` from Percolator SDK decoded market accounts
- a Trader Radar board that ranks live markets by heat, stress, skew, funding pressure, freshness, and unit-confidence checks
- live-by-default public site behavior with a compact Data Confidence strip and Trader Radar filters
- Why Hot explanations, Feed Health, shareable market/filter links, and terminal Adapter Targets
- exportable `perpscope.export.v1` JSON plus `?embed=feed`, `?embed=radar`, and `?embed=market` widgets
- issue templates for sanitized decoded shapes, adapter mapping requests, and CLI doctor output

## Submit A Shape

Use one of the GitHub issue forms:

- [Submit sanitized decoded shape](https://github.com/williamclay8/perpscope/issues/new?template=decoded-percolator-shape.yml) via `.github/ISSUE_TEMPLATE/decoded-percolator-shape.yml`
- [Request adapter mapping](https://github.com/williamclay8/perpscope/issues/new?template=adapter-mapping-request.yml) via `.github/ISSUE_TEMPLATE/adapter-mapping-request.yml`
- [Share CLI doctor output](https://github.com/williamclay8/perpscope/issues/new?template=cli-doctor-output.yml) via `.github/ISSUE_TEMPLATE/cli-doctor-output.yml`

Start with `CONTRIBUTING.md` if you are submitting public fixture data.

## External Consumer Example

`examples/adapter-consumer/` is a tiny outside-terminal package that imports `@perpscope/percolator-adapter` by package name and prints the normalized fields a frontend would usually consume first.

For terminal projects outside this repo:

```bash
npm install @perpscope/percolator-adapter
```

For the local example:

```bash
cd examples/adapter-consumer
npm install
npm run demo
```

It is intentionally boring in the best way: load a read-only fixture, normalize it, compute Watchtower signals, return carry history and provenance.

## Watchtower

Watchtower is the trader-facing read-only signal layer inside PerpScope. It compresses normalized protocol data into six compact cards:

- runway: liquidation distance, margin buffer, and stress buffer
- freshness: oracle age and crank lag
- execution: receipt markout, latency, and priority fee pressure
- impact curve: $50k impact versus $10k impact
- carry: funding and OI-skew pressure
- solvency: insurance coverage and social-loss state

It is deliberately observational. It does not recommend a direction, place an order, connect a wallet, or submit a transaction.

## Carry History

The cockpit includes a compact funding/skew history panel for:

- funding bps/hour
- long/short OI skew
- stress usage
- oracle age
- source timestamp and slot provenance

The same parser accepts fixture arrays and captured terminal logs like `examples/funding-skew-history.stdout.json`.

## Capture Intake

PerpScope v0.4 adds a read-only capture intake panel and adapter helper for messy decoded protocol output. Paste, drop, or import JSON/stdout and PerpScope will:

- normalize the sections it understands
- score terminal compatibility
- show mapped sections, missing fields, ignored fields, source commands, slab, and program provenance
- reject secret-bearing or mutating fields before rendering

The public helpers are `buildPercolatorCompatibilityReport(input, snapshot?)`, `exportCompatibilityReport(input, snapshot?)`, and `compareCompatibilityReports(previous, current)`, exported from `@perpscope/percolator-adapter`.

Terminal builders can use the field-level contract in `docs/field-compatibility-map.md`, the machine-readable `examples/field-compatibility-map.json`, `examples/compatibility-report-export.json`, and `examples/compatibility-diff.json` to see accepted aliases, required fields, Watchtower dependencies, carry-history inputs, ignored fields, alias suggestions, and rejected wallet/signer/transaction/order payloads.

Real decoded shapes can be submitted through `docs/feedback-loop.md` or the GitHub issue form at `.github/ISSUE_TEMPLATE/decoded-percolator-shape.yml`.

Start with `docs/terminal-builder-quickstart.md` if you are wiring the npm adapter into a terminal.

## Live Read-Only Deployment Examples

PerpScope v0.2 adds deployment-style read fixtures that mirror how a terminal can validate a selected Percolator slab through an injected RPC client:

| fixture | cluster | read | owner | data length | magic | oracle |
| --- | --- | --- | --- | --- | --- | --- |
| `examples/percolator-mainnet-sol.readonly-rpc.json` | `mainnet-beta` | `getAccountInfo` | `Perco1ator...111111` | `524800` | `50455243` | `2.0s / 8s` |
| `examples/percolator-devnet-wif.readonly-rpc.json` | `devnet` | `getAccountInfo` | `Perco1ator...111111` | `262400` | `50455243` | `7.2s / 8s` |

Each fixture carries `expectations` for owner, account data length, slab magic/discriminator, required decoded sections, and maximum oracle age. `summarizeReadOnlyRpcDeployment()` fails closed if those expectations drift.

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

Open the cockpit and use `Try CLI` for the bundled Percolator command demo. You can also use `Paste`, `Import`, or drag JSON/captured stdout into the capture intake:

```text
examples/decoded-slab.snapshot.json
examples/execution-receipts.stdout.json
examples/percolator-cli.bundle.json
examples/percolator-list-markets.stdout.json
examples/read-only-rpc.fetch.json
examples/percolator-mainnet-sol.readonly-rpc.json
examples/percolator-devnet-wif.readonly-rpc.json
examples/funding-skew-history.stdout.json
examples/adapter-consumer/
examples/copy-integration/
examples/embed-consumer/
examples/perpscope-export.sample.json
examples/terminal-recipes.json
examples/terminal-dto-export.json
examples/fixture-pack-minimal-terminal.json
examples/fixture-pack-drifted-aliases.json
examples/fixture-pack-receipt-heavy-execution.json
examples/fixture-pack-real-sanitized-rpc-shape.json
examples/static-real-snapshot.json
examples/capture-template.json
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
    { command: "execution:receipts", output },
    { command: "slab:account", output },
    { command: "slab:accounts", output },
    { command: "slab:bitmap", output }
  ]
}
```

Captured `stdout`, `stdoutText`, `output`, `data`, and `result` fields are parsed through the same read-only path. Receipt arrays can be imported as `receipts`, `executionReceipts`, `receiptTimeline`, or an `execution:receipts` command output. Raw protocol integer fields such as `capital`, `pnl`, `positionBasisQ`, `vault`, or unscaled `price` are not displayed as USD unless the input uses explicit USD fields like `collateralUsd`, `unrealizedPnlUsd`, `vaultUsd`, `priceUsd`, or includes price decimals.

## Schemas

Published JSON schema contracts live in:

```text
schemas/perpscope-snapshot.schema.json
schemas/percolator-cli-bundle.schema.json
schemas/read-only-rpc-fetch.schema.json
schemas/funding-skew-history.schema.json
schemas/perpscope-export.schema.json
```

The source-backed adapter field map lives in `docs/field-compatibility-map.md`, with a JSON manifest at `examples/field-compatibility-map.json`, an export artifact at `examples/compatibility-report-export.json`, a diff artifact at `examples/compatibility-diff.json`, and fixture packs such as `examples/fixture-pack-drifted-aliases.json`, `examples/fixture-pack-real-sanitized-rpc-shape.json`, and `examples/static-real-snapshot.json`.

The terminal-builder quickstart lives in `docs/terminal-builder-quickstart.md`.

The embed and export integration guide lives in `docs/embed-integration.md`.

## Embeddable Adapter Package

The adapter boundary lives in `packages/percolator-adapter` and re-exports the pure read-only helpers used by the cockpit:

```js
import {
  buildCompatibilityRealityCheck,
  buildPercolatorCompatibilityReport,
  buildWatchtowerSignals,
  compareCompatibilityReports,
  normalizeFundingSkewHistory,
  normalizePercolatorSnapshot,
  parsePerpScopeExport,
  summarizePerpScopeExport,
  simulatePriceShock
} from "./packages/percolator-adapter/index.js";

const snapshot = normalizePercolatorSnapshot(decodedJson);
const market = snapshot.markets[0];
const stress = simulatePriceShock(market, -5);
const compatibility = buildPercolatorCompatibilityReport(decodedJson, snapshot);
const reality = buildCompatibilityRealityCheck(compatibility, { input: decodedJson });
const drift = compareCompatibilityReports(previousCompatibility, compatibility);
const watchtower = buildWatchtowerSignals(market, stress);
const carryHistory = normalizeFundingSkewHistory(market.history.fundingSkew, market);
const embedSummary = summarizePerpScopeExport(parsePerpScopeExport(perpscopeExportJson));
```

The package is intentionally side-effect free. It does not create wallets, sign, send, route, or submit transactions.

CLI:

```bash
perpscope init perpscope.capture.json
perpscope compat report examples/fixture-pack-drifted-aliases.json
perpscope compat diff examples/fixture-pack-minimal-terminal.json examples/fixture-pack-drifted-aliases.json
perpscope compat doctor examples/capture-template.json
perpscope compat badge examples/capture-template.json --json
```

## 2-Minute Terminal Builder Check

```bash
npm install @perpscope/percolator-adapter
npx perpscope init perpscope.capture.json
npx perpscope compat doctor perpscope.capture.json --strict
npx perpscope compat badge perpscope.capture.json
```

Edit `perpscope.capture.json` with sanitized read-only decoded state, rerun doctor, then open the decoded-shape issue with the capture and badge when it is clean enough to share.

## Terminal Builder Quickstart

```js
import {
  buildPercolatorCompatibilityReport,
  detectPercolatorInputShape,
  normalizeFundingSkewHistory,
  normalizePercolatorSnapshot,
  simulatePriceShock
} from "./packages/percolator-adapter/index.js";

const inputShape = detectPercolatorInputShape(decodedJson);
const snapshot = normalizePercolatorSnapshot(decodedJson);
const market = snapshot.markets[0];
const stress = simulatePriceShock(market, -5);
const compatibility = buildPercolatorCompatibilityReport(decodedJson, snapshot);
const carryHistory = normalizeFundingSkewHistory(market.history.fundingSkew, market);
```

Use the normalized DTO to render your own terminal modules without coupling the terminal UI to raw Percolator CLI output. Today the adapter understands PerpScope snapshots plus captured stdout and read-only bundles from `list-markets`, `slab:get`, `slab:params`, `slab:engine`, `best-price`, `execution:receipts`, `slab:account`, `slab:accounts`, and `slab:bitmap`.

## Terminal Import/Export Recipes

`examples/terminal-recipes.json` documents eight paths:

- file import from `examples/decoded-slab.snapshot.json`
- drag/drop captured stdout from `examples/execution-receipts.stdout.json`
- command-bundle import from `examples/percolator-cli.bundle.json`
- market directory import from `examples/percolator-list-markets.stdout.json`
- injected read-only RPC from `examples/percolator-mainnet-sol.readonly-rpc.json`
- carry-history stdout from `examples/funding-skew-history.stdout.json`
- external package consumer from `examples/adapter-consumer/`
- DTO export using `examples/terminal-dto-export.json`
- capture intake compatibility report from pasted or dropped decoded JSON/stdout

The export shape keeps source provenance with `source.label`, `source.mode`, `source.commandSet`, `cluster`, `currentSlot`, `market.slab`, and `market.program` so a terminal can show where the risk state came from.

## Read-Only RPC Fetcher

The RPC helper is intentionally injectable and read-only. It validates owner, data length, magic bytes, and mutating field names, then converts decoded account data through the same adapter:

```js
import {
  buildReadOnlyRpcSnapshot,
  summarizeReadOnlyRpcDeployment
} from "./packages/percolator-adapter/index.js";

const snapshot = buildReadOnlyRpcSnapshot(decodedFixture);
const summary = summarizeReadOnlyRpcDeployment(decodedFixture);
```

`fetchReadOnlyRpcSnapshot(request, client)` accepts a client with `getAccountInfo()`. It does not create wallets, sign, send, route, or place orders.

## Adapter API

```js
import {
  buildPercolatorCompatibilityReport,
  detectPercolatorInputShape,
  normalizePercolatorSnapshot,
  simulatePriceShock
} from "./packages/percolator-adapter/index.js";

const shape = detectPercolatorInputShape(decodedPercolatorState);
const snapshot = normalizePercolatorSnapshot(decodedPercolatorState);
const compatibility = buildPercolatorCompatibilityReport(decodedPercolatorState, snapshot);
const market = snapshot.markets[0];
const stress = simulatePriceShock(market, -5);
```

The normalized market DTO includes:

- `healthScore` and `status`
- `price`, `crank`, `funding`, `marketStructure`, and `solvency`
- `account` liquidation distance, margin buffer, equity, PnL, and funding PnL
- `execution` spread, impact, markout, latency, and fill-quality score
- `execution.receipts` with spread, impact, 1m/5m markout, route latency, priority fee, source timestamp, and source label
- `buildPercolatorCompatibilityReport()` with `status`, `score`, `recognizedSections`, `missingFields`, and `ignoredFields`
- `buildCompatibilityRealityCheck()` with provenance, required/useful mapped counts, unknown fields, and alias counts
- `buildCompatibilityDoctor()` and `buildCompatibilityBadge()` for 2-minute terminal builder checks
- `Watchtower` signals for runway, freshness, execution, impact curve, carry, and solvency
- `history.fundingSkew` rows for funding, OI skew, stress usage, oracle age, source timestamp, and slot
- `flags` for stale oracle, crank lag, thin insurance, stress caps, and liquidation tightness

## Product Surface

- `src/lib/percolator-adapter.js` normalizes Percolator-like slab, oracle, crank, funding, insurance, account, and execution data into terminal-ready DTOs.
- `buildPercolatorCompatibilityReport()` maps partial decoded captures into visible terminal-readiness warnings.
- `buildCompatibilityRealityCheck()` turns compatibility output into a compact trust summary for real-backed vs synthetic captures.
- `buildCompatibilityDoctor()` prints the practical pass/check summary builders need before opening an issue.
- `buildCompatibilityBadge()` produces a small Markdown/JSON compatibility badge for READMEs, PRs, and fixture handoffs.
- `exportCompatibilityReport()` turns the current capture into an attachable JSON report for terminal teams.
- `compareCompatibilityReports()` shows adapter drift and alias suggestions between two reports.
- `src/lib/read-only-rpc-fetcher.js` validates read-only RPC slab fixtures and injected account fetches.
- `src/lib/watchtower-signals.js` and `src/lib/funding-history.js` power the embeddable package and cockpit panels.
- `packages/percolator-adapter/` is the package boundary for terminal builders.
- `examples/adapter-consumer/` shows the package from an outside-terminal point of view.
- `docs/field-compatibility-map.md` documents accepted aliases, required fields, Watchtower dependencies, and read-only rejection rules.
- `docs/feedback-loop.md` is the public intake loop for decoded Percolator shapes and missing terminal fields.
- `docs/terminal-builder-quickstart.md` shows the npm install path and the first DTO/signals to render.
- `docs/launch-post.md` and `docs/outreach-loop.md` contain launch copy and the first builder outreach loop.
- `docs/release-v0.4.0.md` mirrors the public release notes for the npm-live v0.4 release.
- `docs/release-v0.5.0.md` mirrors the public release notes for the report export release.
- `docs/release-v0.6.0.md` mirrors the public release notes for the drift and alias suggestion release.
- `docs/release-v0.7.0.md` mirrors the public release notes for the workbench, CLI, and fixture-pack release.
- `docs/release-v0.8.0.md` mirrors the public release notes for the reality check and real-backed candidate fixture.
- `docs/release-v0.9.0.md` mirrors the public release notes for the doctor, badge, and capture-template release.
- `docs/release-v1.0.0.md` mirrors the public release notes for init and CI-ready doctor exit codes.
- `docs/release-v1.0.1.md` mirrors the public release notes for adoption and trust polish.
- `docs/release-v1.1.0.md` mirrors the public release notes for the Data Source cockpit and static real-backed snapshot.
- `docs/release-v1.2.0.md` mirrors the public release notes for actual public price loading.
- `docs/release-v1.3.0.md` mirrors the public release notes for decoded live source loading.
- `docs/release-v1.4.0.md` mirrors the public release notes for the decoder worker.
- `docs/release-v1.5.0.md` mirrors the public release notes for default live Percolator loading and Trader Radar.
- `docs/release-v1.6.0.md` mirrors the public release notes for automatic live loading, confidence, and radar filters.
- `docs/release-v1.7.0.md` mirrors the public release notes for why-hot explanations, feed health, share links, and adapter targets.
- `docs/release-v1.8.0.md` mirrors the public release notes for exportable JSON and embed widgets.
- `docs/release-v1.9.0.md` mirrors the public release notes for copy-paste embeds and export consumer examples.
- `docs/release-v2.0.0.md` mirrors the public release notes for the schema-locked terminal integration kit.
- `docs/adapter-targets.md` documents the terminal rail, risk overlay, execution lane, feed monitor, and embed contracts.
- `docs/embed-integration.md` documents iframe widgets, the export fixture, and trusted display fields.
- `docs/decoded-live-source.md` documents the CORS endpoint contract for decoded Percolator live feeds.
- `docs/v0.5-plan.md` documents the shipped compatibility report export.
- `.github/ISSUE_TEMPLATE/decoded-percolator-shape.yml` is the structured intake form for sanitized builder samples.
- `src/fixtures/percolator-market.js` contains sample decoded market/account state plus execution receipt history.
- `src/app.js` renders the read-only cockpit.
- The website auto-loads the hosted read-only Percolator worker on GitHub Pages, with `?fixture=1` or `?live=0` available for fixture-first review. The Data Source panel can also load `examples/static-real-snapshot.json`, which is a sanitized real-backed static snapshot, `Load Live`, which pulls actual public prices from CoinGecko while keeping Percolator risk context simulated, or `Load Percolator`, which defaults to the hosted read-only decoder worker unless `?decodedSource=` points at another CORS-readable decoded protocol feed.
- `scripts/percolator-decoder-worker.mjs` serves a read-only `/perpscope.json` decoded source from public Percolator market directories and Solana RPC reads.
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
npm run decoder:start
```

Current public site: [williamclay8.github.io/perpscope](https://williamclay8.github.io/perpscope/).

## Roadmap

- v0.4 shipped: capture intake for pasted/dropped decoded outputs, compatibility scoring, missing-field warnings, and ignored-field mapping.
- v0.4 follow-up: field-level compatibility map for terminal import/export adapters.
- npm package shipped: `@perpscope/percolator-adapter@2.0.0`.
- v0.5 shipped: downloadable compatibility report export for terminal builders.
- v0.6 shipped: compatibility diffing and alias suggestions for drifting terminal shapes.
- v0.7 shipped: local compatibility workbench, CLI report/diff commands, and fixture packs.
- v0.8 shipped: reality check panel, `buildCompatibilityRealityCheck()`, and `examples/fixture-pack-real-sanitized-rpc-shape.json`.
- v0.9 shipped: `compat doctor`, `compat badge`, and `examples/capture-template.json`.
- v1.0 shipped: `perpscope init`, CI-ready `compat doctor` exit codes, and the 2-minute terminal-builder check.
- v1.1 shipped: Data Source disclosure, `Load Snapshot`, and `examples/static-real-snapshot.json` so the website clearly separates fixture, static real-backed, and unwired live data.
- v1.2 shipped: `Load Live` for actual public SOL/BTC/WIF prices with explicit simulated Percolator risk context.
- v1.3 shipped: `Load Decoded`, `?decodedSource=`, and the decoded live source contract for read-only protocol feeds.
- v1.4 shipped: `perpscope-decoder-worker`, Render Blueprint deployment, and SDK-backed decoded market account output.
- v1.5 shipped: default hosted Percolator loading, decoded value sanity checks, and Trader Radar market ranking.
- v1.6 shipped: automatic public-site live loading, Data Confidence summary, Trader Radar filters, and live loading/fallback states.
- v1.7 shipped: Why Hot explanations, Feed Health, shareable cockpit links, and terminal Adapter Targets.
- v1.8 shipped: exportable PerpScope JSON, radar/market copy actions, and feed/radar/market embeds.
- More deployment fixtures as Percolator terminal teams share read-only shapes.
