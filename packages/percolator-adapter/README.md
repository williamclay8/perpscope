# @perpscope/percolator-adapter

Read-only adapter helpers for Solana perps terminals that want PerpScope DTOs without adopting the cockpit UI.

```bash
npm install @perpscope/percolator-adapter
```

```js
import {
  buildPercolatorCompatibilityReport,
  buildReadOnlyRpcSnapshot,
  buildWatchtowerSignals,
  compareCompatibilityReports,
  normalizeFundingSkewHistory,
  normalizePercolatorSnapshot,
  simulatePriceShock
} from "@perpscope/percolator-adapter";

const snapshot = normalizePercolatorSnapshot(decodedPercolatorJson);
const market = snapshot.markets[0];
const stress = simulatePriceShock(market, -5);
const compatibility = buildPercolatorCompatibilityReport(decodedPercolatorJson, snapshot);
const drift = compareCompatibilityReports(previousCompatibility, compatibility);
const watchtower = buildWatchtowerSignals(market, stress);
const carryHistory = normalizeFundingSkewHistory(market.history.fundingSkew, market);
```

## Boundary

The package exposes pure read-only helpers:

- `normalizePercolatorSnapshot()`
- `buildPercolatorCompatibilityReport()`
- `exportCompatibilityReport()`
- `compareCompatibilityReports()`
- `detectPercolatorInputShape()`
- `parsePercolatorJson()`
- `simulatePriceShock()`
- `toTerminalMarketDto()`
- `buildReadOnlyRpcSnapshot()`
- `fetchReadOnlyRpcSnapshot()`
- `validateReadOnlyRpcRequest()`
- `summarizeReadOnlyRpcDeployment()`
- `buildWatchtowerSignals()`
- `normalizeFundingSkewHistory()`
- `summarizeFundingSkewHistory()`

It does not connect wallets, sign, send, route, place orders, or submit transactions.

## Compatibility Report

`buildPercolatorCompatibilityReport(input, snapshot?)` turns decoded JSON or captured stdout into a compact field map:

- `status`: `compatible`, `partial`, `unknown`, or `rejected`
- `score`: 0-100 scan score for terminal readiness
- `recognizedSections`: mapped market, price, engine, account, execution, receipt, history, and provenance sections
- `missingFields`: useful fields the cockpit can render better when supplied
- `ignoredFields`: top-level fields or command names preserved as provenance but not mapped yet
- `aliasSuggestions`: candidate mappings such as `oraclePriceUsd -> price.mark`

The full field-level contract is documented in `../../docs/field-compatibility-map.md`, with a machine-readable manifest at `../../examples/field-compatibility-map.json`.

`compareCompatibilityReports(previous, current)` returns `perpscope.compatibility-diff` with score delta, status change, new/resolved fields, section drift, and merged alias suggestions.

`buildCompatibilityRealityCheck(report, { input })` returns `perpscope.reality-check` with provenance, required/useful mapped counts, unknown fields, and alias counts. Use it when a terminal needs to show whether a capture is synthetic, real-backed candidate, or externally submitted.

`buildCompatibilityDoctor(report, { input })` returns `perpscope.compatibility-doctor` with pass/check status, shape, safety, required/useful mapped fields, unknown fields, alias suggestions, and next actions.

`buildCompatibilityBadge(reportOrDoctor)` returns `perpscope.compatibility-badge` with Markdown and JSON-friendly fields for READMEs, PRs, and capture handoffs.

## CLI

```bash
perpscope init perpscope.capture.json
perpscope compat report capture.json
perpscope compat diff previous.json current.json
perpscope compat doctor capture.json --strict
perpscope compat badge capture.json --json
```

Doctor exit codes are CI-ready: `0` means required fields pass, `1` means rejected or required fields missing, and `2` means strict mode found useful-field gaps, unknown fields, or alias suggestions.

Try it locally with:

```bash
perpscope compat diff ../../examples/fixture-pack-minimal-terminal.json ../../examples/fixture-pack-drifted-aliases.json
```

For the real-backed candidate path, try `../../examples/fixture-pack-real-sanitized-rpc-shape.json`.

For a copy-paste starter shape, use `../../examples/capture-template.json`.

## DTO Example

```js
{
  source: { label: "Percolator CLI demo", mode: "read-only", commandSet: ["slab:get"] },
  cluster: "mainnet-beta",
  currentSlot: 346892110,
  markets: [
    {
      id: "sol-perp",
      name: "SOL-PERP",
      slab: "PERCOLAT_SOL_8k4q...Qp2",
      program: "Perco1ator111111111111111111111111111111111",
      status: "stable",
      price: { mark: 181.61, freshnessScore: 74, publishAgeSec: 2.1 },
      funding: { bpsPerHour: 0.82, dailyUsd: 150.13 },
      marketStructure: { oiSkewPct: 8.64, stressUsedPct: 23.6 },
      history: {
        fundingSkew: [
          { fundingBpsPerHour: 0.82, oiSkewPct: 8.64, stressUsedPct: 23.6, oracleAgeSec: 2.1 }
        ]
      }
    }
  ]
}
```
