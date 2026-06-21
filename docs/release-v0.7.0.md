# PerpScope v0.7.0

PerpScope v0.7.0 makes the project useful without outreach by adding a local compatibility workbench, CLI commands, and fixture packs.

## Shipped

- Published npm adapter: `@perpscope/percolator-adapter@0.7.0`.
- Cockpit compatibility workbench for comparing two captures side by side.
- CLI command: `perpscope compat report <capture.json>`.
- CLI command: `perpscope compat diff <previous.json> <current.json>`.
- Fixture packs:
  - `examples/fixture-pack-minimal-terminal.json`
  - `examples/fixture-pack-drifted-aliases.json`
  - `examples/fixture-pack-receipt-heavy-execution.json`
- Workbench diff export for `perpscope.compatibility-diff`.

## Builder Flow

```bash
npm install @perpscope/percolator-adapter
perpscope compat report examples/fixture-pack-drifted-aliases.json
perpscope compat diff examples/fixture-pack-minimal-terminal.json examples/fixture-pack-drifted-aliases.json
```

Use the cockpit workbench when you want the same comparison visually: paste a previous capture, paste a current capture, compare, then export the diff.

## Safety Boundary

The compatibility workbench and CLI remain read-only. They reject wallet, signer, transaction, instruction, order, private key, seed, mnemonic, and API key fields, and they do not connect wallets, sign, send, route, place orders, submit transactions, or generate trade recommendations.

## Verification

- `npm run check` passes.
- CLI report and diff commands are covered by tests.
- Fixture packs normalize through the adapter.
- Live cockpit renders the workbench without wallet or order-entry controls.
