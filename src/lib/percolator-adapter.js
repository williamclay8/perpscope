const KEYPAIR_FIELD_PATTERN = /(^|_)(secret|private|keypair|mnemonic|seed|walletPath|wallet)(_|$)/i;

export function assertReadOnlySnapshot(value, path = "snapshot") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const nextPath = `${path}.${key}`;
    if (KEYPAIR_FIELD_PATTERN.test(key) || /secret|private|keypair|mnemonic|seed|walletpath|wallet/.test(normalizeKey(key))) {
      throw new Error(`Refusing secret-bearing field in read-only snapshot: ${nextPath}`);
    }
    if (child && typeof child === "object") {
      assertReadOnlySnapshot(child, nextPath);
    }
  }
}

export function detectPercolatorInputShape(input) {
  if (!input || typeof input !== "object") return "unknown";
  if (Array.isArray(input)) return "percolator-market-array";
  if (Array.isArray(input.commands) || input.command || hasCliSections(input)) return "percolator-cli-bundle";
  if (Array.isArray(input.markets)) return "perpscope-snapshot";
  return "unknown";
}

export function normalizePercolatorCliBundle(bundle) {
  assertReadOnlySnapshot(bundle);
  return coercePercolatorCliBundle(bundle);
}

export function parsePercolatorJson(text) {
  const source = String(text).trim();
  try {
    return JSON.parse(source);
  } catch {
    const extracted = extractJsonPayload(source);
    if (!extracted) throw new Error("No JSON payload found.");
    return JSON.parse(extracted);
  }
}

export function normalizePercolatorSnapshot(input) {
  assertReadOnlySnapshot(input);
  const snapshot = coercePercolatorSnapshot(input);
  const markets = (snapshot.markets || []).map((market) =>
    toTerminalMarketDto(market, snapshot.currentSlot)
  );
  const aggregateHealth = average(markets.map((market) => market.healthScore));
  return {
    source: snapshot.source,
    cluster: snapshot.cluster || "unknown",
    currentSlot: snapshot.currentSlot || 0,
    aggregateHealth,
    aggregateStatus: labelFromScore(aggregateHealth),
    markets
  };
}

function coercePercolatorSnapshot(input) {
  if (!input || typeof input !== "object") {
    return { source: { label: "empty input", mode: "read-only" }, markets: [] };
  }

  if (Array.isArray(input)) {
    return {
      source: { label: "market array", mode: "read-only" },
      cluster: "unknown",
      currentSlot: 0,
      markets: input.map((market) => coercePercolatorMarket(market))
    };
  }

  if (detectPercolatorInputShape(input) === "percolator-cli-bundle") {
    return coercePercolatorCliBundle(input);
  }

  if (Array.isArray(input.markets)) {
    return {
      ...input,
      markets: input.markets.map((market) => coercePercolatorMarket(market, input.currentSlot))
    };
  }

  return {
    source: { label: "single market import", mode: "read-only" },
    cluster: stringOf(input, ["cluster"], "unknown"),
    currentSlot: numberOf(input, ["currentSlot", "slot"], 0),
    markets: [coercePercolatorMarket(input, input.currentSlot)]
  };
}

function coercePercolatorMarket(market, currentSlot = 0) {
  if (!market || typeof market !== "object") return {};
  if (market.oracle && market.engine && market.account && market.execution) return market;
  return coercePercolatorCliBundle({
    ...market,
    cluster: market.cluster,
    currentSlot,
    market
  }).markets[0];
}

function coercePercolatorCliBundle(bundle) {
  const scope = collectCliSections(bundle);
  const engineScope = {
    ...objectOf(scope, ["engine", "state", "riskState"], {}),
    ...objectOf(scope, ["slabEngine", "slab:engine"], {})
  };
  const currentSlot = firstNumber(
    maybeNumberOf(scope, ["currentSlot", "slot", "current_slot"]),
    maybeNumberOf(engineScope, ["currentSlot", "current_slot"])
  );
  const markets = marketListOf(scope);
  return {
    source: {
      label: stringOf(scope, ["label", "sourceLabel"], "Percolator CLI bundle"),
      mode: "read-only",
      commandSet: commandNames(bundle)
    },
    cluster: stringOf(scope, ["cluster", "network"], "unknown"),
    currentSlot,
    markets: markets.length
      ? markets.map((market, index) => coerceCliMarket(scopedMarket(scope, market, index), currentSlot))
      : [coerceCliMarket(scope, currentSlot)]
  };
}

