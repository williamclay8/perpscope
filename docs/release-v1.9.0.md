# PerpScope v1.9.0

PerpScope v1.9 makes the export and embed layer easier for other terminals to copy.

## Shipped

- Adds `docs/embed-integration.md` with copy-paste `?embed=feed`, `?embed=radar`, and `?embed=market` examples.
- Adds `examples/perpscope-export.sample.json`, a stable `perpscope.export.v1` fixture for parser tests and terminal mocks.
- Adds `examples/embed-consumer/`, a tiny read-only iframe plus JSON parsing example.
- Bumps the cockpit export version to `1.9.0`.
- Keeps the hosted live decoded worker path documented for terminals that want live Percolator source data.

## Safety

PerpScope embeds and exports stay observational. They expose feed health, ranked risk context, selected market display fields, why-hot reasons, and adapter target hints. They do not include wallets, signers, transactions, order routes, private keys, or trade execution controls.

## Live

```text
https://williamclay8.github.io/perpscope/
https://williamclay8.github.io/perpscope/?embed=feed
https://williamclay8.github.io/perpscope/?embed=radar&filter=hot
https://williamclay8.github.io/perpscope/?embed=market&market=wif-perp
https://williamclay8.github.io/perpscope/examples/embed-consumer/
```
