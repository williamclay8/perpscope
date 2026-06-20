# PerpScope Launch Notes

## GitHub Release Angle

PerpScope v0.3 is a read-only Percolator risk cockpit and embeddable terminal adapter kit for Solana perps builders.

It turns decoded slab, oracle, crank, account, funding, execution, receipt history, and carry history into a clean cockpit traders can scan without connecting a wallet. Watchtower compresses that data into six read-only signals: runway, freshness, execution, impact curve, carry, and solvency. The adapter accepts PerpScope snapshots, captured Percolator CLI stdout, `list-markets`, `slab:get`, `slab:params`, `slab:engine`, `best-price`, `execution:receipts`, `funding-history`, `slab:account`, `slab:accounts`, `slab:bitmap`, and deployment-style read-only RPC fixtures.

What is included:

- cockpit UI with health, Watchtower signals, carry history, liquidation runway, protocol freshness, account risk, execution quality, receipt timeline, and flags
- embeddable `packages/percolator-adapter` entrypoint for terminal teams
- low-friction `Try CLI` demo and drag/drop import path
- JSON schemas for snapshots, CLI bundles, read-only RPC fixtures, and funding/skew history
- read-only RPC fetcher scaffold with owner, data length, magic, and mutating-field validation
- two deployment-read fixtures with source, owner, data length, magic, decoded-section, and oracle freshness expectations
- terminal import/export recipe manifest covering file import, drag/drop stdout, command bundles, list-markets, read-only RPC, carry history, and DTO export
- tests that keep raw protocol integers out of USD displays unless explicitly normalized
- receipt and carry-history imports from terminal logs with source timestamp and slot provenance

## Short Post

Shipped PerpScope v0.3: an embeddable Percolator adapter package plus funding/skew carry history for the cockpit.

It loads decoded snapshots, captured CLI stdout, `list-markets`, slab account/bitmap output, receipt history, carry history, and read-only RPC fixtures, then turns that into a clean risk cockpit with Watchtower signals and no wallet/sign/send path.

Live: https://williamclay8.github.io/perpscope/
Repo: https://github.com/williamclay8/perpscope

## X Post

Built PerpScope v0.3: a read-only Percolator risk cockpit + embeddable terminal adapter kit for Solana perps builders.

It now exposes `packages/percolator-adapter`, adds funding/skew carry history, and keeps the cockpit read-only: no wallet, signing, sending, routing, or trade recommendation path.

Live: https://williamclay8.github.io/perpscope/
Repo: https://github.com/williamclay8/perpscope

## X Thread

1. Built PerpScope v0.3: a read-only Percolator risk cockpit + embeddable terminal adapter kit for Solana perps builders.

2. The idea: terminal teams should be able to turn decoded slab, oracle, crank, account, funding, execution, receipt, and carry-history data into something traders can actually scan.

3. Watchtower compresses that into six signals: runway, freshness, execution, impact curve, carry, and solvency.

4. The cockpit also includes health, carry history, liquidation runway, protocol freshness, account risk, execution quality, flags, and a receipt timeline for spread, impact, 1m/5m markout, latency, priority fee, and source time.

5. v0.3 adds `packages/percolator-adapter`, a side-effect-free package entrypoint for normalized DTOs, read-only RPC helpers, Watchtower signals, and funding/skew history.

6. It also adds terminal import/export recipes for file import, drag/drop stdout, command bundles, `list-markets`, read-only RPC, carry history, and DTO export.

7. No wallet connection. No signing. No sending. No routing. Just observability and simulation.

Live: https://williamclay8.github.io/perpscope/
Repo: https://github.com/williamclay8/perpscope

## Community Blurb

I shipped PerpScope v0.3, a read-only Percolator risk cockpit and embeddable terminal adapter kit for Solana perps builders.

It is meant for frontend/terminal teams that need to normalize decoded protocol output and show risk clearly: liquidation runway, oracle/crank freshness, funding/skew pressure, account risk, execution quality, impact pressure, solvency, receipt history, and carry history. It imports CLI bundles, captured stdout, read-only RPC fixtures, `execution:receipts`, and `funding-history` logs.

Live demo: https://williamclay8.github.io/perpscope/
Repo: https://github.com/williamclay8/perpscope

Feedback I want: what receipt/risk fields should a perps terminal adapter expose next?

## Manual Share Checklist

- X: use the short post or thread above with `docs/screenshots/perpscope-watchtower.png`.
- Solana/Percolator builder chats: use the community blurb and ask for missing adapter fields.
- GitHub profile/pinned repos: pin `williamclay8/perpscope` after v0.3.0.
- Follow-up loop: watch stars, issues, and inbound comments for adapter-package requests, missing Percolator fields, and funding/skew history import shapes.

## Safety Line

PerpScope is observability tooling. It does not connect wallets, sign, send, route, place orders, or make trading recommendations.
