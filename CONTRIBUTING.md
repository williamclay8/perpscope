# Contributing

PerpScope welcomes sanitized, read-only decoded shapes and adapter mapping reports.

## Submit A Sanitized Capture

Use the decoded shape issue form:

https://github.com/williamclay8/perpscope/issues/new?template=decoded-percolator-shape.yml

Useful submissions include:

- source kind, command, cluster, market, slab, and program
- `perpscope compat doctor <capture.json> --json` output
- the trader-facing question the capture should answer
- one sanitized JSON payload or captured stdout sample

## Do Not Include

Never submit wallet paths, private keys, mnemonics, seeds, wallet adapters, signers, signatures, transactions, instructions, order payloads, API keys, or user-identifying account data.

If you are unsure whether a field is public-safe, redact it and describe the field shape instead.

## Local Checks

```bash
npm run check
npx perpscope compat doctor examples/capture-template.json --strict
```

## What Issue #16 Needs

Issue #16 tracks the first third-party sanitized decoded Percolator shape. A closing-quality submission should:

- come from outside the maintainer-provided synthetic or real-backed candidate fixtures
- pass the safety checklist
- include enough market identity and price data for `required: 3/3`
- clearly state whether it can become a public fixture under `examples/`

## Mapping Requests

If PerpScope reports ignored fields or alias suggestions, open:

https://github.com/williamclay8/perpscope/issues/new?template=adapter-mapping-request.yml

Attach the doctor output and the smallest sanitized payload that demonstrates the mapping gap.