function coerceCliMarket(scope, currentSlot) {
  const marketInfo = objectOf(scope, ["market", "marketInfo", "metadata", "instrument"], scope);
  const header = objectOf(scope, ["slabHeader", "slab:header", "header"], {});
  const config = objectOf(scope, ["slabConfig", "slab:config", "config", "marketConfig"], {});
  const accountRows = valueOf(scope, ["accounts", "positions"]);
  const accountStats = summarizeAccounts(accountRows);
  const bitmapStats = summarizeBitmap(objectOf(scope, ["bitmap", "slabBitmap", "slab:bitmap"], {}));
  const engine = {
    ...objectOf(scope, ["engine", "state", "riskState"], {}),
    ...objectOf(scope, ["slabEngine", "slab:engine"], {}),
    ...accountStats,
    ...bitmapStats
  };
  const oracle = objectOf(scope, ["oracle", "price", "prices", "oraclePrice"], {});
  const book = objectOf(scope, ["bestPrice", "best-price", "best_price", "book", "orderbook", "quote"], {});
  const execution = objectOf(scope, ["execution", "executionQuality"], {});
  const receiptRows = receiptListOf(scope, execution);
  const firstReceipt = firstItem(receiptRows);
  const account = {
    ...firstItem(accountRows),
    ...firstItem(valueOf(scope, ["account", "position", "traderAccount"]))
  };
  const bestBuy = objectOf(book, ["bestBuy", "best_buy"], objectOf(scope, ["bestBuy", "best_buy"], {}));
  const bestSell = objectOf(book, ["bestSell", "best_sell"], objectOf(scope, ["bestSell", "best_sell"], {}));
  const params = objectOf(scope, ["slabParams", "slab:params", "params", "riskParams"], {});
  const symbol = stringOf(marketInfo, ["symbol", "name", "market", "ticker"], "PERP");
  const parsed = parseSymbol(symbol);
  const base = stringOf(marketInfo, ["base", "baseSymbol", "baseAsset"], parsed.base);
  const quote = stringOf(marketInfo, ["quote", "quoteSymbol", "quoteAsset"], parsed.quote);
  const markPrice = firstNumber(
    priceNumberOf(oracle, ["markPrice", "mark", "priceUsd", "oraclePriceUsd"], ["price", "oraclePrice"]),
    priceNumberOf(book, ["markPrice", "mark", "midPrice", "mid", "priceUsd"], ["price"]),
    priceNumberOf(firstReceipt, ["markPriceUsd", "markPrice", "mark"], ["markPrice"]),
    priceNumberOf(engine, ["lastOraclePriceUsd", "resolvedPriceUsd"], ["lastOraclePrice", "resolvedPrice"]),
    priceNumberOf(marketInfo, ["markPrice", "priceUsd"], ["price"])
  );
  const indexPrice = firstNumber(
    priceNumberOf(oracle, ["indexPrice", "index", "oraclePriceUsd", "priceUsd"], ["oraclePrice", "price"]),
    priceNumberOf(book, ["indexPrice", "oraclePriceUsd"], ["oraclePrice", "price"]),
    markPrice
  );
  const bestBid = firstNumber(
    priceNumberOf(book, ["bestBid", "bid", "best_bid"], []),
    priceNumberOf(execution, ["bestBid"], []),
    priceNumberOf(firstReceipt, ["bestBid", "bid", "best_bid"], []),
    priceNumberOf(bestSell, ["priceUsd"], ["price"])
  );
  const bestAsk = firstNumber(
    priceNumberOf(book, ["bestAsk", "ask", "best_ask"], []),
    priceNumberOf(execution, ["bestAsk"], []),
    priceNumberOf(firstReceipt, ["bestAsk", "ask", "best_ask"], []),
    priceNumberOf(bestBuy, ["priceUsd"], ["price"])
  );
  const spreadFallback = markPrice ? markPrice * 0.0008 : 0;
  const normalizedBestBid = bestBid || Math.max(markPrice - spreadFallback, 0);
  const normalizedBestAsk = bestAsk || markPrice + spreadFallback;
  const positionSize = numberOf(account, ["positionSize", "basePosition", "positionSizeBase", "size", "position"], 0);
  const side = stringOf(account, ["side"], positionSize < 0 ? "short" : positionSize > 0 ? "long" : "flat");
  const positionNotionalUsd = firstNumber(
    maybeNumberOf(account, ["positionNotionalUsd", "notionalUsd", "notional"]),
    Math.abs(positionSize) * markPrice
  );
  const collateralUsd = numberOf(account, ["collateralUsd", "equityCollateralUsd"], 0);
  const unrealizedPnlUsd = numberOf(account, ["unrealizedPnlUsd", "unrealizedPnl", "uPnl"], 0);
  const fundingPnlUsd = numberOf(account, ["fundingPnlUsd", "fundingPnl"], 0);
  const maintenanceMarginUsd = firstNumber(
    maybeNumberOf(account, ["maintenanceMarginUsd", "maintenanceMargin"]),
    positionNotionalUsd * (firstNumber(
      maybeNumberOf(params, ["maintenanceMarginBps", "maintenance_margin_bps"]),
      maybeNumberOf(config, ["maintenanceMarginBps", "maintenance_margin_bps"]),
      500
    ) / 10000)
  );
  const liquidationPrice = firstNumber(
    maybeNumberOf(account, ["liquidationPrice", "liqPrice", "liquidation_price"]),
    markPrice * (side === "short" ? 1.18 : 0.82)
  );
  const lastCrankSlot = numberOf(engine, ["lastCrankSlot", "last_crank_slot"], currentSlot);
  const crankAgeSlots = firstNumber(
    maybeNumberOf(engine, ["crankAgeSlots", "crank_age_slots", "ageSlots"]),
    currentSlot && numberOf(engine, ["lastMarketSlot", "last_market_slot"]) ? currentSlot - numberOf(engine, ["lastMarketSlot", "last_market_slot"]) : undefined,
    Math.max(currentSlot - lastCrankSlot, 0)
  );
  const stressConsumedBps = firstNumber(
    maybeNumberOf(engine, ["stressConsumedBps", "stress_consumed_bps"]),
    maybeNumberOf(engine, ["stressConsumedBpsE9SinceEnvelope"]) / 1e9
  );
  const openInterestUsd = firstNumber(
    maybeNumberOf(engine, ["openInterestUsd", "open_interest_usd", "oiUsd"]),
    maybeNumberOf(marketInfo, ["openInterestUsd"])
  );
  const longOpenInterestUsd = firstNumber(
    maybeNumberOf(engine, ["longOpenInterestUsd", "long_oi_usd"]),
    maybeNumberOf(marketInfo, ["longOpenInterestUsd"])
  );
  const shortOpenInterestUsd = firstNumber(
    maybeNumberOf(engine, ["shortOpenInterestUsd", "short_oi_usd"]),
    maybeNumberOf(marketInfo, ["shortOpenInterestUsd"])
  );
  const insuranceUsd = firstNumber(
    maybeNumberOf(engine, ["insuranceUsd", "insurance_usd"]),
    maybeNumberOf(marketInfo, ["insuranceUsd"])
  );

  return {
    id: stringOf(marketInfo, ["id", "marketId"], `${base.toLowerCase()}-perp`),
    name: stringOf(marketInfo, ["name", "symbol"], `${base}-PERP`),
    base,
    quote,
    status: stringOf(marketInfo, ["status"], "read-only"),
    slab: stringOf(marketInfo, ["slab", "slabAddress", "address", "pubkey"], "unknown slab"),
    program: stringOf(marketInfo, ["program", "programId", "owner"], "unknown program"),
    header,
    config: {
      maxLeverage: numberOf(config, ["maxLeverage", "max_leverage"], 0),
      initialMarginBps: firstNumber(maybeNumberOf(params, ["initialMarginBps", "initial_margin_bps"]), maybeNumberOf(config, ["initialMarginBps", "initial_margin_bps"])),
      maintenanceMarginBps: firstNumber(maybeNumberOf(params, ["maintenanceMarginBps", "maintenance_margin_bps"]), maybeNumberOf(config, ["maintenanceMarginBps", "maintenance_margin_bps"])),
      liquidationFeeBps: firstNumber(maybeNumberOf(params, ["liquidationFeeBps", "liquidation_fee_bps"]), maybeNumberOf(config, ["liquidationFeeBps", "liquidation_fee_bps"])),
      fundingMaxPremiumBps: numberOf(config, ["fundingMaxPremiumBps", "funding_max_premium_bps"], 0),
      maxStalenessSecs: numberOf(config, ["maxStalenessSecs", "max_staleness_secs", "maxOracleAgeSec"], 8),
      confFilterBps: numberOf(config, ["confFilterBps", "confidenceFilterBps"], 0),
      permissionlessResolveStaleSlots: numberOf(config, ["permissionlessResolveStaleSlots"], 0),
      forceCloseDelaySlots: numberOf(config, ["forceCloseDelaySlots"], 0)
    },
    oracle: {
      indexPrice,
      markPrice,
      effectivePrice: firstNumber(priceNumberOf(oracle, ["effectivePrice", "effectivePriceUsd"], []), markPrice),
      confidenceBps: numberOf(oracle, ["confidenceBps", "confidence_bps", "confBps"], 0),
      publishAgeSec: numberOf(oracle, ["publishAgeSec", "ageSecs", "ageSec", "age"], 0),
      pricePath: arrayOf(oracle, ["pricePath", "path", "history"], [indexPrice, markPrice]),
      legs: arrayOf(oracle, ["legs", "sources"], [])
    },
    engine: {
      lastCrankSlot,
      crankAgeSlots,
      catchupRequired: Boolean(valueOf(engine, ["catchupRequired", "catchup_required"])),
      staleAccounts: numberOf(engine, ["staleAccounts", "stale_accounts", "staleAccountCount"], 0),
      activeAccounts: firstNumber(
        maybeNumberOf(engine, ["activeAccounts", "active_accounts", "materializedAccountCount"]),
        maybeNumberOf(engine, ["numUsedAccounts", "numUsed", "usedAccounts"])
      ),
      maxAccounts: firstNumber(
        maybeNumberOf(engine, ["maxAccounts", "max_accounts"]),
        maybeNumberOf(params, ["maxAccounts", "max_accounts"]),
        maybeNumberOf(config, ["maxAccounts", "max_accounts"])
      ),
      fundingRateBpsPerHour: numberOf(engine, ["fundingRateBpsPerHour", "funding_bps_per_hour", "fundingRate"], 0),
      fundingIndex: valueOf(engine, ["fundingIndex", "funding_index"]) || "0",
      openInterestUsd,
      longOpenInterestUsd,
      shortOpenInterestUsd,
      stressConsumedBps,
      stressLimitBps: numberOf(engine, ["stressLimitBps", "stress_limit_bps"], 500),
      insuranceUsd,
      vaultUsd: numberOf(engine, ["vaultUsd", "vault_usd"], 0),
      claimUsd: numberOf(engine, ["claimUsd", "claim_usd"], 0),
      socialLossUsd: numberOf(engine, ["socialLossUsd", "social_loss_usd"], 0),
      sideMode: stringOf(engine, ["sideMode", "side_mode"], "unknown")
    },
    account: {
      label: stringOf(account, ["label", "ownerLabel", "name"], "Read-only observer"),
      side,
      positionSize,
      positionNotionalUsd,
      collateralUsd,
      unrealizedPnlUsd,
      realizedPnlUsd: numberOf(account, ["realizedPnlUsd", "realizedPnl"], 0),
      fundingPnlUsd,
      maintenanceMarginUsd,
      initialMarginUsd: firstNumber(
        maybeNumberOf(account, ["initialMarginUsd", "initialMargin"]),
        positionNotionalUsd * (firstNumber(
          maybeNumberOf(params, ["initialMarginBps", "initial_margin_bps"]),
          maybeNumberOf(config, ["initialMarginBps", "initial_margin_bps"]),
          800
        ) / 10000)
      ),
      liquidationPrice,
      pnlPath: arrayOf(account, ["pnlPath", "pnlHistory"], [unrealizedPnlUsd])
    },
    execution: {
      bestBid: normalizedBestBid,
      bestAsk: normalizedBestAsk,
      impact10kBps: firstNumber(
        maybeNumberOf(execution, ["impact10kBps", "impact_10k_bps"]),
        maybeNumberOf(firstReceipt, ["impactBps", "priceImpactBps", "impact_bps"]),
        maybeNumberOf(book, ["effectiveSpreadBps"])
      ),
      impact50kBps: firstNumber(
        maybeNumberOf(execution, ["impact50kBps", "impact_50k_bps"]),
        maybeNumberOf(firstReceipt, ["impact50kBps", "impact_50k_bps"])
      ),
      markout1mBps: firstNumber(
        maybeNumberOf(execution, ["markout1mBps", "markout_1m_bps"]),
        maybeNumberOf(firstReceipt, ["markout1mBps", "markout_1m_bps", "markout60sBps"])
      ),
      markout5mBps: firstNumber(
        maybeNumberOf(execution, ["markout5mBps", "markout_5m_bps"]),
        maybeNumberOf(firstReceipt, ["markout5mBps", "markout_5m_bps", "markout300sBps"])
      ),
      fillQualityScore: firstNumber(
        maybeNumberOf(execution, ["fillQualityScore", "fill_quality_score"]),
        maybeNumberOf(firstReceipt, ["fillQualityScore", "qualityScore"]),
        72
      ),
      routeLatencyMs: firstNumber(
        maybeNumberOf(execution, ["routeLatencyMs", "latencyMs"]),
        maybeNumberOf(firstReceipt, ["routeLatencyMs", "latencyMs", "durationMs"])
      ),
      priorityFeeMicrolamports: firstNumber(
        maybeNumberOf(execution, ["priorityFeeMicrolamports", "priorityFee"]),
        maybeNumberOf(firstReceipt, ["priorityFeeMicrolamports", "priorityFee", "priorityFeeMicroLamports"])
      ),
      receipts: normalizeExecutionReceipts(receiptRows, {
        ...execution,
        bestBid: normalizedBestBid,
        bestAsk: normalizedBestAsk,
        spreadBps: bps(normalizedBestAsk - normalizedBestBid, midpoint(normalizedBestAsk, normalizedBestBid))
      })
    }
  };
}

