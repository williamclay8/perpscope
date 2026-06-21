# PerpScope v0.8.0

PerpScope v0.8.0 adds a compact reality check layer so terminal builders can tell what is backed by decoded state, what is still synthetic, and what still needs a real submitted Percolator shape.

## Shipped

- Published npm adapter: `@perpscope/percolator-adapter@0.8.0`.
- New adapter helper: `buildCompatibilityRealityCheck()`.
- Cockpit reality check panel with required/useful mapped fields, unknown fields, alias count, provenance, and fixture status.
- Real-backed sanitized candidate fixture: `examples/fixture-pack-real-sanitized-rpc-shape.json`.
- Read-only RPC snapshot support for decoded execution receipts and funding/skew rows.

## Important Boundary

The new fixture is a maintainer-provided real-backed candidate derived from the existing read-only RPC deployment fixture. It improves product credibility, but it does not close the need for a third-party sanitized decoded shape. Issue #16 remains open for that.

## Safety Boundary

The reality check, compatibility report, CLI, and cockpit remain read-only. They reject wallet, signer, transaction, instruction, order, private key, seed, mnemonic, and API key fields, and they do not connect wallets, sign, send, route, place orders, submit transactions, or generate trade recommendations.

## Verification

- `npm run check` passes.
- Reality check output is covered by tests and static checks.
- The real-backed candidate fixture normalizes through the read-only RPC path.
- Live cockpit renders the reality check panel without wallet or order-entry controls.
