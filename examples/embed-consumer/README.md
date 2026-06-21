# Embed Consumer Example

This is a tiny terminal-side example for PerpScope embeds and `perpscope.export.v1`.

It shows three read-only iframe surfaces:

- feed health: `?embed=feed`
- hot market radar: `?embed=radar&filter=hot`
- selected market risk: `?embed=market&market=wif-perp`

It also parses `../perpscope-export.sample.json` into the fields a terminal side rail usually needs first: market, heat, feed health, why-hot reasons, and the read-only safety boundary.

```bash
cd examples/embed-consumer
npm run demo
```

Open `index.html` through the PerpScope static server to see the iframe version:

```bash
npm start
```

Then visit `http://127.0.0.1:4173/examples/embed-consumer/`.

The example stays observational. It does not connect wallets, sign, send, route, place orders, or submit transactions.
