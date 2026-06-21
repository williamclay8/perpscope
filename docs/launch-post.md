# PerpScope Launch Post

## Short Post

PerpScope is live: a read-only Percolator risk cockpit plus an npm adapter kit for Solana perps terminals.

It turns decoded perps output into scan-friendly risk:

- liquidation runway
- oracle and crank freshness
- funding and OI-skew pressure
- execution quality and receipt markout
- solvency and social-loss context
- compatibility reports for messy terminal captures

No wallet adapter. No signing. No order entry.

Install:

```bash
npm install @perpscope/percolator-adapter
```

Live cockpit:
https://williamclay8.github.io/perpscope/

Repo:
https://github.com/williamclay8/perpscope

If you are building a Solana perps terminal, send one sanitized decoded Percolator shape here:
https://github.com/williamclay8/perpscope/issues/new?template=decoded-percolator-shape.yml

## Builder-Focused Post

Shipping PerpScope for Solana perps terminal builders.

The useful bit is not another trading UI. It is a read-only adapter boundary:

```bash
npm install @perpscope/percolator-adapter
```

Give it decoded Percolator-like output. It gives you:

- normalized terminal DTOs
- Watchtower risk signals
- funding/skew carry history
- a compatibility report with mapped, missing, and ignored fields
- a field map for accepted aliases

The hard rule: no wallet, no signer, no transaction, no order payload.

PerpScope is for observability, simulation, and safer frontend data flow.

Live:
https://williamclay8.github.io/perpscope/

Adapter:
https://www.npmjs.com/package/@perpscope/percolator-adapter

Field map:
https://github.com/williamclay8/perpscope/blob/main/docs/field-compatibility-map.md

## Direct Reply

If your terminal can export one sanitized decoded Percolator shape, I can make PerpScope normalize it or document the compatibility gap.

Issue form:
https://github.com/williamclay8/perpscope/issues/new?template=decoded-percolator-shape.yml
