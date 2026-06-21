# React Risk Rail Example

This is the smallest React version of the PerpScope side rail.

It imports `summarizePerpScopeExport()` from `@perpscope/percolator-adapter`, reads `examples/perpscope-export.sample.json`, and renders:

- market and heat
- feed health
- unit checks and gaps
- read-only safety status
- why-hot reason chips

```bash
cd examples/react-risk-rail
npm install
npm run dev
```

The component stays read-only. It does not connect wallets, sign, send, route, place orders, or submit transactions.
