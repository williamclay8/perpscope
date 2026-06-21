# Npm v2 Install Receipt

This receipt proves `@perpscope/percolator-adapter@2.0.0` works from a clean project outside the PerpScope repo.

## Environment

```text
Date: 2026-06-21
Directory: /private/tmp/perpscope-npm-smoke
Package: @perpscope/percolator-adapter@2.0.0
Fixture: https://williamclay8.github.io/perpscope/examples/perpscope-export.sample.json
```

## Commands

```bash
npm init -y
npm install @perpscope/percolator-adapter@2.0.0
node --input-type=module -e 'import { summarizePerpScopeExport, parsePerpScopeExport } from "@perpscope/percolator-adapter"; const response = await fetch("https://williamclay8.github.io/perpscope/examples/perpscope-export.sample.json"); if (!response.ok) throw new Error(`fixture ${response.status}`); const payload = parsePerpScopeExport(await response.json()); const summary = summarizePerpScopeExport(payload); console.log(JSON.stringify({ package: "@perpscope/percolator-adapter", version: "2.0.0", schema: payload.schema, market: summary.market, heat: summary.heat, readOnly: summary.readOnly, unitChecks: summary.feedHealth.unitChecks, gaps: summary.feedHealth.gaps }, null, 2));'
```

## Output

```json
{
  "package": "@perpscope/percolator-adapter",
  "version": "2.0.0",
  "schema": "perpscope.export.v1",
  "market": "WIF-PERP",
  "heat": "100 heat",
  "readOnly": true,
  "unitChecks": "0",
  "gaps": "0"
}
```

`npm install` reported `found 0 vulnerabilities` for the clean smoke project.

## Safety

The smoke test only imports parser helpers and fetches a public read-only fixture. It does not connect wallets, sign, send, route, place orders, submit transactions, or request secrets.
