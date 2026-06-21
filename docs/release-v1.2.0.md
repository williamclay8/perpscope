# PerpScope v1.2.0

PerpScope v1.2.0 adds actual public market prices to the website without pretending those prices are live decoded Percolator account state.

## Shipped

- Added `Load Live` to the Data Source panel.
- Added a read-only browser fetch against the CoinGecko simple price endpoint for SOL, BTC, and WIF public USD prices.
- The cockpit now updates visible mark prices, price paths, receipt tick rows, and simulated account PnL from actual public prices.
- The Data Source panel labels this mode as actual public prices with simulated risk context.
- Failure keeps the previous source visible and reports that live public prices are unavailable instead of silently falling back to fixture data.

## Safety Boundary

PerpScope still does not connect wallets, sign transactions, submit orders, or provide trade recommendations. `Load Live` is actual public price data, not live decoded protocol state. Funding, OI, margin, and account risk remain simulated Percolator context until a decoded Percolator live data source is wired.
