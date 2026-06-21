# PerpScope v1.7.0

PerpScope v1.7 turns the live cockpit into a more useful trader and builder surface.

## Shipped

- Adds a Why Hot panel that explains the selected market's heat with stress, skew, carry, freshness, spread, and decode confidence.
- Adds a Feed Health panel for market count, slot, age, unit checks, gaps, and decoder source.
- Adds shareable cockpit links with `?market=` and `?filter=` state.
- Adds Adapter Targets for terminal rails, risk overlays, execution lanes, and feed monitors.
- Keeps the public site auto-loading the hosted read-only Percolator decoder worker.

## Safety

PerpScope remains read-only. The new explanations are data-quality and risk-context summaries only; they do not connect wallets, sign transactions, submit orders, route trades, or provide trade recommendations.

## Live

```text
https://williamclay8.github.io/perpscope/
https://perpscope-decoder-worker.onrender.com/perpscope.json
```
