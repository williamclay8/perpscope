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

export function normalizePercolatorSnapshot(snapshot) {
  assertReadOnlySnapshot(snapshot);
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

function number(value) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
