# PerpScope v1.0.1

PerpScope v1.0.1 is an adoption and trust polish patch for new terminal builders landing on the repo or npm package.

## Shipped

- Published npm adapter: `@perpscope/percolator-adapter@1.0.1`.
- README first-screen cleanup for what PerpScope is, who it is for, the 2-minute terminal-builder check, and the read-only safety boundary.
- `CONTRIBUTING.md` with sanitized capture rules, local checks, and what issue #16 needs.
- New issue template: adapter mapping request.
- New issue template: CLI doctor output.
- npm README top-of-page polish for `perpscope init`, `compat doctor`, and `compat badge`.

## Safety Boundary

PerpScope remains read-only. It rejects wallet, signer, transaction, instruction, order, private key, seed, mnemonic, and API key fields, and it does not connect wallets, sign, send, route, place orders, submit transactions, or generate trade recommendations.

## Verification

- `npm run check` passes.
- Issue templates are covered by static checks.
- CONTRIBUTING and README adoption paths are covered by static checks.
