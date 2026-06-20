# PerpScope Feedback Loop

PerpScope needs real decoded Percolator shapes from terminal builders.

## Ask

Send one read-only decoded output shape and what you expected a trader to understand from it.

PerpScope v0.4 also shows a capture-intake compatibility report. If the cockpit marks a field as missing or ignored, include that row in your note.

Useful inputs:

- `slab:get`
- `slab:params`
- `slab:engine`
- `best-price`
- `execution:receipts`
- `funding-history`
- `list-markets`
- read-only RPC account fixtures with decoded sections

Do not send wallet paths, private keys, mnemonics, signatures, transactions, instructions, order payloads, API keys, or user-identifying account data.

## Public Reply

I’m collecting real read-only Percolator output shapes for PerpScope.

If you’re building a perps terminal, send one decoded shape and the trader-facing field you wish existed. I’ll make the adapter normalize it or document the compatibility gap.

Live: https://williamclay8.github.io/perpscope/
Repo: https://github.com/williamclay8/perpscope

## Intake Template

```text
Command/source:
Cluster:
Market:
Expected trader question:
Fields present:
Fields missing:
PerpScope missing/ignored rows:
Can this be added as a public fixture? yes/no
```

## Triage Labels

- `compatibility`: new or drifting decoded field shape
- `fixture`: public sample that should land in `examples/`
- `risk-signal`: field that should become a Watchtower/carry signal
- `terminal-adapter`: package/API request
- `docs`: unclear setup or contract docs
