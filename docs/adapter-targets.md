# Adapter Targets

PerpScope v1.8 exposes read-only shapes that terminal builders can copy, export, or embed.

## Terminal Rail

Use `perpscope.export.v1.radar.rows` for a market list with `id`, `name`, `heat`, `tone`, `detail`, `scoreLabel`, and `qualityLabel`.

## Risk Overlay

Use `perpscope.export.v1.market.whyHot` plus `market.flags`, `market.account`, and `market.marketStructure` to place risk context beside an existing order ticket.

## Execution Lane

Use `market.execution` for spread, impact, fill quality, markout, and receipt availability. PerpScope marks this target partial when richer receipt fields are missing.

## Feed Monitor

Use `perpscope.export.v1.feedHealth` for source mode, market count, slot, age, unit checks, gaps, provider, and live-source chips.

## Embeds

PerpScope supports compact read-only embeds:

```text
?embed=feed
?embed=radar
?embed=market
```

Embeds also accept `?market=` and `?filter=` so terminals can deep-link a specific market and radar view.
