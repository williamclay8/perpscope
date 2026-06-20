# PerpScope Launch Notes

## GitHub Release Angle

PerpScope is a read-only Percolator risk cockpit and terminal adapter kit for Solana perps builders.

It turns decoded slab, oracle, crank, account, funding, execution, and receipt history into a clean cockpit traders can scan without connecting a wallet. Watchtower compresses that data into six read-only signals: runway, freshness, execution, impact curve, carry, and solvency. The adapter accepts PerpScope snapshots, captured Percolator CLI stdout, `list-markets`, `slab:get`, `slab:params`, `slab:engine`, `best-price`, `execution:receipts`, `slab:account`, `slab:accounts`, and `slab:bitmap`.

What is included:

- cockpit UI with health, Watchtower signals, liquidation runway, protocol freshness, account risk, execution quality, receipt timeline, and flags
- low-friction `Try CLI` demo and drag/drop import path
- JSON schemas for snapshots, CLI bundles, and read-only RPC fixtures
- read-only RPC fetcher scaffold with owner, data length, magic, and mutating-field validation
- tests that keep raw protocol integers out of USD displays unless explicitly normalized
- receipt imports from terminal logs with spread, impact, 1m/5m markout, route latency, priority fee, and source timestamp

## Short Post

Shipped PerpScope: a read-only Percolator risk cockpit + terminal adapter kit for Solana perps builders.

It loads decoded snapshots, captured CLI stdout, `list-markets`, slab account/bitmap output, receipt history, and read-only RPC fixtures, then turns that into a clean risk cockpit with Watchtower signals and no wallet/sign/send path.

Live: https://williamclay8.github.io/perpscope/
Repo: https://github.com/williamclay8/perpscope

## X Post

Built PerpScope Watchtower: a read-only Percolator risk cockpit + terminal adapter kit for Solana perps builders.

It turns decoded slab/account/oracle/execution logs into scan-friendly signals for runway, freshness, execution, impact curve, carry, solvency, and receipt history.

Live: https://williamclay8.github.io/perpscope/
Repo: https://github.com/williamclay8/perpscope

## X Thread

1. Built PerpScope Watchtower: a read-only Percolator risk cockpit + terminal adapter kit for Solana perps builders.

2. The idea: terminal teams should be able to turn decoded slab, oracle, crank, account, funding, execution, and receipt data into something traders can actually scan.

3. Watchtower compresses that into six signals: runway, freshness, execution, impact curve, carry, and solvency.

4. The cockpit also includes health, liquidation runway, protocol freshness, account risk, execution quality, flags, and a receipt timeline for spread, impact, 1m/5m markout, latency, priority fee, and source time.

5. It accepts PerpScope snapshots, captured CLI stdout, `list-markets`, `slab:*`, `best-price`, `execution:receipts`, and read-only RPC fixtures.

6. No wallet connection. No signing. No sending. No routing. Just observability and simulation.

Live: https://williamclay8.github.io/perpscope/
Repo: https://github.com/williamclay8/perpscope

## Community Blurb

I shipped PerpScope Watchtower, a read-only Percolator risk cockpit and terminal adapter kit for Solana perps builders.

It is meant for frontend/terminal teams that need to normalize decoded protocol output and show risk clearly: liquidation runway, oracle/crank freshness, funding pressure, account risk, execution quality, impact pressure, solvency, and receipt history. It imports CLI bundles, captured stdout, read-only RPC fixtures, and `execution:receipts` logs.

Live demo: https://williamclay8.github.io/perpscope/
Repo: https://github.com/williamclay8/perpscope

Feedback I want: what receipt/risk fields should a perps terminal adapter expose next?

## Manual Share Checklist

- X: use the short post or thread above with `docs/screenshots/perpscope-watchtower.png`.
- Solana/Percolator builder chats: use the community blurb and ask for missing adapter fields.
- GitHub profile/pinned repos: pin `williamclay8/perpscope` after v0.1.0.
- Follow-up loop: watch stars, issues, and inbound comments for 48 hours before choosing v0.2 scope.

## Safety Line

PerpScope is observability tooling. It does not connect wallets, sign, send, route, place orders, or make trading recommendations.
