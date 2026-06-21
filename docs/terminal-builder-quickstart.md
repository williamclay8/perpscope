# Terminal Builder Quickstart

Use PerpScope when you have decoded Percolator-like market output and want a read-only DTO, Watchtower signals, carry history, and a compatibility report for your terminal UI.

## Install

```bash
npm install @perpscope/percolator-adapter
```

## Normalize A Capture

```js
import {
  buildPercolatorCompatibilityReport,
  buildWatchtowerSignals,
  normalizeFundingSkewHistory,
  normalizePercolatorSnapshot,
  simulatePriceShock
} from "@perpscope/percolator-adapter";

const decodedCapture = {
  label: "terminal capture",
  cluster: "mainnet-beta",
  market: {
    symbol: "SOL-PERP",
    slab: "PERCOLAT_SOL_...",
    program: "Perco1ator..."
  },
  commands: [
    {
      command: "best-price",
      output: {
        oracle: { priceUsd: 181.61, ageSecs: 2 },
        bestBid: 181.52,
        bestAsk: 181.71
      }
    },
    {
      command: "slab:engine",
      output: {
        currentSlot: 346892110,
        lastCrankSlot: 346892050,
        fundingRateBpsPerHour: 0.82,
        openInterestUsd: 12500000,
        longOpenInterestUsd: 6800000,
        shortOpenInterestUsd: 5700000,
        insuranceUsd: 920000,
        claimUsd: 1,
        socialLossUsd: 0
      }
    }
  ]
};

const snapshot = normalizePercolatorSnapshot(decodedCapture);
const market = snapshot.markets[0];
const stress = simulatePriceShock(market, -5);

const compatibility = buildPercolatorCompatibilityReport(decodedCapture, snapshot);
const watchtower = buildWatchtowerSignals(market, stress);
const carryHistory = normalizeFundingSkewHistory(market.history.fundingSkew, market);
```

## Render First

Render these fields before raw protocol JSON:

- `compatibility.status`, `compatibility.score`, `compatibility.missingFields`, and `compatibility.ignoredFields`
- `market.healthScore`, `market.status`, and `market.flags`
- `market.price.mark`, `market.price.publishAgeSec`, and `market.crank.ageSlots`
- `market.account.liquidationDistancePct`, `market.account.marginBufferUsd`, and `market.account.positionNotionalUsd`
- `watchtower` cards for runway, freshness, execution, impact, carry, and solvency
- `carryHistory` rows for funding, OI skew, stress usage, oracle age, timestamp, and slot

## Compatibility Contract

Use `docs/field-compatibility-map.md` for accepted aliases and required fields. The shortest high-quality payload includes:

- `market.slab`
- `market.program`
- `price.mark`
- `price.publishAgeSec`
- `crank.ageSlots`
- `funding.bpsPerHour`
- `marketStructure.openInterestUsd`
- `execution.bestBid` and `execution.bestAsk`

## Safety Boundary

Keep captures read-only. Do not send wallet paths, private keys, mnemonics, seeds, signers, transactions, instructions, order payloads, API keys, or user-identifying account data.

If your terminal has a decoded shape PerpScope does not understand yet, use the intake form:

https://github.com/williamclay8/perpscope/issues/new?template=decoded-percolator-shape.yml
