# PerpScope Field Compatibility Map

This map is the v0.4.0 implementation contract for terminal builders sending read-only Percolator-like output into PerpScope. It is source-grounded in:

- `src/lib/percolator-adapter.js`
- `src/lib/watchtower-signals.js`
- `src/lib/funding-history.js`

Machine-readable version: `examples/field-compatibility-map.json`.

## Compatibility Status

| status | meaning |
| --- | --- |
| `compatible` | All critical and useful fields are present, and no unmapped top-level fields or command names were found. |
| `partial` | PerpScope can render useful risk state, but at least one useful field is missing or ignored. |
| `unknown` | The capture does not match a known shape and does not expose enough mapped sections. |
| `rejected` | The capture includes secret-like or mutating fields and is refused before rendering. |

## Input Shapes

| shape | accepted containers |
| --- | --- |
| `perpscope-snapshot` | `{ source, cluster, currentSlot, markets: [...] }` |
| `percolator-cli-bundle` | `commands`, `command`, `slabHeader`, `slabConfig`, `slabEngine`, `slabBitmap`, `bestPrice`, `marketInfo`, `receipts`, `executionReceipts`, `receiptTimeline`, `fillReceipts`, `fills` |
| `read-only-rpc-fetch` | `slab` or `slabAddress`, `programId` or `program`, and `account` or `accountInfo` with decoded read-only sections |
| `funding-skew-history` | arrays or wrappers containing `fundingSkew`, `fundingHistory`, `fundingSkewHistory`, `history`, `rows`, or `items` |
| `percolator-market-array` | an array of market-like objects that is not recognized as carry history |
| `unknown` | any other object; mapped fields may still produce a partial report |

## Required And Useful Fields

Critical fields are needed for a high-quality cockpit that anchors risk to a market and computes runway math.

| field | severity | why it matters |
| --- | --- | --- |
| `market.slab` | danger | Anchors the view to one Percolator market. |
| `market.program` | danger | Lets a live terminal show decoded account ownership provenance. |
| `price.mark` | danger | Powers runway, impact, notional, and liquidation math. |

Useful fields make the cockpit trader-grade instead of merely renderable.

| field | severity | powers |
| --- | --- | --- |
| `price.publishAgeSec` | warning | Oracle freshness and stale-price warnings. |
| `crank.ageSlots` | warning | Crank freshness and lag warnings. |
| `funding.bpsPerHour` | warning | Carry card, carry history fallback, and funding pressure. |
| `marketStructure.openInterestUsd` | warning | OI skew, stress pressure, and carry context. |
| `account.positionNotionalUsd` | warning | Margin buffer, liquidation runway, and daily carry. |
| `execution.bestBid/bestAsk` | warning | Spread, execution quality, and book confidence. |
| `execution.receipts` | warning | Markout, latency, priority-fee, and fill-quality context. |
| `history.fundingSkew` | warning | Carry history trends beyond a single snapshot. |

## Alias Map

PerpScope accepts camelCase, snake_case, and common terminal wrapper names. Raw protocol integers are not treated as USD unless a field is explicitly USD-labeled or provides decimals.

### Market And Provenance

| normalized field | accepted aliases |
| --- | --- |
| market object | `market`, `marketInfo`, `metadata`, `instrument` |
| `market.id` | `id`, `marketId` |
| `market.name` | `symbol`, `name`, `market`, `ticker` |
| `market.base` | `base`, `baseSymbol`, `baseAsset` |
| `market.quote` | `quote`, `quoteSymbol`, `quoteAsset` |
| `market.slab` | `slab`, `slabAddress`, `address`, `pubkey` |
| `market.program` | `program`, `programId`, `owner` |
| `market.status` | `status` |
| `source.label` | `label`, `sourceLabel` |
| `cluster` | `cluster`, `network` |
| `currentSlot` | `currentSlot`, `slot`, `current_slot` |

### Config And Risk Params

