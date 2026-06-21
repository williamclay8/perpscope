# PerpScope Outreach Loop

Goal: get three real decoded Percolator shapes from terminal builders so the adapter improves around live data, not imaginary fixtures.

## Ask

Send one sanitized read-only decoded Percolator output shape and the trader-facing question it should answer.

Use the issue form:

https://github.com/williamclay8/perpscope/issues/new?template=decoded-percolator-shape.yml

## Targets

| loop | target | ask | success |
| --- | --- | --- | --- |
| Percolator builders | anyone working closest to the Percolator decoded output shape | one `slab:get`, `slab:engine`, or `best-price` capture | one compatibility issue labeled `compatibility` |
| Solana perps terminal builders | teams building front-end terminals or internal risk dashboards | one sanitized terminal export and the field they wish existed | one issue labeled `terminal-adapter` or `risk-signal` |
| Power users / perps traders | traders who inspect funding, skew, and liquidation runway manually | one screenshot/question describing what they wish a cockpit showed | one issue labeled `risk-signal` or `docs` |

## Message

I just shipped PerpScope, a read-only Percolator risk cockpit plus npm adapter for Solana perps terminals.

I am collecting real decoded shapes so the adapter maps actual terminal output instead of guessing.

Could you send one sanitized read-only capture and the trader-facing question it should answer?

Useful shapes:

- `slab:get`
- `slab:params`
- `slab:engine`
- `best-price`
- `execution:receipts`
- `funding-history`
- `list-markets`
- read-only RPC decoded account sections

Please do not include wallet paths, private keys, mnemonics, signers, signatures, transactions, instructions, order payloads, API keys, or user-identifying account data.

Intake:
https://github.com/williamclay8/perpscope/issues/new?template=decoded-percolator-shape.yml

Field map:
https://github.com/williamclay8/perpscope/blob/main/docs/field-compatibility-map.md

NPM adapter:
https://www.npmjs.com/package/@perpscope/percolator-adapter

Install:

```bash
npm install @perpscope/percolator-adapter
```

## Triage

- `compatibility`: new or drifting decoded field shape
- `fixture`: public sample that should land in `examples/`
- `risk-signal`: field that should become a Watchtower or carry signal
- `terminal-adapter`: package/API request
- `docs`: unclear setup or contract docs

## Done Criteria

- three outbound asks sent
- at least one real sanitized decoded shape received
- every received sample has a label and safety review
- reusable public samples become fixtures with tests
