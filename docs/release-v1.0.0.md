# PerpScope v1.0.0

PerpScope v1.0.0 makes the adapter feel installable and automation-ready for terminal teams.

## Shipped

- Published npm adapter: `@perpscope/percolator-adapter@1.0.0`.
- CLI command: `perpscope init [output.json] [--force]`.
- CI-ready `perpscope compat doctor <capture.json> [--strict|--json]` exit codes.
- README 2-minute terminal-builder check.

## Builder Flow

```bash
npm install @perpscope/percolator-adapter
npx perpscope init perpscope.capture.json
npx perpscope compat doctor perpscope.capture.json --strict
npx perpscope compat badge perpscope.capture.json
```

Doctor exit codes:

- `0`: required fields pass
- `1`: rejected capture or required fields missing
- `2`: strict mode found useful-field gaps, unknown fields, or alias suggestions

## Safety Boundary

The init template, doctor, badge, compatibility report, CLI, and cockpit remain read-only. They reject wallet, signer, transaction, instruction, order, private key, seed, mnemonic, and API key fields, and they do not connect wallets, sign, send, route, place orders, submit transactions, or generate trade recommendations.

## Verification

- `npm run check` passes.
- `perpscope init` is covered by tests.
- Doctor exit codes `0`, `1`, and `2` are covered by tests.
- npm package import and CLI help are verified from a fresh external install.
