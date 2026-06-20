export function buildWatchtowerSignals(market, stress) {
  const receipts = market.execution.receipts || [];
  const avgMarkout5m = receipts.length ? mean(receipts.map((receipt) => receipt.markout5mBps)) : market.execution.markout5mBps;
  const avgLatency = receipts.length ? mean(receipts.map((receipt) => receipt.routeLatencyMs)) : market.execution.routeLatencyMs;
  const avgFee = receipts.length ? mean(receipts.map((receipt) => receipt.priorityFeeMicrolamports)) : market.execution.priorityFeeMicrolamports;
  const freshnessScore = Math.min(market.price.freshnessScore, market.crank.freshnessScore);
  const impact10kBps = Number(market.execution.impact10kBps) || 0;
  const impact50kBps = Number(market.execution.impact50kBps) || 0;
  const hasImpactRatio = impact10kBps > 0 && impact50kBps > 0;
  const hasImpactSignal = Math.abs(impact10kBps) > 0 || Math.abs(impact50kBps) > 0;
  const impactRatio = hasImpactRatio ? impact50kBps / impact10kBps : 0;
  const impactScore = hasImpactRatio
    ? clamp(100 - impactRatio * 16, 0, 100)
    : hasImpactSignal
      ? clamp(100 - Math.abs(impact50kBps) * 1.25, 0, 100)
      : 50;
  const impactTone = hasImpactRatio
    ? impactRatio >= 4.2 ? "danger" : impactRatio >= 2.7 ? "warning" : "good"
    : !hasImpactSignal ? "warning" : Math.abs(impact50kBps) >= 55 ? "danger" : Math.abs(impact50kBps) >= 25 ? "warning" : "good";
  const carryDaily = Math.abs(market.funding.dailyUsd);
  const runwayScore = clamp(market.account.liquidationDistancePct * 6, 0, 100);
  const projectedBuffer = stress?.projectedBufferUsd ?? market.account.marginBufferUsd;

  return [
    {
      id: "runway",
      label: "runway",
      value: pct(market.account.liquidationDistancePct),
      detail: `${money(market.account.marginBufferUsd, 0)} buffer`,
      subvalue: `${money(projectedBuffer, 0)} stress`,
      score: runwayScore,
      tone: scoreTone(runwayScore)
    },
    {
      id: "freshness",
      label: "freshness",
      value: `${Math.round(freshnessScore)}%`,
      detail: `${fmtInt(market.crank.ageSlots)} slots`,
      subvalue: `${market.price.publishAgeSec.toFixed(1)}s oracle`,
      score: freshnessScore,
      tone: scoreTone(freshnessScore)
    },
    {
      id: "execution",
      label: "execution",
      value: signedBps(avgMarkout5m),
      detail: `${Math.round(avgLatency)} ms route`,
      subvalue: feeLabel(avgFee),
      score: clamp(100 - Math.max(Math.abs(Math.min(avgMarkout5m, 0)) * 1.8, Math.max(avgLatency - 150, 0) / 5), 0, 100),
      tone: avgMarkout5m >= 0 && avgLatency <= 220 ? "good" : avgMarkout5m < -18 || avgLatency > 420 ? "danger" : "warning"
    },
    {
      id: "impact",
      label: "impact curve",
      value: hasImpactRatio ? `${impactRatio.toFixed(1)}x` : hasImpactSignal ? `${impact50kBps.toFixed(1)} bps` : "n/a",
      detail: `${impact50kBps.toFixed(1)} bps at $50k`,
      subvalue: `${impact10kBps.toFixed(1)} bps at $10k`,
      score: impactScore,
      tone: impactTone
    },
    {
      id: "carry",
      label: "carry",
      value: `${signedBps(market.funding.bpsPerHour)} / hr`,
      detail: `${money(carryDaily, 0)} daily`,
      subvalue: `${signedBps(market.marketStructure.oiSkewPct)} OI skew`,
      score: clamp(100 - Math.abs(market.funding.bpsPerHour) * 14 - Math.abs(market.marketStructure.oiSkewPct) * 0.55, 0, 100),
      tone: Math.abs(market.funding.bpsPerHour) >= 3.2 || Math.abs(market.marketStructure.oiSkewPct) >= 48 ? "danger" : Math.abs(market.funding.bpsPerHour) >= 1.4 || Math.abs(market.marketStructure.oiSkewPct) >= 24 ? "warning" : "good"
    },
    {
      id: "solvency",
      label: "solvency",
      value: `${Math.round(market.solvency.coveragePct)}%`,
      detail: `${money(market.solvency.insuranceUsd, 0)} insurance`,
      subvalue: `${money(market.solvency.socialLossUsd, 0)} social loss`,
      score: clamp(Math.min(market.solvency.coveragePct, 120) * 0.82, 0, 100),
      tone: market.solvency.coveragePct < 28 || market.solvency.socialLossUsd > 0 ? "danger" : market.solvency.coveragePct < 55 ? "warning" : "good"
    }
  ];
}

function scoreTone(score) {
  if (score >= 68) return "good";
  if (score >= 42) return "warning";
  return "danger";
}

function money(value, digits = 2) {
  const amount = Number(value);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}m`;
  if (abs >= 10000) return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function pct(value) {
  return `${Number(value).toFixed(1)}%`;
}

function signedBps(value) {
  const next = Number(value);
  return `${next >= 0 ? "+" : ""}${next.toFixed(1)} bps`;
}

function feeLabel(value) {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 1000) return `${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k uLamports`;
  return `${Math.round(amount)} uLamports`;
}

function fmtInt(value) {
  return Number(value).toLocaleString("en-US");
}

function mean(values) {
  const numbers = values.map(Number).filter(Number.isFinite);
  if (!numbers.length) return 0;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
