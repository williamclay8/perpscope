# Adapter Consumer Example

This is the smallest outside-terminal shape for using `@perpscope/percolator-adapter`.

It imports the package by name, loads a captured Percolator command bundle, and returns the fields a frontend trading terminal would usually want first: compatibility status, market status, health score, Watchtower signals, carry history, and source provenance.

```bash
cd examples/adapter-consumer
npm install
npm run demo
```

The dependency points at the local package while developing this repo:

```json
"@perpscope/percolator-adapter": "file:../../packages/percolator-adapter"
```

In an outside terminal package, install the published package:

```bash
npm install @perpscope/percolator-adapter
```

or use a version range:

```json
"@perpscope/percolator-adapter": "^0.6.0"
```

The example stays read-only. It does not connect wallets, sign, send, route, place orders, or submit transactions.
