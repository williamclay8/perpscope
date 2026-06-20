import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildDeploymentSummaries,
  buildTerminalRecipeSummaries,
  buildWatchtowerSignals,
  createImportedSnapshotState,
  DEMO_CLI_PATH,
  fetchCliDemoSnapshot,
  READ_ONLY_DEPLOYMENTS,
  TERMINAL_RECIPES
} from "../src/app.js";
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
  assert.equal(nextState.importStatus.detail, "examples/percolator-cli.bundle.json: 1 market import, 8 commands");
  assert.equal(nextState.snapshot.source.commandSet.length, 8);
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
    "dto-export"
  ]);
  assert.equal(recipes[0].step, "01");
  assert.equal(recipes.at(-1).step, "06");
  assert.doesNotMatch(JSON.stringify({ deployments, recipes }), /connect wallet|sign transaction|send transaction|place order|submit trade|trade now/i);
  assert.equal(TERMINAL_RECIPES.find((recipe) => recipe.id === "read-only-rpc").commands, "getAccountInfo");
});
