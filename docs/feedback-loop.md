# PerpScope Feedback Loop

PerpScope needs real decoded Percolator shapes from terminal builders.

## Ask

Send one read-only decoded output shape and what you expected a trader to understand from it.

PerpScope v0.4 also shows a capture-intake compatibility report. If the cockpit marks a field as missing or ignored, include that row in your note.

Before sending a shape, you can compare it with `docs/field-compatibility-map.md` or `examples/field-compatibility-map.json` to see which aliases already map into the cockpit.

Best intake path: open the decoded shape issue form:

https://github.com/williamclay8/perpscope/issues/new?template=decoded-percolator-shape.yml

Useful inputs:

- `slab:get`
- `slab:params`
- `slab:engine`
- `best-price`
- `execution:receipts`
- `funding-history`
- `list-markets`
- read-only RPC account fixtures with decoded sections
- PerpScope snapshots or terminal DTO exports

Include:

- the command/source name
- cluster
- market, slab, and program provenance
- the trader-facing question the output should answer
- any PerpScope missing or ignored compatibility rows
- one sanitized JSON/stdout payload

Do not send wallet paths, private keys, mnemonics, signatures, transactions, instructions, order payloads, API keys, or user-identifying account data.

Sanitize before posting:

- replace real user/account labels with role labels like `read-only observer`
- remove wallet, signer, keypair, seed, mnemonic, API key, and private key fields
- remove transaction, instruction, order, send, and signing payloads
- keep public market provenance, slab/program ids, timestamps, slots, and numeric risk fields

## Public Reply

I’m collecting real read-only Percolator output shapes for PerpScope.

If you’re building a perps terminal, send one decoded shape and the trader-facing field you wish existed. I’ll make the adapter normalize it or document the compatibility gap.

Live: https://williamclay8.github.io/perpscope/
Repo: https://github.com/williamclay8/perpscope
Intake: https://github.com/williamclay8/perpscope/issues/new?template=decoded-percolator-shape.yml
Field map: https://github.com/williamclay8/perpscope/blob/main/docs/field-compatibility-map.md

## Intake Template

```text
Command/source:
Cluster:
Market:
Slab/program:
Expected trader question:
Fields present:
Fields missing:
PerpScope missing/ignored rows:
Sanitized payload:
Can this be added as a public fixture? yes/no
```

## Triage Labels

- `compatibility`: new or drifting decoded field shape
- `fixture`: public sample that should land in `examples/`
- `risk-signal`: field that should become a Watchtower/carry signal
- `terminal-adapter`: package/API request
- `docs`: unclear setup or contract docs

## Maintainer Loop

1. Reject or redact anything containing wallet paths, private keys, mnemonics, signatures, signers, transactions, instructions, order payloads, API keys, or user-identifying account data.
2. Run the payload through the capture intake or `buildPercolatorCompatibilityReport()`.
3. Label the issue with one or more triage labels.
4. If the shape is safe and reusable, add it as an `examples/` fixture and wire it into tests.
5. If the shape exposes a missing trader-facing concept, open a focused adapter or Watchtower issue and link it back to the sample.
