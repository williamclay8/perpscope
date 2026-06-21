import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildDeploymentSummaries,
  buildCompatibilityReportExport,
  createActualMarketSnapshot,
  createCompatibilityWorkbenchState,
  createDataSourceState,
  buildTerminalRecipeSummaries,
  createImportedSnapshotState,
  fetchActualMarketSnapshot,
  ACTUAL_PRICE_ENDPOINT,
  DEMO_CLI_PATH,
  fetchCliDemoSnapshot,
  fetchStaticRealSnapshot,
  READ_ONLY_DEPLOYMENTS,
  STATIC_REAL_SNAPSHOT_PATH,
  TERMINAL_RECIPES
} from "../src/app.js";
import { buildWatchtowerSignals } from "../src/lib/watchtower-signals.js";
import {
  normalizeFundingSkewHistory,
  summarizeFundingSkewHistory
} from "../src/lib/funding-history.js";
import {
  normalizePercolatorSnapshot,
  simulatePriceShock
} from "../src/lib/percolator-adapter.js";
import { percolatorFixture } from "../src/fixtures/percolator-market.js";

const cliBundleText = readFileSync(
  new URL("../examples/percolator-cli.bundle.json", import.meta.url),
  "utf8"
);

test("loads Try CLI demo through the same import state path", async () => {
  let requestedUrl = "";
  const imported = await fetchCliDemoSnapshot(async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      text: async () => cliBundleText
    };
  });
  const nextState = createImportedSnapshotState(imported, {
    label: "demo cli loaded",
    detailPrefix: DEMO_CLI_PATH.replace(/^\.\//, "")
  });

  assert.equal(requestedUrl, DEMO_CLI_PATH);
  assert.equal(nextState.selectedMarketId, "sol-perp");
  assert.equal(nextState.importStatus.label, "demo cli loaded");
  assert.equal(nextState.importStatus.tone, "warning");
  assert.equal(nextState.importStatus.detail, "examples/percolator-cli.bundle.json: 1 market import, 8 commands, 2 missing fields");
  assert.equal(nextState.snapshot.source.commandSet.length, 8);
  assert.equal(nextState.compatibilityReport.shape, "percolator-cli-bundle");
  assert.equal(nextState.compatibilityReport.status, "partial");
  assert.equal(nextState.compatibilityDiff.schema, "perpscope.compatibility-diff");
  assert.equal(nextState.realityCheck.schema, "perpscope.reality-check");
  assert.equal(nextState.realityCheck.mapped.requiredCount, 3);
  assert.ok(nextState.compatibilityDiff.scoreDelta < 0);
  assert.ok(nextState.compatibilityReport.recognizedSections.some((section) => section.id === "receipts"));
  assert.ok(nextState.compatibilityReport.missingFields.some((field) => field.field === "history.fundingSkew"));
  assert.equal(nextState.lastImportedInput, imported);
});

test("exports the current cockpit compatibility report", async () => {
  const imported = JSON.parse(cliBundleText);
  const nextState = createImportedSnapshotState(imported);
  const exported = buildCompatibilityReportExport(
    nextState.lastImportedInput,
    nextState.snapshot,
    nextState.compatibilityReport,
    { generatedAt: "2026-06-21T00:00:00.000Z" }
  );

  assert.equal(exported.schema, "perpscope.compatibility-report");
  assert.equal(exported.generatedAt, "2026-06-21T00:00:00.000Z");
  assert.equal(exported.shape, "percolator-cli-bundle");
  assert.equal(exported.source.commandSet.length, 8);
  assert.equal(exported.summary.missingCount, 2);
  assert.deepEqual(exported.safety, { mode: "read-only", rejected: false });
  assert.equal(exported.summary.suggestionCount, 0);
});

test("builds a local compatibility workbench diff", () => {
  const previous = {
    label: "workbench previous",
    market: { symbol: "SOL-PERP", slab: "PERCOLAT_SOL", program: "Perco1ator" },
    oracle: { priceUsd: 181.61, ageSecs: 2 },
    engine: { fundingRateBpsPerHour: 0.82, openInterestUsd: 12500000 },
    execution: { bestBid: 181.52, bestAsk: 181.71 }
  };
  const current = {
    label: "workbench current",
    market: { symbol: "SOL-PERP", slab: "PERCOLAT_SOL", program: "Perco1ator" },
    oraclePriceUsd: 181.61,
    oracleAgeSeconds: 2,
    oiUsd: 12500000
  };
  const workbench = createCompatibilityWorkbenchState(previous, current);

  assert.equal(workbench.diff.schema, "perpscope.compatibility-diff");
  assert.ok(workbench.diff.summary.newMissingCount > 0);
  assert.ok(workbench.diff.aliasSuggestions.some((suggestion) => suggestion.candidatePath === "oraclePriceUsd"));
  assert.match(workbench.previousText, /workbench previous/);
  assert.match(workbench.currentText, /workbench current/);
});

