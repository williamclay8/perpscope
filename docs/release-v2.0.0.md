# PerpScope v2.0.0

PerpScope v2.0 turns the embed layer into a schema-locked terminal integration kit.

## Shipped

- Adds `schemas/perpscope-export.schema.json` for the `perpscope.export.v1` contract.
- Adds package helpers: `parsePerpScopeExport()`, `summarizePerpScopeExport()`, `summarizeFeedHealth()`, and `rankRadarRows()`.
- Adds `examples/copy-integration/`, a live copy page for iframe snippets, npm parser imports, schema links, and terminal placement.
- Updates `examples/embed-consumer/` into a richer terminal side-rail mock that consumes the same export contract.
- Bumps the app export and `@perpscope/percolator-adapter` package surfaces to `2.0.0`.
- Documents the install-and-embed path in the README and `docs/embed-integration.md`.

## Safety

The v2.0 integration kit remains read-only. The schema requires `wallet`, `signer`, `transaction`, and `orderRouting` to be false, and the helpers reject exports that do not declare that safety boundary.

## Live

```text
https://williamclay8.github.io/perpscope/
https://williamclay8.github.io/perpscope/examples/copy-integration/
https://williamclay8.github.io/perpscope/examples/embed-consumer/
https://williamclay8.github.io/perpscope/examples/perpscope-export.sample.json
https://williamclay8.github.io/perpscope/schemas/perpscope-export.schema.json
```