export function toTerminalMarketDto(market, currentSlot = 0) {
  const price = number(market.oracle?.markPrice);
  const indexPrice = number(market.oracle?.indexPrice);
  const effectivePrice = number(market.oracle?.effectivePrice || price);
  const account = market.account || {};
  const engine = market.engine || {};
  const config = market.config || {};
  const execution = market.execution || {};
  const executionReceipts = normalizeExecutionReceipts(execution.receipts || execution.receiptTimeline || [], execution);

  const spreadBps = bps(execution.bestAsk - execution.bestBid, midpoint(execution.bestAsk, execution.bestBid));
  const markDriftBps = bps(price - indexPrice, indexPrice);
  const oracleFreshness = freshnessScore(market.oracle?.publishAgeSec, config.maxStalenessSecs);
  const crankFreshness = freshnessScore(engine.crankAgeSlots, 220);
  const stressUsedPct = percent(engine.stressConsumedBps, engine.stressLimitBps);
  const insuranceCoveragePct = percent(engine.insuranceUsd, Math.max(engine.claimUsd || 1, 1));
  const oiSkewPct = percent(engine.longOpenInterestUsd - engine.shortOpenInterestUsd, engine.openInterestUsd);
  const equityUsd = number(account.collateralUsd) + number(account.unrealizedPnlUsd) + number(account.fundingPnlUsd);
  const marginBufferUsd = equityUsd - number(account.maintenanceMarginUsd);
  const marginBufferPct = percent(marginBufferUsd, Math.max(number(account.positionNotionalUsd), 1));
  const liquidationDistancePct = liquidationDistance({
    price,
    liquidationPrice: number(account.liquidationPrice),
    side: account.side
  });
  const dailyFundingUsd = number(account.positionNotionalUsd) * (number(engine.fundingRateBpsPerHour) / 10000) * 24;
  const signedDailyFundingUsd = account.side === "short" ? -dailyFundingUsd : dailyFundingUsd;
  const executionScore = clamp(number(execution.fillQualityScore), 0, 100);

  const healthScore = weightedScore([
    [liquidationDistancePct * 6, 0.26],
    [marginBufferPct * 9, 0.18],
    [oracleFreshness, 0.16],
    [crankFreshness, 0.13],
    [100 - stressUsedPct, 0.13],
    [Math.min(insuranceCoveragePct, 120) * 0.82, 0.08],
    [executionScore, 0.06]
  ]);

  const flags = buildFlags({
    market,
    oracleFreshness,
    crankFreshness,
    stressUsedPct,
    insuranceCoveragePct,
    liquidationDistancePct,
    marginBufferUsd,
    spreadBps
  });

  return {
    id: market.id,
    name: market.name,
    base: market.base,
    quote: market.quote,
    status: labelFromScore(healthScore),
    sourceStatus: market.status,
    slab: market.slab,
    program: market.program,
    header: market.header,
    config,
    currentSlot,
    price: {
      index: indexPrice,
      mark: price,
      effective: effectivePrice,
      driftBps: markDriftBps,
      confidenceBps: number(market.oracle?.confidenceBps),
      publishAgeSec: number(market.oracle?.publishAgeSec),
      freshnessScore: oracleFreshness,
      path: market.oracle?.pricePath || [],
      legs: market.oracle?.legs || []
    },
    crank: {
      lastSlot: engine.lastCrankSlot,
      ageSlots: number(engine.crankAgeSlots),
      freshnessScore: crankFreshness,
      catchupRequired: Boolean(engine.catchupRequired),
      staleAccounts: number(engine.staleAccounts),
      activeAccounts: number(engine.activeAccounts),
      maxAccounts: number(engine.maxAccounts)
    },
    funding: {
      bpsPerHour: number(engine.fundingRateBpsPerHour),
      dailyUsd: signedDailyFundingUsd,
      index: engine.fundingIndex
    },
    marketStructure: {
      openInterestUsd: number(engine.openInterestUsd),
      longOpenInterestUsd: number(engine.longOpenInterestUsd),
      shortOpenInterestUsd: number(engine.shortOpenInterestUsd),
      oiSkewPct,
      stressUsedPct,
      sideMode: engine.sideMode
    },
    solvency: {
      insuranceUsd: number(engine.insuranceUsd),
      vaultUsd: number(engine.vaultUsd),
      claimUsd: number(engine.claimUsd),
      socialLossUsd: number(engine.socialLossUsd),
      coveragePct: insuranceCoveragePct
    },
    account: {
      label: account.label,
      side: account.side,
      positionSize: number(account.positionSize),
      positionNotionalUsd: number(account.positionNotionalUsd),
      collateralUsd: number(account.collateralUsd),
      equityUsd,
      unrealizedPnlUsd: number(account.unrealizedPnlUsd),
      realizedPnlUsd: number(account.realizedPnlUsd),
      fundingPnlUsd: number(account.fundingPnlUsd),
      maintenanceMarginUsd: number(account.maintenanceMarginUsd),
      initialMarginUsd: number(account.initialMarginUsd),
      liquidationPrice: number(account.liquidationPrice),
      liquidationDistancePct,
      marginBufferUsd,
      marginBufferPct,
      pnlPath: account.pnlPath || []
    },
    execution: {
      bestBid: number(execution.bestBid),
      bestAsk: number(execution.bestAsk),
      spreadBps,
      impact10kBps: number(execution.impact10kBps),
      impact50kBps: number(execution.impact50kBps),
      markout1mBps: number(execution.markout1mBps),
      markout5mBps: number(execution.markout5mBps),
      fillQualityScore: executionScore,
      routeLatencyMs: number(execution.routeLatencyMs),
      priorityFeeMicrolamports: number(execution.priorityFeeMicrolamports),
      receipts: executionReceipts
    },
    flags,
    healthScore
  };
}

