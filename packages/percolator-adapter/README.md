# @perpscope/percolator-adapter

Read-only adapter helpers for Solana perps terminals that want PerpScope DTOs without adopting the cockpit UI.

```js
import {
  buildReadOnlyRpcSnapshot,
  buildWatchtowerSignals,
  normalizeFundingSkewHistory,
  normalizePercolatorSnapshot,
  simulatePriceShock
} from "@perpscope/percolator-adapter";

const snapshot = normalizePercolatorSnapshot(decodedPercolatorJson);
const market = snapshot.markets[0];
const stress = simulatePriceShock(market, -5);
const watchtower = buildWatchtowerSignals(market, stress);
const carryHistory = normalizeFundingSkewHistory(market.history.fundingSkew, market);
```

## Boundary

The package exposes pure read-only helpers:

- `normalizePercolatorSnapshot()`
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
