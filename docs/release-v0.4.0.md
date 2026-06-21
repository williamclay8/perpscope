# PerpScope v0.4.0

PerpScope v0.4.0 is the first fully useful terminal-builder release: the cockpit is live, the adapter is published on npm, and builders have a concrete compatibility map plus an intake loop for real decoded Percolator shapes.

## Highlights

- Read-only capture intake for pasted or dropped decoded Percolator output.
- `buildPercolatorCompatibilityReport(input, snapshot?)` for mapped sections, missing fields, ignored fields, score, and source provenance.
- Published npm adapter: `@perpscope/percolator-adapter@0.4.0`.
- Terminal builder quickstart: `docs/terminal-builder-quickstart.md`.
- Field compatibility map: `docs/field-compatibility-map.md`.
- Machine-readable field map: `examples/field-compatibility-map.json`.
- Decoded-shape issue intake form for terminal builders.
- Launch and outreach copy in `docs/launch-post.md` and `docs/outreach-loop.md`.
- v0.5 plan for compatibility report export in `docs/v0.5-plan.md`.

## Install

```bash
npm install @perpscope/percolator-adapter
```

## Links

- Live cockpit: https://williamclay8.github.io/perpscope/
- NPM package: https://www.npmjs.com/package/@perpscope/percolator-adapter
- Field map: https://github.com/williamclay8/perpscope/blob/main/docs/field-compatibility-map.md
- Quickstart: https://github.com/williamclay8/perpscope/blob/main/docs/terminal-builder-quickstart.md
- Intake form: https://github.com/williamclay8/perpscope/issues/new?template=decoded-percolator-shape.yml

## Safety Boundary

PerpScope remains read-only. It does not connect wallets, sign, send, route, place orders, submit transactions, or recommend trades. Captures with wallet paths, private keys, mnemonics, seeds, signers, transactions, instructions, order payloads, API keys, or user-identifying account data should be rejected or redacted.

## Verification

- `npm run check` passed: static gate, 57 node tests, static build.
- `npm view @perpscope/percolator-adapter version` returns `0.4.0`.
- Temporary external install/import smoke passed.
- GitHub Pages deploy for docs commit `3527c825996f8afe439c91b3b765458322ffac60` succeeded.
- Live docs verified under `https://williamclay8.github.io/perpscope/`.