export function simulatePriceShock(marketDto, shockPct) {
  const nextPrice = marketDto.price.mark * (1 + number(shockPct) / 100);
  const signedSize = Math.abs(marketDto.account.positionSize) * (marketDto.account.side === "short" ? -1 : 1);
  const priceMove = nextPrice - marketDto.price.mark;
  const projectedPnl = marketDto.account.unrealizedPnlUsd + signedSize * priceMove;
  const projectedEquity =
    marketDto.account.collateralUsd + projectedPnl + marketDto.account.fundingPnlUsd;
  const projectedBufferUsd = projectedEquity - marketDto.account.maintenanceMarginUsd;
  const projectedLiqDistancePct = liquidationDistance({
    price: nextPrice,
    liquidationPrice: marketDto.account.liquidationPrice,
    side: marketDto.account.side
  });
  const projectedScore = clamp(
    weightedScore([
      [projectedLiqDistancePct * 6, 0.48],
      [percent(projectedBufferUsd, Math.max(marketDto.account.positionNotionalUsd, 1)) * 9, 0.28],
      [marketDto.price.freshnessScore, 0.12],
      [100 - marketDto.marketStructure.stressUsedPct, 0.12]
    ]),
    0,
    100
  );

  return {
    shockPct: number(shockPct),
    nextPrice,
    projectedPnl,
    projectedEquity,
    projectedBufferUsd,
    projectedLiqDistancePct,
    projectedScore,
    projectedStatus: labelFromScore(projectedScore)
  };
}

