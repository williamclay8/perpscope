import { readFileSync } from "node:fs";
import {
  buildPercolatorCompatibilityReport,
  buildWatchtowerSignals,
  detectPercolatorInputShape,
  normalizeFundingSkewHistory,
  normalizePercolatorSnapshot,
  simulatePriceShock
} from "@perpscope/percolator-adapter";

const defaultFixtureUrl = new URL("../percolator-cli.bundle.json", import.meta.url);
const defaultHistoryUrl = new URL("../funding-skew-history.stdout.json", import.meta.url);

export function loadFixture(url = defaultFixtureUrl) {
  return JSON.parse(readFileSync(url, "utf8"));
}

export function buildTerminalSummary(input = loadFixture(), historyInput = loadFixture(defaultHistoryUrl)) {
  const inputShape = detectPercolatorInputShape(input);
  const snapshot = normalizePercolatorSnapshot(input);
  const market = snapshot.markets[0];
  const stress = simulatePriceShock(market, -5);
  const compatibility = buildPercolatorCompatibilityReport(input, snapshot);
  const watchtower = buildWatchtowerSignals(market, stress);
  const carryHistory = normalizeFundingSkewHistory(historyInput, market);

  return {
    inputShape,
    cluster: snapshot.cluster,
    market: market.name,
    status: market.status,
    healthScore: market.healthScore,
    compatibility: {
      status: compatibility.status,
      score: compatibility.score,
      missing: compatibility.missingFields.map((field) => field.field),
      suggestions: compatibility.aliasSuggestions.map((suggestion) => ({
        field: suggestion.field,
        candidatePath: suggestion.candidatePath,
        confidence: suggestion.confidence
      }))
    },
    watchtower: watchtower.map((signal) => ({
      id: signal.id,
      value: signal.value,
      tone: signal.tone
    })),
    carryLatest: carryHistory.at(-1),
    provenance: {
      source: snapshot.source.label,
      commands: snapshot.source.commandSet,
      slab: market.slab,
      program: market.program
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(buildTerminalSummary(), null, 2));
}
