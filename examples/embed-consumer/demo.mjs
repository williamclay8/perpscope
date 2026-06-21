import { readFileSync } from "node:fs";

export function buildPerpScopeEmbedSummary(exportPayload) {
  if (exportPayload?.schema !== "perpscope.export.v1") {
    throw new Error("Expected a perpscope.export.v1 payload.");
  }

  const feedItems = new Map((exportPayload.feedHealth?.items || []).map((item) => [item.label, item.value]));
  const topMarket = exportPayload.radar?.rows?.[0] || {};
  const reasons = exportPayload.market?.whyHot?.reasons || [];

  return {
    source: exportPayload.source?.live ? "live" : exportPayload.source?.mode || "fixture",
    market: exportPayload.market?.name || topMarket.name,
    heat: topMarket.scoreLabel || `${topMarket.heat || 0} heat`,
    feedHealth: {
      markets: feedItems.get("markets") || "0",
      slot: feedItems.get("slot") || "0",
      unitChecks: feedItems.get("unit checks") || "0",
      gaps: feedItems.get("gaps") || "0"
    },
    whyHot: reasons.map((reason) => `${reason.label}: ${reason.value}`),
    readOnly: exportPayload.safety?.wallet === false &&
      exportPayload.safety?.signer === false &&
      exportPayload.safety?.transaction === false &&
      exportPayload.safety?.orderRouting === false
  };
}

const sample = JSON.parse(readFileSync(new URL("../perpscope-export.sample.json", import.meta.url), "utf8"));
console.log(JSON.stringify(buildPerpScopeEmbedSummary(sample), null, 2));
