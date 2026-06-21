# PerpScope v1.8.0

PerpScope v1.8 makes the live cockpit usable outside the PerpScope page.

## Shipped

- Adds `perpscope.export.v1`, a read-only JSON export for feed health, radar rows, selected market context, why-hot reasons, and adapter targets.
- Adds embeddable views with `?embed=feed`, `?embed=radar`, and `?embed=market`.
- Adds Export Hub controls for cockpit JSON, radar JSON, current market JSON, and embed URLs.
- Adds adapter target docs for terminal rails, risk overlays, execution lanes, and feed monitors.
- Keeps public-site live Percolator auto-load and shareable `?market=` / `?filter=` state.

## Safety

PerpScope exports and embeds remain read-only. They expose normalized display data and source health only; they do not include wallets, signers, transactions, order routes, private keys, or trade execution controls.

## Live

```text
https://williamclay8.github.io/perpscope/
https://williamclay8.github.io/perpscope/?embed=feed
https://williamclay8.github.io/perpscope/?embed=radar&filter=hot
https://williamclay8.github.io/perpscope/?embed=market&market=devnet-small-1
```
