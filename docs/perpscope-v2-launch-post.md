# PerpScope v2 Launch Post

PerpScope v2 is a schema-locked, read-only risk rail for Solana perps terminals.

It gives terminal builders:

- `perpscope.export.v1` JSON for feed health, Trader Radar, why-hot reasons, and adapter targets
- `@perpscope/percolator-adapter@2.0.0` with `summarizePerpScopeExport()`, `parsePerpScopeExport()`, `summarizeFeedHealth()`, and `rankRadarRows()`
- iframe embeds for `?embed=feed`, `?embed=radar`, and `?embed=market`
- a React risk rail example
- a live copy page and terminal mock

Links:

```text
https://www.npmjs.com/package/@perpscope/percolator-adapter
https://williamclay8.github.io/perpscope/examples/copy-integration/
https://williamclay8.github.io/perpscope/examples/embed-consumer/
https://williamclay8.github.io/perpscope/schemas/perpscope-export.schema.json
https://github.com/williamclay8/perpscope/releases/tag/v2.0.0
```

Safety boundary: no wallet connection, no signing, no transaction submission, no order routing, no trade recommendations.