| normalized field | accepted aliases |
| --- | --- |
| header | `slabHeader`, `slab:header`, `header` |
| config | `slabConfig`, `slab:config`, `config`, `marketConfig` |
| params | `slabParams`, `slab:params`, `params`, `riskParams` |
| `config.maxLeverage` | `maxLeverage`, `max_leverage` |
| `config.initialMarginBps` | `initialMarginBps`, `initial_margin_bps` |
| `config.maintenanceMarginBps` | `maintenanceMarginBps`, `maintenance_margin_bps` |
| `config.liquidationFeeBps` | `liquidationFeeBps`, `liquidation_fee_bps` |
| `config.fundingMaxPremiumBps` | `fundingMaxPremiumBps`, `funding_max_premium_bps` |
| `config.maxStalenessSecs` | `maxStalenessSecs`, `max_staleness_secs`, `maxOracleAgeSec` |
| `config.confFilterBps` | `confFilterBps`, `confidenceFilterBps` |
| `config.maxAccounts` | `maxAccounts`, `max_accounts` |

### Price And Oracle

| normalized field | accepted aliases |
| --- | --- |
| oracle object | `oracle`, `price`, `prices`, `oraclePrice` |
| `price.mark` | `markPrice`, `mark`, `priceUsd`, `oraclePriceUsd`, `price` with decimals, `oraclePrice` with decimals, `midPrice`, `mid`, `markPriceUsd`, `lastOraclePriceUsd`, `resolvedPriceUsd` |
| `price.index` | `indexPrice`, `index`, `oraclePriceUsd`, `priceUsd`, `oraclePrice` with decimals, `price` with decimals |
| `price.effective` | `effectivePrice`, `effectivePriceUsd` |
| `price.confidenceBps` | `confidenceBps`, `confidence_bps`, `confBps` |
| `price.publishAgeSec` | `publishAgeSec`, `ageSecs`, `ageSec`, `age` |
| `price.path` | `pricePath`, `path`, `history` |
| `price.legs` | `legs`, `sources` |
| price decimals | `decimals`, `priceDecimals`, `price_decimals` |

### Crank, Engine, Structure, And Solvency

| normalized field | accepted aliases |
| --- | --- |
| engine object | `engine`, `state`, `riskState`, `slabEngine`, `slab:engine` |
| bitmap object | `bitmap`, `slabBitmap`, `slab:bitmap` |
| `crank.lastSlot` | `lastCrankSlot`, `last_crank_slot` |
| `crank.ageSlots` | `crankAgeSlots`, `crank_age_slots`, `ageSlots`, or `currentSlot - lastMarketSlot` |
| `crank.catchupRequired` | `catchupRequired`, `catchup_required` |
| `crank.staleAccounts` | `staleAccounts`, `stale_accounts`, `staleAccountCount` |
| `crank.activeAccounts` | `activeAccounts`, `active_accounts`, `materializedAccountCount`, `numUsedAccounts`, `numUsed`, `usedAccounts`, `usedIndices`, `indices`, account rows |
| `crank.maxAccounts` | `maxAccounts`, `max_accounts`, `capacity` |
| `funding.bpsPerHour` | `fundingRateBpsPerHour`, `funding_bps_per_hour`, `fundingRate` |
| `funding.index` | `fundingIndex`, `funding_index` |
| `marketStructure.openInterestUsd` | `openInterestUsd`, `open_interest_usd`, `oiUsd` |
| `marketStructure.longOpenInterestUsd` | `longOpenInterestUsd`, `long_oi_usd` |
| `marketStructure.shortOpenInterestUsd` | `shortOpenInterestUsd`, `short_oi_usd` |
| `marketStructure.stressConsumedBps` | `stressConsumedBps`, `stress_consumed_bps`, `stressConsumedBpsE9SinceEnvelope` |
| `marketStructure.stressLimitBps` | `stressLimitBps`, `stress_limit_bps` |
| `solvency.insuranceUsd` | `insuranceUsd`, `insurance_usd` |
| `solvency.vaultUsd` | `vaultUsd`, `vault_usd` |
| `solvency.claimUsd` | `claimUsd`, `claim_usd` |
| `solvency.socialLossUsd` | `socialLossUsd`, `social_loss_usd` |
| `marketStructure.sideMode` | `sideMode`, `side_mode` |

