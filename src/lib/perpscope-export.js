export const PERPSCOPE_EXPORT_SCHEMA = "perpscope.export.v1";

const READ_ONLY_FIELDS = ["wallet", "signer", "transaction", "orderRouting"];

export function parsePerpScopeExport(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Expected a PerpScope export object.");
  }
  if (payload.schema !== PERPSCOPE_EXPORT_SCHEMA) {
    throw new Error(`Expected ${PERPSCOPE_EXPORT_SCHEMA}.`);
  }
  if (!payload.market || typeof payload.market !== "object") {
    throw new Error("PerpScope export is missing market context.");
  }
  if (!payload.feedHealth || typeof payload.feedHealth !== "object") {
    throw new Error("PerpScope export is missing feed health.");
  }
  if (!payload.radar || !Array.isArray(payload.radar.rows)) {
    throw new Error("PerpScope export is missing radar rows.");
  }
  if (!payload.safety || READ_ONLY_FIELDS.some((field) => payload.safety[field] !== false)) {
    throw new Error("PerpScope export must declare read-only safety fields.");
  }

  return payload;
}

export function feedHealthMap(payload) {
  const exportPayload = parsePerpScopeExport(payload);
  return Object.fromEntries((exportPayload.feedHealth.items || []).map((item) => [item.label, item]));
}

export function summarizeFeedHealth(payload) {
  const exportPayload = parsePerpScopeExport(payload);
  const items = feedHealthMap(exportPayload);
  return {
    status: exportPayload.feedHealth.status || "unknown",
    tone: exportPayload.feedHealth.tone || "neutral",
    markets: items.markets?.value || "0",
    slot: items.slot?.value || "0",
    age: items.age?.value || "unknown",
    unitChecks: items["unit checks"]?.value || "0",
    gaps: items.gaps?.value || "0",
    chips: exportPayload.feedHealth.chips || []
  };
}

export function rankRadarRows(payload) {
  const exportPayload = parsePerpScopeExport(payload);
  return [...exportPayload.radar.rows].sort((left, right) => {
    const heatDelta = Number(right.heat || 0) - Number(left.heat || 0);
    if (heatDelta) return heatDelta;
    return String(left.name || left.id).localeCompare(String(right.name || right.id));
  });
}

export function summarizePerpScopeExport(payload) {
  const exportPayload = parsePerpScopeExport(payload);
  const feedHealth = summarizeFeedHealth(exportPayload);
  const topMarket = rankRadarRows(exportPayload)[0] || {};
  const reasons = exportPayload.market.whyHot?.reasons || [];

  return {
    schema: exportPayload.schema,
    version: exportPayload.version || "",
    generatedAt: exportPayload.generatedAt || "",
    source: exportPayload.source?.live ? "live" : exportPayload.source?.mode || "fixture",
    market: exportPayload.market.name || topMarket.name || "",
    marketId: exportPayload.market.id || topMarket.id || "",
    status: exportPayload.market.status || "",
    heat: topMarket.scoreLabel || `${topMarket.heat || 0} heat`,
    feedHealth,
    whyHot: reasons.map((reason) => ({
      label: reason.label,
      value: reason.value,
      tone: reason.tone || "neutral"
    })),
    adapterTargets: exportPayload.adapterTargets?.targets || [],
    readOnly: READ_ONLY_FIELDS.every((field) => exportPayload.safety[field] === false)
  };
}