function buildFlags(context) {
  const flags = [];
  if (context.liquidationDistancePct < 4) flags.push({ tone: "danger", label: "liq band tight" });
  if (context.marginBufferUsd < 0) flags.push({ tone: "danger", label: "below maintenance" });
  if (context.oracleFreshness < 55) flags.push({ tone: "danger", label: "oracle stale" });
  if (context.crankFreshness < 45) flags.push({ tone: "danger", label: "crank lag" });
  if (context.stressUsedPct > 75) flags.push({ tone: "danger", label: "stress cap hot" });
  if (context.insuranceCoveragePct < 100) flags.push({ tone: "warning", label: "insurance thin" });
  if (context.spreadBps > 35) flags.push({ tone: "warning", label: "wide spread" });
  if (context.market.engine?.catchupRequired) flags.push({ tone: "danger", label: "catchup required" });
  if (!flags.length) flags.push({ tone: "good", label: "read-only healthy" });
  return flags.slice(0, 4);
}

function liquidationDistance({ price, liquidationPrice, side }) {
  if (!price || !liquidationPrice) return 0;
  const raw = side === "short"
    ? (liquidationPrice - price) / price
    : (price - liquidationPrice) / price;
  return clamp(raw * 100, -100, 100);
}

function freshnessScore(age, maxAge) {
  const normalizedAge = number(age);
  const normalizedMax = Math.max(number(maxAge), 1);
  return clamp(100 - (normalizedAge / normalizedMax) * 100, 0, 100);
}

