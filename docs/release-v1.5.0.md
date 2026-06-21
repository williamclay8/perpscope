# PerpScope v1.5.0

PerpScope v1.5 makes the live Percolator feed easier for traders to use.

## Shipped

- Added a default hosted live source: `https://perpscope-decoder-worker.onrender.com/perpscope.json`.
- Renamed the decoded action to `Load Percolator` so users can load the live worker without adding a query string.
- Added a Trader Radar panel that ranks markets by heat across flags, stress, skew, funding pressure, oracle age, and unit-confidence checks.
- Added decoded sanity checks in the worker so raw-scale or unit-ambiguous values are hidden instead of displayed as polished USD.
- Preserved `dataQuality` metadata through the terminal DTO so the cockpit can show normalized versus unit-checked markets.
- Allowed localhost CORS previews for the hosted worker while keeping the production origin explicit.

## Safety

PerpScope remains read-only. The live worker does not connect wallets, sign transactions, submit orders, route trades, or provide trade recommendations. Unit-ambiguous decoded fields are labeled and hidden from headline risk math until their scale is trustworthy.

## Live

```text
https://williamclay8.github.io/perpscope/
https://perpscope-decoder-worker.onrender.com/perpscope.json
```
