# PerpScope v0.9.0

PerpScope v0.9.0 makes the terminal-builder trial path faster: one command to diagnose a capture, one command to produce a shareable badge, and one template to copy before opening an issue.

## Shipped

- Published npm adapter: `@perpscope/percolator-adapter@0.9.0`.
- New adapter helper: `buildCompatibilityDoctor()`.
- New adapter helper: `buildCompatibilityBadge()`.
- CLI command: `perpscope compat doctor <capture.json>`.
- CLI command: `perpscope compat badge <capture.json> [--json|--markdown]`.
- Copy-paste starter shape: `examples/capture-template.json`.

## Builder Flow

```bash
perpscope compat doctor examples/capture-template.json
perpscope compat badge examples/capture-template.json --json
```

The doctor reports shape, status, read-only safety, required mapped fields, useful mapped fields, unknown fields, alias suggestions, and next actions. The badge returns a compact Markdown or JSON artifact for READMEs, PRs, and fixture handoffs.

## Safety Boundary

The doctor, badge, compatibility report, CLI, and cockpit remain read-only. They reject wallet, signer, transaction, instruction, order, private key, seed, mnemonic, and API key fields, and they do not connect wallets, sign, send, route, place orders, submit transactions, or generate trade recommendations.

## Verification

- `npm run check` passes.
- CLI doctor and badge commands are covered by tests.
- The capture template normalizes through the adapter.
- npm package import exposes `buildCompatibilityDoctor()` and `buildCompatibilityBadge()`.