test("surfaces Try CLI demo fetch failures", async () => {
  await assert.rejects(
    () => fetchCliDemoSnapshot(async () => ({ ok: false, text: async () => "" })),
    /CLI demo fixture unavailable/
  );
});

test("loads the static real-backed snapshot through the import path", async () => {
  let requestedUrl = "";
  const imported = await fetchStaticRealSnapshot(async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      text: async () => readFileSync(new URL("../examples/static-real-snapshot.json", import.meta.url), "utf8")
    };
  });
  const nextState = createImportedSnapshotState(imported, {
    label: "static real loaded",
    detailPrefix: STATIC_REAL_SNAPSHOT_PATH.replace(/^\.\//, ""),
    dataSourceMode: "static-real"
  });

  assert.equal(requestedUrl, STATIC_REAL_SNAPSHOT_PATH);
  assert.equal(nextState.dataSource.mode, "static-real");
  assert.equal(nextState.dataSource.tone, "warning");
  assert.ok(nextState.dataSource.chips.includes("not live"));
  assert.equal(nextState.snapshot.markets[0].name, "SOL-PERP");
  assert.equal(nextState.snapshot.markets[0].execution.receipts.length, 1);
});

test("loads actual public prices without claiming live protocol state", async () => {
  let requestedUrl = "";
  const imported = await fetchActualMarketSnapshot(async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      text: async () => JSON.stringify({
        solana: { usd: 73.36, usd_24h_change: 2.67, last_updated_at: 1782040863 },
        bitcoin: { usd: 64129, usd_24h_change: 0.73, last_updated_at: 1782040864 },
        dogwifcoin: { usd: 0.162, usd_24h_change: 0.2, last_updated_at: 1782040862 }
      })
    };
  }, { nowMs: 1782040875000 });
  const nextState = createImportedSnapshotState(imported, {
    label: "live prices loaded",
    detailPrefix: "CoinGecko public price feed",
    dataSourceMode: "live-read"
  });

  assert.equal(requestedUrl, ACTUAL_PRICE_ENDPOINT);
  assert.equal(nextState.dataSource.mode, "live-read");
  assert.equal(nextState.dataSource.tone, "good");
  assert.ok(nextState.dataSource.chips.includes("live public prices"));
  assert.match(nextState.dataSource.note, /simulated risk context/);
  assert.equal(nextState.snapshot.markets.find((market) => market.id === "sol-perp").price.mark, 73.36);
  assert.equal(nextState.lastImportedInput.source.live, true);
  assert.match(nextState.lastImportedInput.source.note, /not live decoded protocol state/i);
});

test("builds actual market snapshots from public price feeds", () => {
  const snapshot = createActualMarketSnapshot({
    solana: { usd: 80, usd_24h_change: 4, last_updated_at: 1782040800 }
  }, { nowMs: 1782040860000 });
  const sol = snapshot.markets.find((market) => market.id === "sol-perp");

  assert.equal(snapshot.source.kind, "public-market-price-feed");
  assert.equal(snapshot.source.live, true);
  assert.equal(snapshot.source.realBacked, true);
  assert.equal(sol.oracle.markPrice, 80);
  assert.equal(sol.account.label, "Simulated risk context");
  assert.equal(sol.execution.receipts[0].source, "CoinGecko simple price");
});

test("builds explicit data source states for cockpit disclosure", () => {
  const fixtureState = createDataSourceState("fixture", percolatorFixture, normalizePercolatorSnapshot(percolatorFixture), { shape: "perpscope-snapshot" });
  const liveState = createDataSourceState("live-read", { source: { live: true } }, { source: {}, cluster: "mainnet-beta", markets: [] }, { shape: "read-only-rpc-fetch" });

  assert.equal(fixtureState.note, "default cockpit data is a local fixture");
  assert.equal(fixtureState.modes.find((mode) => mode.id === "fixture").active, true);
  assert.equal(liveState.note, "actual public prices; simulated risk context");
  assert.ok(liveState.chips.includes("live public prices"));
});