### Account Runway

| normalized field | accepted aliases |
| --- | --- |
| account object | `account`, `position`, `traderAccount` |
| account rows | `accounts`, `positions` |
| `account.label` | `label`, `ownerLabel`, `name` |
| `account.side` | `side`, or inferred from signed position size |
| `account.positionSize` | `positionSize`, `basePosition`, `positionSizeBase`, `size`, `position` |
| `account.positionNotionalUsd` | `positionNotionalUsd`, `notionalUsd`, `notional`, or `abs(positionSize) * price.mark` |
| `account.collateralUsd` | `collateralUsd`, `equityCollateralUsd` |
| `account.unrealizedPnlUsd` | `unrealizedPnlUsd`, `unrealizedPnl`, `uPnl` |
| `account.realizedPnlUsd` | `realizedPnlUsd`, `realizedPnl` |
| `account.fundingPnlUsd` | `fundingPnlUsd`, `fundingPnl` |
| `account.maintenanceMarginUsd` | `maintenanceMarginUsd`, `maintenanceMargin`, or derived from notional and maintenance margin bps |
| `account.initialMarginUsd` | `initialMarginUsd`, `initialMargin`, or derived from notional and initial margin bps |
| `account.liquidationPrice` | `liquidationPrice`, `liqPrice`, `liquidation_price` |
| `account.pnlPath` | `pnlPath`, `pnlHistory` |

### Execution And Receipts

| normalized field | accepted aliases |
| --- | --- |
| book object | `bestPrice`, `best-price`, `best_price`, `book`, `orderbook`, `quote` |
| `execution.bestBid` | `bestBid`, `bid`, `best_bid`, `bestSell.priceUsd`, `bestSell.price` with decimals |
| `execution.bestAsk` | `bestAsk`, `ask`, `best_ask`, `bestBuy.priceUsd`, `bestBuy.price` with decimals |
| `execution.impact10kBps` | `impact10kBps`, `impact_10k_bps`, receipt `impactBps`, receipt `priceImpactBps`, `effectiveSpreadBps` |
| `execution.impact50kBps` | `impact50kBps`, `impact_50k_bps` |
| `execution.markout1mBps` | `markout1mBps`, `markout_1m_bps`, receipt `markout60sBps` |
| `execution.markout5mBps` | `markout5mBps`, `markout_5m_bps`, receipt `markout300sBps` |
| `execution.fillQualityScore` | `fillQualityScore`, `fill_quality_score`, receipt `qualityScore` |
| `execution.routeLatencyMs` | `routeLatencyMs`, `latencyMs`, receipt `durationMs` |
| `execution.priorityFeeMicrolamports` | `priorityFeeMicrolamports`, `priorityFee`, `priorityFeeMicroLamports` |
| receipt rows | `receipts`, `executionReceipts`, `receiptTimeline`, `fillReceipts`, `fills`, `rows`, `items`, `accounts` |

Receipt rows can also include `id`, `receiptId`, `txid`, `label`, `kind`, `venue`, `route`, `source`, `origin`, `adapter`, `sourceTimestamp`, `timestamp`, `observedAt`, `filledAt`, `ts`, `slot`, `sourceSlot`, `marketSlot`, `side`, `direction`, `notionalUsd`, `sizeUsd`, `quoteNotionalUsd`, `quotePriceUsd`, `quotedPriceUsd`, `fillPriceUsd`, and `executionPriceUsd`. A `signature` string is accepted as a receipt id, but signature material must stay observational and must not be paired with transaction or signer payloads.

### Carry History

