# PerpScope v1.6.0

PerpScope v1.6 makes the hosted site feel live immediately.

## Shipped

- Auto-loads the hosted Percolator decoder worker on the public GitHub Pages site.
- Keeps fixture mode available with `?fixture=1` or disables live boot with `?live=0`.
- Adds a compact Data Confidence strip for decoded live status, market count, unit-checked markets, normalized markets, and read-only wallet posture.
- Adds Trader Radar filters: All, Hot, Unit checked, Normalized, and Fresh.
- Adds a visible `Load Percolator` loading state and a clearer fallback note when the live source is unavailable.

## Safety

PerpScope remains read-only. The automatic live load fetches decoded public protocol state only; it does not connect wallets, sign transactions, submit orders, route trades, or provide trade recommendations.

## Live

```text
https://williamclay8.github.io/perpscope/
https://perpscope-decoder-worker.onrender.com/perpscope.json
```