test("builds read-only Watchtower signals from normalized market data", () => {
  const snapshot = normalizePercolatorSnapshot(percolatorFixture);
  const sol = snapshot.markets.find((market) => market.id === "sol-perp");
  const signals = buildWatchtowerSignals(sol, simulatePriceShock(sol, -3));

  assert.deepEqual(signals.map((signal) => signal.id), [
    "runway",
    "freshness",
    "execution",
    "impact",
    "carry",
    "solvency"
  ]);
  assert.ok(signals.every((signal) => Number.isFinite(signal.score)));
  assert.ok(signals.every((signal) => ["good", "warning", "danger"].includes(signal.tone)));
  assert.equal(signals.find((signal) => signal.id === "execution").value, "+0.3 bps");
  assert.doesNotMatch(JSON.stringify(signals), /connect|wallet|sign|send|place|order|trade now/i);
});

test("Watchtower escalates degraded markets without action controls", () => {
  const snapshot = normalizePercolatorSnapshot(percolatorFixture);
  const wif = snapshot.markets.find((market) => market.id === "wif-perp");
  const signals = buildWatchtowerSignals(wif, simulatePriceShock(wif, -5));

  assert.ok(signals.filter((signal) => signal.tone === "danger").length >= 3);
  assert.equal(signals.find((signal) => signal.id === "solvency").tone, "danger");
  assert.match(signals.find((signal) => signal.id === "execution").detail, /ms route/);
});

test("Watchtower does not call missing impact ratios flat when absolute impact is high", () => {
  const snapshot = normalizePercolatorSnapshot(percolatorFixture);
  const sol = snapshot.markets.find((market) => market.id === "sol-perp");
  const signals = buildWatchtowerSignals({
    ...sol,
    execution: {
      ...sol.execution,
      impact10kBps: 0,
      impact50kBps: 80
    }
  });
  const impact = signals.find((signal) => signal.id === "impact");

  assert.equal(impact.value, "80.0 bps");
  assert.equal(impact.tone, "danger");
  assert.ok(impact.score < 20);
});

test("builds deployment and recipe summaries for the cockpit", () => {
  const deployments = buildDeploymentSummaries();
  const recipes = buildTerminalRecipeSummaries();

  assert.equal(deployments.length, READ_ONLY_DEPLOYMENTS.length);
  assert.deepEqual(deployments.map((deployment) => deployment.id), ["mainnet-sol", "devnet-wif"]);
  assert.ok(deployments.every((deployment) => deployment.ownerShort.includes("...")));
  assert.ok(deployments.every((deployment) => Number.isFinite(deployment.freshnessPct)));
  assert.deepEqual(recipes.map((recipe) => recipe.id), [
    "file-import",
    "drag-drop-stdout",
    "command-bundle",
    "list-markets",
    "read-only-rpc",
    "carry-history",
    "dto-export",
    "capture-intake"
  ]);
  assert.equal(recipes[0].step, "01");
  assert.equal(recipes.at(-1).step, "08");
  assert.doesNotMatch(JSON.stringify({ deployments, recipes }), /connect wallet|sign transaction|send transaction|place order|submit trade|trade now/i);
  assert.equal(TERMINAL_RECIPES.find((recipe) => recipe.id === "read-only-rpc").commands, "getAccountInfo");
});

test("flags unknown imported captures without a good import status", () => {
  assert.throws(
    () => createImportedSnapshotState({ foo: "bar" }),
    /no recognized Percolator sections/
  );

  const nextState = createImportedSnapshotState({
    label: "partial capture",
    market: { symbol: "SOL-PERP", slab: "PERCOLAT_SOL", program: "Perco1ator" },
    oracle: { priceUsd: 181.61, ageSecs: 2 }
  });

  assert.equal(nextState.importStatus.tone, "warning");
  assert.equal(nextState.snapshot.markets[0].name, "SOL-PERP");
  assert.equal(nextState.compatibilityReport.status, "partial");
  assert.ok(nextState.compatibilityReport.summary.missingCount > 0);
  assert.equal(nextState.compatibilityDiff.schema, "perpscope.compatibility-diff");
});

test("builds funding and skew history summaries for the cockpit", () => {
  const snapshot = normalizePercolatorSnapshot(percolatorFixture);
  const wif = snapshot.markets.find((market) => market.id === "wif-perp");
  const history = normalizeFundingSkewHistory(wif.history.fundingSkew, wif);
  const summary = summarizeFundingSkewHistory(history);

  assert.equal(history.length, 6);
  assert.equal(summary.latest.fundingBpsPerHour, 3.9);
  assert.equal(summary.tone, "danger");
  assert.ok(summary.stressMaxPct > 75);
});
