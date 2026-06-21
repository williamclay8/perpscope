# PerpScope v0.5.0

PerpScope v0.5.0 adds a portable compatibility report export for terminal builders.

## Shipped

- Published npm adapter: `@perpscope/percolator-adapter@0.5.0`.
- New adapter helper: `exportCompatibilityReport(input, snapshot?)`.
- New cockpit Export action inside capture intake.
- Stable report schema: `perpscope.compatibility-report`.
- Example artifact: `examples/compatibility-report-export.json`.
- Safety stays read-only: wallet, signer, transaction, instruction, order, private key, seed, mnemonic, and API key fields are rejected before export.

## Safety Boundary

PerpScope remains read-only. The export does not connect wallets, sign, send, route, place orders, submit transactions, or generate trade recommendations.

## Builder Flow

```bash
npm install @perpscope/percolator-adapter
```

```js
import {
  exportCompatibilityReport,
  normalizePercolatorSnapshot
} from "@perpscope/percolator-adapter";

const snapshot = normalizePercolatorSnapshot(decodedCapture);
const report = exportCompatibilityReport(decodedCapture, snapshot);
```

Attach the report JSON to the decoded-shape issue form when a terminal output is only partially mapped.

## Verification

- `npm run check` passes.
- Exported report includes package version and source provenance.
- Export rejects wallet, signer, transaction, instruction, order, private key, seed, mnemonic, and API key fields.
- Live cockpit can generate a report from `examples/percolator-cli.bundle.json`.