| normalized field | accepted aliases |
| --- | --- |
| history command names | `funding-history`, `funding-skew-history`, `funding-rates`, `skew-history`, `market-carry-history` |
| history row containers | direct array, `fundingSkew`, `fundingHistory`, `fundingSkewHistory`, `history`, `rows`, `items`, command `output`, `data`, `result`, `stdout`, `stdoutText` |
| `history.id` | `id` |
| `history.label` | `label`, `window`, `sourceTimestamp` |
| `history.source` | `source`, `origin`, market `sourceStatus` |
| `history.sourceTimestamp` | `sourceTimestamp`, `timestamp`, `observedAt`, `ts` |
| `history.slot` | `slot`, `sourceSlot`, `marketSlot`, market `currentSlot` |
| `history.fundingBpsPerHour` | `fundingBpsPerHour`, `fundingRateBpsPerHour`, `funding_bps_per_hour`, market funding fallback |
| `history.longOpenInterestUsd` | `longOpenInterestUsd`, `longOiUsd`, `long_oi_usd`, nested `marketStructure.longOpenInterestUsd` |
| `history.shortOpenInterestUsd` | `shortOpenInterestUsd`, `shortOiUsd`, `short_oi_usd`, nested `marketStructure.shortOpenInterestUsd` |
| `history.openInterestUsd` | `openInterestUsd`, `oiUsd`, `open_interest_usd`, nested `marketStructure.openInterestUsd`, or long plus short OI |
| `history.oiSkewPct` | `oiSkewPct`, `skewPct`, or derived from long/short/open interest |
| `history.stressUsedPct` | `stressUsedPct`, `stressPct`, or derived from `stressConsumedBps / stressLimitBps` |
| `history.oracleAgeSec` | `oracleAgeSec`, `publishAgeSec`, `ageSecs`, `priceAgeSec` |

## Watchtower Signal Dependencies

| signal | fields used |
| --- | --- |
| runway | `account.liquidationDistancePct`, `account.marginBufferUsd`, stress `projectedBufferUsd` |
| freshness | `price.freshnessScore`, `crank.freshnessScore`, `crank.ageSlots`, `price.publishAgeSec` |
| execution | receipt averages for `markout5mBps`, `routeLatencyMs`, `priorityFeeMicrolamports`, or execution fallbacks |
| impact | `execution.impact10kBps`, `execution.impact50kBps` |
| carry | `funding.bpsPerHour`, `funding.dailyUsd`, `marketStructure.oiSkewPct` |
| solvency | `solvency.coveragePct`, `solvency.insuranceUsd`, `solvency.socialLossUsd` |

## Ignored And Rejected Fields

Unknown top-level fields and unknown command names are reported as ignored. They are preserved as provenance in the compatibility report but are not mapped into the cockpit yet.

Rejected secret-like keys include `secretKey`, `privateKey`, `keypair`, `mnemonic`, `seed`, `wallet`, `walletAdapter`, and `walletPath`.

Rejected mutating keys include `instruction`, `instructions`, `order`, `orders`, `send`, `sendTransaction`, `sign`, `signature` in funding-history logs, `signer`, `signTransaction`, `transaction`, and `transactions`.

Unsafe examples:

```json
{ "market": { "walletPath": "~/.config/solana/id.json" } }
```

```json
{ "market": { "privateKey": "..." } }
```

```json
{ "command": "slab:get", "output": { "transaction": "..." } }
```

```json
{ "order": { "side": "long", "sizeUsd": 1000 } }
```

Safe public fixture examples:

- `examples/percolator-cli.bundle.json`
- `examples/decoded-slab.snapshot.json`
- `examples/execution-receipts.stdout.json`
- `examples/funding-skew-history.stdout.json`
- `examples/percolator-mainnet-sol.readonly-rpc.json`
- `examples/percolator-devnet-wif.readonly-rpc.json`
- `examples/terminal-dto-export.json`

## Builder Checklist

Send `market.slab`, `market.program`, and a USD or decimal-scaled `price.mark` first. Add oracle age and crank age next so stale data is visible. Add account notional and liquidation fields if the terminal shows trader runway. Add execution receipts if you want Watchtower to explain route quality instead of only showing spread. Add funding/skew history if traders should see whether carry pressure is improving or getting worse.

Keep the payload read-only: decoded state, captured stdout, public account metadata, and receipt observations only. Do not include wallets, signers, transaction blobs, order intents, private keys, API keys, or user-identifying account data.
