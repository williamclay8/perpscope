# PerpScope v1.1.0

PerpScope v1.1.0 makes the website honest at first glance: fixture data, static real-backed data, and unwired live data are now separate cockpit states.

## Shipped

- Published npm adapter: `@perpscope/percolator-adapter@1.1.0`.
- Added the Data Source cockpit panel so visitors can see whether the screen is using a local fixture, a static real-backed snapshot, or a live read-only stream.
- Added `examples/static-real-snapshot.json`, a sanitized static snapshot derived from the read-only RPC example path.
- Added `Load Snapshot` on the website to switch from the default fixture into the static real-backed sample while saying it is not a live stream.
- Extended checks and tests so the Data Source disclosure, static snapshot path, and adapter version stay aligned.

## Safety Boundary

PerpScope remains read-only. The public site does not connect wallets, submit transactions, route orders, or host a live RPC/indexer pipeline. The static real-backed snapshot is for terminal adapter development and UX validation, not for trading decisions.
