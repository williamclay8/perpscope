# PerpScope v1.4.0

PerpScope v1.4 adds the read-only Percolator decoder worker.

## Shipped

- Added `scripts/percolator-decoder-worker.mjs`, a small HTTP service with `/perpscope.json` and `/healthz`.
- Added `src/lib/percolator-decoder-worker.js` to fetch a Percolator market directory, group slab accounts by program id, decode them through `@percolatorct/sdk`, and emit the PerpScope decoded live source contract.
- Added `render.yaml` for a Render web service named `perpscope-decoder-worker`.
- Added worker-thread bounded decode timeouts so slow SDK/RPC/source calls return `decoded_source_unavailable` instead of hanging the cockpit.
- Added tests for directory grouping, SDK-to-PerpScope mapping, injectable SDK/RPC seams, CORS, health-compatible HTTP serving, timeout handling, and safe RPC defaults.
- Added `npm run decoder:start` for local and hosted worker runs.

## Safety

The worker is read-only. It uses public market directories and Solana RPC reads, does not connect wallets, does not sign transactions, does not build transaction instructions, does not submit orders, and does not provide trade recommendations.

## Local Smoke

```bash
npm run decoder:start
curl -fsS http://127.0.0.1:8787/healthz
curl -fsS http://127.0.0.1:8787/perpscope.json
```

Then open PerpScope with:

```text
https://williamclay8.github.io/perpscope/?decodedSource=http://127.0.0.1:8787/perpscope.json
```
