# PerpScope v1.3.0

PerpScope v1.3 adds the decoded live source intake.

## Shipped

- Added `Load Decoded` to the Data Source panel.
- Added `?decodedSource=https://...` and `window.PERPSCOPE_DECODED_SOURCE_URL` as the clean, no-textbox connection path for CORS-readable decoded protocol feeds.
- Added URL/protocol validation, live-source validation, and a raw-account-data guard so PerpScope does not label undecoded bytes as decoded protocol state.
- Added `examples/decoded-live-source.sample.json` for local and deployed smoke tests.
- Added `docs/decoded-live-source.md` with the endpoint contract for terminal teams and decoder workers.
- Documented the recommended Percolator decoder path: `@percolatorct/sdk`, an address directory such as `https://percolatorlaunch.com/api/markets`, Solana `getMultipleAccounts`, SDK layout parsing, and a PerpScope snapshot response.

## Safety

PerpScope remains read-only. It does not connect wallets, sign transactions, submit orders, route trades, or provide trade recommendations. The decoded live source path accepts sanitized decoded state only; raw Solana account data still needs a Percolator decoder before the cockpit can display it honestly.
