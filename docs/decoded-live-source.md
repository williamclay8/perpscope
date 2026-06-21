# Decoded Live Source Contract

PerpScope can load a live decoded Percolator source from:

```text
?decodedSource=https://your-decoder.example/perpscope.json
```

or from a page-level global:

```js
window.PERPSCOPE_DECODED_SOURCE_URL = "https://your-decoder.example/perpscope.json";
```

The endpoint must be CORS-readable by the browser and return sanitized JSON. HTTPS is required outside localhost development.

## Accepted Payloads

Return either:

- a PerpScope snapshot with `source` and `markets`
- a read-only RPC decoded account bundle with `account.decoded`

The source block must declare:

```json
{
  "source": {
    "kind": "decoded-percolator-live-source",
    "provider": "your decoder or terminal name",
    "generatedAt": "2026-06-21T12:00:00.000Z",
    "live": true,
    "scope": "live decoded protocol state"
  }
}
```

The `source.live` value must be `true`; otherwise PerpScope keeps the current source loaded and reports the decoded feed as unavailable.

Raw Solana `getAccountInfo` account bytes are not enough. The decoder endpoint needs the Percolator layout, IDL, SDK, or terminal-owned decoder before PerpScope can render trader-readable risk.

## Safety Boundary

Do not include wallet paths, private keys, mnemonics, seeds, signers, signatures, transactions, instructions, order payloads, API keys, or user-identifying account data.

PerpScope still rejects secret-bearing and mutating fields before display. It does not connect wallets, sign, send, route, place orders, submit transactions, or provide trade recommendations.

## Local Smoke Test

Run the app and point the decoded source to the sample payload:

```bash
npm start
```

Then open:

```text
http://127.0.0.1:4173/?decodedSource=./examples/decoded-live-source.sample.json
```

Click `Load Decoded`. The Data Source panel should switch to `decoded` and show `live decoded protocol state`.

## Production Decoder Options

- Official Percolator IDL or binary layout decoder hosted as a CORS read-only endpoint.
- Terminal team endpoint that already normalizes Percolator accounts and receipts.
- Indexer worker that fetches accounts, validates owner/data length/discriminators, decodes the account sections, and emits the snapshot contract above.

Keep the decoder server-side if the layout, RPC provider terms, rate limits, or terminal integration details should not live in the public browser bundle.

## Recommended Percolator Decoder Path

Public research currently points to a layout/SDK decoder path rather than a reliable hosted decoded-state API:

```text
@percolatorct/sdk -> market address directory -> getMultipleAccounts -> SDK layout parser -> PerpScope snapshot
```

Use `@percolatorct/sdk` as the decoder source. Its public package metadata identifies the package as `@percolatorct/sdk` v3.0.0, and its program-id config lists the mainnet Percolator program as `ESa89R5Es3rJ5mnwGybVRG1GrNt9etP11Z5V2QWD4edv`. The SDK discovery code includes a REST-directory fallback and a `getMarketsByAddress()` path that fetches slab accounts with Solana `getMultipleAccounts`.

Discovery order for a hosted decoder worker:

1. Use a configured/static allowlist of slab addresses when possible.
2. Use `https://percolatorlaunch.com/api/markets` as an address directory when available.
3. Use premium RPC `getProgramAccounts` only when the RPC provider supports it.
4. Fetch accounts with `getMultipleAccounts`, verify the owner/program id, decode with the SDK layout parser, and emit the PerpScope contract.

The address directory is not the source of truth for market state. Treat it as a list of accounts to verify and decode from Solana RPC.