function weightedScore(parts) {
  const totalWeight = parts.reduce((sum, [, weight]) => sum + weight, 0);
  const total = parts.reduce((sum, [score, weight]) => sum + clamp(number(score), 0, 100) * weight, 0);
  return Math.round(total / totalWeight);
}

function labelFromScore(score) {
  if (score >= 72) return "stable";
  if (score >= 48) return "watch";
  return "risk";
}

function midpoint(a, b) {
  return (number(a) + number(b)) / 2;
}

function bps(delta, base) {
  return base ? (number(delta) / Math.abs(number(base))) * 10000 : 0;
}

function percent(value, base) {
  return base ? (number(value) / Math.abs(number(base))) * 100 : 0;
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function collectCliSections(input) {
  const sections = {
    market: input?.market,
    engine: input?.engine,
    account: input?.account,
    accounts: input?.accounts,
    bitmap: input?.bitmap,
    receipts: input?.receipts || input?.executionReceipts || input?.receiptTimeline
  };
  if (!input || typeof input !== "object") return sections;

  if (
    input.command &&
    (
      input.output !== undefined ||
      input.data !== undefined ||
      input.result !== undefined ||
      input.stdout !== undefined ||
      input.stdoutText !== undefined
    )
  ) {
    const output = cliOutputOf(input);
    sections[input.command] = output;
    mergeNamedCliOutput(sections, input.command, output);
    mergeCompositeCliOutput(sections, output);
  }

  for (const entry of input.commands || input.outputs || []) {
    if (!entry || typeof entry !== "object") continue;
    const name = entry.command || entry.name || entry.label || entry.kind;
    const output = cliOutputOf(entry);
    if (name) sections[name] = output;
    mergeNamedCliOutput(sections, name, output);
    mergeCompositeCliOutput(sections, output);
  }

  return {
    ...input,
    ...sections
  };
}

function mergeCompositeCliOutput(sections, output) {
  if (!output || typeof output !== "object" || Array.isArray(output)) return;
  for (const key of [
    "market",
    "header",
    "config",
    "params",
    "engine",
    "oracle",
    "accounts",
    "bitmap",
    "execution",
    "receipts",
    "executionReceipts",
    "receiptTimeline"
  ]) {
    if (output[key] && sections[key] === undefined) sections[key] = output[key];
  }
  if (output.slab && sections.market === undefined) sections.market = output;
  if (output.bestBuy || output.bestSell || output.effectiveSpreadBps !== undefined) {
    sections.bestPrice = output;
  }
}

function commandNames(input) {
  const names = [];
  if (input?.command) names.push(input.command);
  for (const entry of input?.commands || input?.outputs || []) {
    const name = entry?.command || entry?.name || entry?.label || entry?.kind;
    if (name) names.push(name);
  }
  return names;
}

function mergeNamedCliOutput(sections, name, output) {
  const key = normalizeKey(name || "");
  if (!key || !output || typeof output !== "object") return;
  if (key === "slabget") {
    mergeCompositeCliOutput(sections, output);
    if (!sections.market && !Array.isArray(output)) sections.market = output.market || output;
  }
  if (key === "slabparams") sections.params = output;
  if (key === "slabengine") sections.engine = { ...(sections.engine || {}), ...output };
  if (key === "slabaccount") sections.account = { ...(sections.account || {}), ...output };
  if (key === "slabaccounts") sections.accounts = output;
  if (key === "slabbitmap") sections.bitmap = output;
  if (key === "bestprice") sections.bestPrice = output;
  if (key === "listmarkets") sections.markets = output;
  if (["executionreceipts", "executionreceipt", "receipts", "receiptlog", "fillreceipts", "fills"].includes(key)) {
    sections.receipts = output;
  }
}

function hasCliSections(input) {
  return Object.keys(input || {}).some((key) =>
    [
      "slabHeader",
      "slabConfig",
      "slabEngine",
      "slabBitmap",
      "bestPrice",
      "best-price",
      "marketInfo",
      "receipts",
      "executionReceipts",
      "receiptTimeline",
      "fillReceipts",
      "fills"
    ].some(
      (alias) => normalizeKey(alias) === normalizeKey(key)
    )
  );
}

function marketListOf(scope) {
  const value = valueOf(scope, ["markets", "listMarkets", "list-markets"]);
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.markets)) return value.markets;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.accounts)) return value.accounts;
  return [];
}

