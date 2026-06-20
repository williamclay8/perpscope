const KEYPAIR_FIELD_PATTERN = /(^|_)(secret|private|keypair|mnemonic|seed|walletPath|wallet)(_|$)/i;

export function assertReadOnlySnapshot(value, path = "snapshot") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const nextPath = `${path}.${key}`;
    if (KEYPAIR_FIELD_PATTERN.test(key)) {
      throw new Error(`Refusing secret-bearing field in read-only snapshot: ${nextPath}`);
    }
    if (child && typeof child === "object") {
      assertReadOnlySnapshot(child, nextPath);
    }
  }
}

export function detectPercolatorInputShape(input) {
  if (!input || typeof input !== "object") return "unknown";
  if (Array.isArray(input.markets)) return "perpscope-snapshot";
  if (Array.isArray(input.commands) || input.command || hasCliSections(input)) return "percolator-cli-bundle";
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

  if (Array.isArray(input.markets)) {
    return {
      ...input,
      markets: input.markets.map((market) => coercePercolatorMarket(market, input.currentSlot))
    };
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
  const market = coerceCliMarket(scope, currentSlot);
  return {
    source: {
      label: stringOf(scope, ["label", "sourceLabel"], "Percolator CLI bundle"),
      mode: "read-only",
      commandSet: commandNames(bundle)
    },
    cluster: stringOf(scope, ["cluster", "network"], "unknown"),
    currentSlot,
    markets: [market]
  };
}

function coerceCliMarket(scope, currentSlot) {
  const marketInfo = objectOf(scope, ["market", "marketInfo", "metadata", "instrument"], scope);
  const header = objectOf(scope, ["slabHeader", "slab:header", "header"], {});
  const config = objectOf(scope, ["slabConfig", "slab:config", "config", "marketConfig"], {});
  const engine = {
    ...objectOf(scope, ["engine", "state", "riskState"], {}),
    ...objectOf(scope, ["slabEngine", "slab:engine"], {})
  };
  const oracle = objectOf(scope, ["oracle", "price", "prices", "oraclePrice"], {});
  const book = objectOf(scope, ["bestPrice", "best-price", "best_price", "book", "orderbook", "quote"], {});
  const execution = objectOf(scope, ["execution", "executionQuality"], {});
  const account = {
    ...firstItem(valueOf(scope, ["account", "position", "traderAccount"])),
    ...firstItem(valueOf(scope, ["accounts", "positions"]))
  };
  const bestBuy = objectOf(book, ["bestBuy", "best_buy"], objectOf(scope, ["bestBuy", "best_buy"], {}));
  const bestSell = objectOf(book, ["bestSell", "best_sell"], objectOf(scope, ["bestSell", "best_sell"], {}));
  const params = objectOf(scope, ["slabParams", "slab:params", "params", "riskParams"], {});
  const symbol = stringOf(marketInfo, ["symbol", "name", "market", "ticker"], "PERP");
  const parsed = parseSymbol(symbol);
  const base = stringOf(marketInfo, ["base", "baseSymbol", "baseAsset"], parsed.base);
  const quote = stringOf(marketInfo, ["quote", "quoteSymbol", "quoteAsset"], parsed.quote);
  const markPrice = firstNumber(
    maybeNumberOf(oracle, ["markPrice", "mark", "priceUsd", "oraclePriceUsd", "price"]),
    maybeNumberOf(book, ["markPrice", "mark", "midPrice", "mid", "priceUsd"]),
    maybeNumberOf(engine, ["lastOraclePriceUsd", "resolvedPriceUsd"]),
    maybeNumberOf(marketInfo, ["markPrice", "priceUsd", "price"])
  );
  const indexPrice = firstNumber(
    maybeNumberOf(oracle, ["indexPrice", "index", "oraclePriceUsd", "priceUsd", "oraclePrice"]),
    maybeNumberOf(book, ["indexPrice", "oraclePriceUsd", "oraclePrice"]),
    markPrice
  );
  const bestBid = firstNumber(
    maybeNumberOf(book, ["bestBid", "bid", "best_bid"]),
    maybeNumberOf(execution, ["bestBid"]),
    maybeNumberOf(bestSell, ["priceUsd", "price"])
  );
  const bestAsk = firstNumber(
    maybeNumberOf(book, ["bestAsk", "ask", "best_ask"]),
    maybeNumberOf(execution, ["bestAsk"]),
    maybeNumberOf(bestBuy, ["priceUsd", "price"])
  );
  const spreadFallback = markPrice ? markPrice * 0.0008 : 0;
  const positionSize = numberOf(account, ["positionSize", "basePosition", "positionBasisQ", "size", "position"], 0);
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
      effectivePrice: firstNumber(maybeNumberOf(oracle, ["effectivePrice", "effectivePriceUsd"]), markPrice),
      confidenceBps: numberOf(oracle, ["confidenceBps", "confidence_bps", "confBps"], 0),
      publishAgeSec: numberOf(oracle, ["publishAgeSec", "ageSecs", "ageSec", "age"], 0),
      pricePath: arrayOf(oracle, ["pricePath", "path", "history"], [indexPrice, markPrice]),
      legs: arrayOf(oracle, ["legs", "sources"], [])
    },
    engine: {
      lastCrankSlot,
      crankAgeSlots,
      catchupRequired: Boolean(valueOf(engine, ["catchupRequired", "catchup_required"])),
      staleAccounts: numberOf(engine, ["staleAccounts", "stale_accounts"], 0),
      fundingRateBpsPerHour: numberOf(engine, ["fundingRateBpsPerHour", "funding_bps_per_hour", "fundingRate"], 0),
      fundingIndex: valueOf(engine, ["fundingIndex", "funding_index"]) || "0",
      openInterestUsd,
      longOpenInterestUsd,
      shortOpenInterestUsd,
      stressConsumedBps,
      stressLimitBps: numberOf(engine, ["stressLimitBps", "stress_limit_bps"], 500),
      insuranceUsd,
      vaultUsd: numberOf(engine, ["vaultUsd", "vault_usd", "vault"], 0),
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
      bestBid: bestBid || Math.max(markPrice - spreadFallback, 0),
      bestAsk: bestAsk || markPrice + spreadFallback,
      impact10kBps: firstNumber(maybeNumberOf(execution, ["impact10kBps", "impact_10k_bps"]), maybeNumberOf(book, ["effectiveSpreadBps"])),
      impact50kBps: numberOf(execution, ["impact50kBps", "impact_50k_bps"], 0),
      markout1mBps: numberOf(execution, ["markout1mBps", "markout_1m_bps"], 0),
      markout5mBps: numberOf(execution, ["markout5mBps", "markout_5m_bps"], 0),
      fillQualityScore: numberOf(execution, ["fillQualityScore", "fill_quality_score"], 72),
      routeLatencyMs: numberOf(execution, ["routeLatencyMs", "latencyMs"], 0),
      priorityFeeMicrolamports: numberOf(execution, ["priorityFeeMicrolamports", "priorityFee"], 0)
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
      staleAccounts: number(engine.staleAccounts)
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
      priorityFeeMicrolamports: number(execution.priorityFeeMicrolamports)
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
    account: input?.account
  };
  if (!input || typeof input !== "object") return sections;

  if (input.command && input.output) {
    sections[input.command] = input.output;
    mergeCompositeCliOutput(sections, input.output);
  }

  for (const entry of input.commands || input.outputs || []) {
    if (!entry || typeof entry !== "object") continue;
    const name = entry.command || entry.name || entry.label || entry.kind;
    const output = entry.output || entry.data || entry.result || entry;
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
  for (const key of ["market", "header", "config", "params", "engine", "oracle", "accounts", "execution"]) {
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
  if (key === "slabparams") sections.params = output;
  if (key === "slabengine") sections.engine = { ...(sections.engine || {}), ...output };
  if (key === "slabaccount") sections.account = { ...(sections.account || {}), ...output };
  if (key === "slabaccounts") sections.accounts = output;
  if (key === "bestprice") sections.bestPrice = output;
  if (key === "listmarkets") sections.markets = output;
}

function hasCliSections(input) {
  return Object.keys(input || {}).some((key) =>
    ["slabHeader", "slabConfig", "slabEngine", "bestPrice", "best-price", "marketInfo"].some(
      (alias) => normalizeKey(alias) === normalizeKey(key)
    )
  );
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
  if (value && typeof value === "object") return value;
  return {};
}

function firstNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const next = number(value);
    if (Number.isFinite(next)) return next;
  }
  return 0;
}

function parseSymbol(symbol) {
  const [base = "PERP", quote = "USDC"] = String(symbol)
    .replace(/-?PERP$/i, "")
    .split(/[-/]/)
    .filter(Boolean);
  return { base: base.toUpperCase(), quote: quote.toUpperCase() };
}

function extractJsonPayload(source) {
  const starts = [source.indexOf("{"), source.indexOf("[")].filter((index) => index >= 0);
  if (!starts.length) return "";
  const start = Math.min(...starts);
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
