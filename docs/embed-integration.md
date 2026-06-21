# Embed Integration

PerpScope gives terminal builders two read-only integration paths:

- iframe widgets for a side rail, market drawer, or feed monitor
- `perpscope.export.v1` JSON for adapters that want to render their own UI

## Iframe Widgets

```html
<iframe
  title="PerpScope feed health"
  src="https://williamclay8.github.io/perpscope/?embed=feed">
</iframe>
```

```html
<iframe
  title="PerpScope hot market radar"
  src="https://williamclay8.github.io/perpscope/?embed=radar&filter=hot">
</iframe>
```

```html
<iframe
  title="PerpScope market risk"
  src="https://williamclay8.github.io/perpscope/?embed=market&market=wif-perp">
</iframe>
```

## Export Fixture

`examples/perpscope-export.sample.json` is a stable fixture for wiring parsers and visual mocks before a terminal has live decoded output.

```js
const response = await fetch(
  "https://raw.githubusercontent.com/williamclay8/perpscope/main/examples/perpscope-export.sample.json"
);
const payload = await response.json();

if (payload.schema !== "perpscope.export.v1") {
  throw new Error("Unexpected PerpScope export schema.");
}

const feedItems = new Map(payload.feedHealth.items.map((item) => [item.label, item.value]));
const topMarket = payload.radar.rows[0];
const reasons = payload.market.whyHot.reasons.map((reason) => ({
  label: reason.label,
  value: reason.value,
  tone: reason.tone
}));

console.log({
  market: payload.market.name,
  heat: topMarket.scoreLabel,
  feed: {
    markets: feedItems.get("markets"),
    slot: feedItems.get("slot"),
    unitChecks: feedItems.get("unit checks"),
    gaps: feedItems.get("gaps")
  },
  reasons,
  readOnly: payload.safety
});
```

Live decoded protocol snapshots are available from the hosted decoder worker:

```js
const response = await fetch("https://perpscope-decoder-worker.onrender.com/perpscope.json", {
  cache: "no-store",
  credentials: "omit"
});
const decodedSnapshot = await response.json();
```

Use the PerpScope app or `@perpscope/percolator-adapter` to normalize decoded snapshots into the cockpit DTOs.

## Fields To Trust

Treat these as stable display inputs for terminal surfaces:

- `schema`, `version`, and `generatedAt` for parser gating
- `selection.market`, `selection.filter`, and `selection.shareUrl` for deep links
- `source.live`, `source.provider`, `source.mode`, and `source.currentSlot` for provenance
- `feedHealth.items` and `feedHealth.chips` for source confidence
- `radar.rows` for ranked market heat
- `market.whyHot.reasons` for compact trader-facing explanations
- `adapterTargets.targets` for terminal placement hints
- `safety` for the read-only boundary

Treat `unit checks`, stale `age`, high `gaps`, and warning/danger tones as display cautions. They are not trade recommendations.

## Safety

Embeds and exports are read-only. PerpScope does not include wallets, signers, transactions, instructions, order routing, private keys, or trade execution controls.