function receiptListOf(...sources) {
  for (const source of sources) {
    if (!source) continue;
    const directRows = rowsOf(source);
    if (directRows.length && Array.isArray(source)) return directRows;
    const value = valueOf(source, ["receipts", "executionReceipts", "receiptTimeline", "fillReceipts", "fills"]);
    const rows = rowsOf(value);
    if (rows.length) return rows;
    const nested = valueOf(value, ["receipts", "executionReceipts", "receiptTimeline", "fillReceipts", "fills"]);
    const nestedRows = rowsOf(nested);
    if (nestedRows.length) return nestedRows;
  }
  return [];
}

function normalizeExecutionReceipts(rows, fallback = {}) {
  return rowsOf(rows).slice(0, 24).map((receipt, index) => {
    const bestBid = firstNumber(
      priceNumberOf(receipt, ["bestBid", "bid", "best_bid"], []),
      priceNumberOf(fallback, ["bestBid"], [])
    );
    const bestAsk = firstNumber(
      priceNumberOf(receipt, ["bestAsk", "ask", "best_ask"], []),
      priceNumberOf(fallback, ["bestAsk"], [])
    );
    const quotePrice = firstNumber(
      priceNumberOf(receipt, ["quotePriceUsd", "quotePrice", "quotedPriceUsd", "quotedPrice"], ["quotePrice"]),
      priceNumberOf(receipt, ["priceUsd"], ["price"])
    );
    const fillPrice = firstNumber(
      priceNumberOf(receipt, ["fillPriceUsd", "fillPrice", "executionPriceUsd", "executionPrice"], ["fillPrice"]),
      quotePrice
    );
    const markPrice = firstNumber(
      priceNumberOf(receipt, ["markPriceUsd", "markPrice", "mark"], ["markPrice"]),
      priceNumberOf(fallback, ["markPrice"], [])
    );
    const spreadBps = firstNumber(
      maybeNumberOf(receipt, ["spreadBps", "spread_bps", "effectiveSpreadBps"]),
      maybeNumberOf(fallback, ["spreadBps"]),
      bps(bestAsk - bestBid, midpoint(bestAsk, bestBid))
    );
    const impactBps = firstNumber(
      maybeNumberOf(receipt, ["impactBps", "priceImpactBps", "impact_bps"]),
      maybeNumberOf(fallback, ["impact10kBps", "impact_10k_bps"])
    );
    const markout1mBps = firstNumber(
      maybeNumberOf(receipt, ["markout1mBps", "markout_1m_bps", "markout60sBps"]),
      maybeNumberOf(fallback, ["markout1mBps", "markout_1m_bps"])
    );
    const markout5mBps = firstNumber(
      maybeNumberOf(receipt, ["markout5mBps", "markout_5m_bps", "markout300sBps"]),
      maybeNumberOf(fallback, ["markout5mBps", "markout_5m_bps"])
    );

    return {
      id: stringOf(receipt, ["id", "receiptId", "signature", "txid"], `receipt-${index + 1}`),
      label: stringOf(receipt, ["label", "kind", "venue", "route"], `fill ${index + 1}`),
      source: stringOf(receipt, ["source", "origin", "adapter"], "adapter"),
      sourceTimestamp: stringOf(receipt, ["sourceTimestamp", "timestamp", "observedAt", "filledAt", "ts"], ""),
      slot: numberOf(receipt, ["slot", "sourceSlot", "marketSlot"], 0),
      side: stringOf(receipt, ["side", "direction"], "fill"),
      notionalUsd: firstNumber(maybeNumberOf(receipt, ["notionalUsd", "sizeUsd", "quoteNotionalUsd"])),
      quotePrice,
      fillPrice,
      markPrice,
      bestBid,
      bestAsk,
      spreadBps,
      impactBps,
      markout1mBps,
      markout5mBps,
      routeLatencyMs: firstNumber(
        maybeNumberOf(receipt, ["routeLatencyMs", "latencyMs", "durationMs"]),
        maybeNumberOf(fallback, ["routeLatencyMs", "latencyMs"])
      ),
      priorityFeeMicrolamports: firstNumber(
        maybeNumberOf(receipt, ["priorityFeeMicrolamports", "priorityFee", "priorityFeeMicroLamports"]),
        maybeNumberOf(fallback, ["priorityFeeMicrolamports", "priorityFee"])
      ),
      oracleAgeSec: firstNumber(maybeNumberOf(receipt, ["oracleAgeSec", "priceAgeSec", "ageSecs"])),
      crankAgeSlots: firstNumber(maybeNumberOf(receipt, ["crankAgeSlots", "ageSlots"])),
      fundingBpsPerHour: firstNumber(maybeNumberOf(receipt, ["fundingBpsPerHour", "fundingRateBpsPerHour"])),
      fillQualityScore: clamp(
        firstNumber(maybeNumberOf(receipt, ["fillQualityScore", "qualityScore"]), maybeNumberOf(fallback, ["fillQualityScore"])),
        0,
        100
      )
    };
  });
}

function scopedMarket(scope, market, index) {
  const inheritedMarket = objectOf(scope, ["market", "marketInfo", "metadata", "instrument"], {});
  const perMarket = market && typeof market === "object" ? market : { symbol: String(market || `PERP-${index + 1}`) };
  return {
    ...scope,
    ...perMarket,
    market: {
      ...inheritedMarket,
      ...perMarket
    }
  };
}

