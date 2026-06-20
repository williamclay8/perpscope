# PerpScope Launch Notes

## GitHub Release Angle

PerpScope is a read-only Percolator risk cockpit and terminal adapter kit for Solana perps builders.

It turns decoded slab, oracle, crank, account, funding, execution, and receipt history into a clean cockpit traders can scan without connecting a wallet. The adapter accepts PerpScope snapshots, captured Percolator CLI stdout, `list-markets`, `slab:get`, `slab:params`, `slab:engine`, `best-price`, `execution:receipts`, `slab:account`, `slab:accounts`, and `slab:bitmap`.

What is included:

- cockpit UI with health, liquidation runway, protocol freshness, account risk, execution quality, receipt timeline, and flags
- low-friction `Try CLI` demo and drag/drop import path
- JSON schemas for snapshots, CLI bundles, and read-only RPC fixtures
- read-only RPC fetcher scaffold with owner, data length, magic, and mutating-field validation
- tests that keep raw protocol integers out of USD displays unless explicitly normalized
- receipt imports from terminal logs with spread, impact, 1m/5m markout, route latency, priority fee, and source timestamp

## Short Post

Shipped PerpScope: a read-only Percolator risk cockpit + terminal adapter kit for Solana perps builders.

It loads decoded snapshots, captured CLI stdout, `list-markets`, slab account/bitmap output, receipt history, and read-only RPC fixtures, then turns that into a clean risk cockpit with no wallet/sign/send path.

Live: https://williamclay8.github.io/perpscope/
Repo: https://github.com/williamclay8/perpscope

## Safety Line

PerpScope is observability tooling. It does not connect wallets, sign, send, route, place orders, or make trading recommendations.
