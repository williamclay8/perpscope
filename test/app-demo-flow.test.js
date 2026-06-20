import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildDeploymentSummaries,
  buildTerminalRecipeSummaries,
  createImportedSnapshotState,
  DEMO_CLI_PATH,
  fetchCliDemoSnapshot,
  READ_ONLY_DEPLOYMENTS,
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
  assert.ok(nextState.compatibilityReport.recognizedSections.some((section) => section.id === "receipts"));
  assert.ok(nextState.compatibilityReport.missingFields.some((field) => field.field === "history.fundingSkew"));
});

test("surfaces Try CLI demo fetch failures", async () => {
  await assert.rejects(
    () => fetchCliDemoSnapshot(async () => ({ ok: false, text: async () => "" })),
    /CLI demo fixture unavailable/
  );
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