function summarizeAccounts(value) {
  const rows = rowsOf(value);
  const output = {};
  if (rows.length) output.activeAccounts = rows.length;
  const staleCount = rows.filter((row) => Boolean(valueOf(row, ["stale", "isStale", "catchupRequired"]))).length;
  if (staleCount) output.staleAccounts = staleCount;
  return output;
}

function summarizeBitmap(bitmap) {
  if (!bitmap || typeof bitmap !== "object") return {};
  const output = {};
  const used = firstDefinedNumber(
    maybeNumberOf(bitmap, ["numUsed", "numUsedAccounts", "usedAccounts"]),
    Array.isArray(bitmap.usedIndices) ? bitmap.usedIndices.length : undefined,
    Array.isArray(bitmap.indices) ? bitmap.indices.length : undefined
  );
  const max = firstDefinedNumber(maybeNumberOf(bitmap, ["maxAccounts", "max_accounts", "capacity"]));
  if (used !== undefined) output.activeAccounts = used;
  if (max !== undefined) output.maxAccounts = max;
  return output;
}

function cliOutputOf(entry) {
  const value = entry.output ?? entry.data ?? entry.result ?? entry.stdout ?? entry.stdoutText ?? entry.json ?? entry;
  if (typeof value !== "string") {
    assertReadOnlySnapshot(value, "cli.output");
    return value;
  }
  let parsed;
  try {
    parsed = parsePercolatorJson(value);
  } catch {
    return value;
  }
  assertReadOnlySnapshot(parsed, "cli.stdout");
  return parsed;
}

function objectOf(source, aliases, fallback) {
  const value = valueOf(source, aliases);
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return fallback;
}

function arrayOf(source, aliases, fallback) {
  const value = valueOf(source, aliases);
  return Array.isArray(value) ? value : fallback;
}

function stringOf(source, aliases, fallback = "") {
  const value = valueOf(source, aliases);
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function numberOf(source, aliases, fallback = 0) {
  const value = valueOf(source, aliases);
  if (value === undefined || value === null || value === "") return fallback;
  return number(value);
}

function maybeNumberOf(source, aliases) {
  const value = valueOf(source, aliases);
  if (value === undefined || value === null || value === "") return undefined;
  return number(value);
}

function priceNumberOf(source, usdAliases, rawAliases = []) {
  for (const alias of usdAliases) {
    const value = maybeNumberOf(source, [alias]);
    if (value === undefined) continue;
    if (normalizeKey(alias).includes("usd")) return value;
    const decimals = firstDefinedNumber(maybeNumberOf(source, ["decimals", "priceDecimals", "price_decimals"]));
    if (decimals !== undefined && Math.abs(value) >= 10 ** Math.min(decimals, 4)) {
      return value / 10 ** decimals;
    }
    if (decimals === undefined && Math.abs(value) > 1000000) continue;
    return value;
  }

  const raw = firstDefinedNumber(maybeNumberOf(source, rawAliases));
  if (raw === undefined) return undefined;

  const decimals = firstDefinedNumber(maybeNumberOf(source, ["decimals", "priceDecimals", "price_decimals"]));
  if (decimals === undefined || decimals < 0 || decimals > 18) return undefined;
  return raw / 10 ** decimals;
}

function valueOf(source, aliases, fallback) {
  if (!source || typeof source !== "object") return fallback;
  const entries = Object.entries(source);
  for (const alias of aliases) {
    const wanted = normalizeKey(alias);
    const found = entries.find(([key]) => normalizeKey(key) === wanted);
    if (found && found[1] !== undefined && found[1] !== null) return found[1];
  }
  return fallback;
}

function firstItem(value) {
  if (Array.isArray(value)) return value[0] || {};
  if (value?.items && Array.isArray(value.items)) return value.items[0] || {};
  if (value?.rows && Array.isArray(value.rows)) return value.rows[0] || {};
  if (value?.accounts && Array.isArray(value.accounts)) return value.accounts[0] || {};
  if (value && typeof value === "object") return value;
  return {};
}

function rowsOf(value) {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object");
  if (Array.isArray(value?.items)) return rowsOf(value.items);
  if (Array.isArray(value?.rows)) return rowsOf(value.rows);
  if (Array.isArray(value?.accounts)) return rowsOf(value.accounts);
  return [];
}

function firstNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const next = number(value);
    if (Number.isFinite(next)) return next;
  }
  return 0;
}

function firstDefinedNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const next = number(value);
    if (Number.isFinite(next)) return next;
  }
  return undefined;
}

function parseSymbol(symbol) {
  const [base = "PERP", quote = "USDC"] = String(symbol)
    .replace(/-?PERP$/i, "")
    .split(/[-/]/)
    .filter(Boolean);
  return { base: base.toUpperCase(), quote: quote.toUpperCase() };
}

function extractJsonPayload(source) {
  const starts = [];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "{" || source[index] === "[") starts.push(index);
  }
  for (const start of starts) {
    const payload = balancedJsonPayload(source, start);
    if (!payload) continue;
    try {
      JSON.parse(payload);
      return payload;
    } catch {
      // Keep scanning; captured logs can contain bracketed prefixes before JSON.
    }
  }
  return "";
}

function balancedJsonPayload(source, start) {
  const opener = source[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === opener) depth += 1;
    if (char === closer) depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  return "";
}

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function number(value) {
  const next = Number(typeof value === "string" ? value.replace(/[$,%_\s,]/g, "") : value);
  return Number.isFinite(next) ? next : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
