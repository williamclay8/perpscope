# PerpScope v0.6.0

PerpScope v0.6.0 adds compatibility drift and alias suggestions for terminal builders.

## Shipped

- Published npm adapter: `@perpscope/percolator-adapter@0.6.0`.
- New adapter helper: `compareCompatibilityReports(previous, current)`.
- Compatibility reports now include `aliasSuggestions`.
- Cockpit capture intake now shows a compact drift strip and alias suggestion chips.
- New example artifact: `examples/compatibility-diff.json`.
- Report export stays stable at `perpscope.compatibility-report`; diff export uses `perpscope.compatibility-diff`.

## Builder Flow

```js
import {
  buildPercolatorCompatibilityReport,
  compareCompatibilityReports
} from "@perpscope/percolator-adapter";

const previous = buildPercolatorCompatibilityReport(previousCapture);
const current = buildPercolatorCompatibilityReport(currentCapture);
const diff = compareCompatibilityReports(previous, current);
```

Use the diff to see score movement, new missing fields, resolved missing fields, ignored-field drift, section drift, and alias suggestions.

## Safety Boundary

PerpScope remains read-only. Diffing and alias suggestions never connect wallets, sign, send, route, place orders, submit transactions, or generate trade recommendations.

## Verification

- `npm run check` passes.
- `compareCompatibilityReports()` is exported by the package entrypoint.
- `examples/compatibility-diff.json` includes alias suggestions.
- Live cockpit shows compatibility drift and alias suggestions without adding order-entry or wallet controls.
