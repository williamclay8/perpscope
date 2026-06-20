import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertReadOnlySnapshot,
  detectPercolatorInputShape,
  normalizePercolatorCliBundle,
  normalizePercolatorSnapshot,
  parsePercolatorJson,
  simulatePriceShock
} from "../src/lib/percolator-adapter.js";
import { percolatorFixture } from "../src/fixtures/percolator-market.js";

const cliBundle = JSON.parse(
  readFileSync(new URL("../examples/percolator-cli.bundle.json", import.meta.url), "utf8")
);

test("normalizes Percolator-like market state into terminal DTOs", () => {
  const snapshot = normalizePercolatorSnapshot(percolatorFixture);

  assert.equal(snapshot.markets.length, 3);
  assert.equal(snapshot.markets[0].name, "SOL-PERP");
  assert.ok(snapshot.markets[0].healthScore > snapshot.markets[2].healthScore);
  assert.equal(snapshot.markets[2].status, "risk");
});

test("rejects secret-bearing wallet fields in read-only snapshots", () => {
  assert.throws(
    () => assertReadOnlySnapshot({ market: { walletPath: "~/.config/solana/id.json" } }),
    /Refusing secret-bearing field/
  );
});

test("detects and normalizes Percolator CLI command bundles", () => {
  assert.equal(detectPercolatorInputShape(cliBundle), "percolator-cli-bundle");

  const snapshot = normalizePercolatorSnapshot(cliBundle);
  const [market] = snapshot.markets;

  assert.equal(snapshot.source.label, "Percolator CLI command bundle");
  assert.deepEqual(snapshot.source.commandSet, [
    "slab:get",
    "slab:params",
    "slab:engine",
    "best-price",
    "slab:account"
  ]);
  assert.equal(snapshot.currentSlot, 346892110);
  assert.equal(market.name, "SOL-PERP");
  assert.equal(market.price.mark, 181.61);
  assert.equal(market.execution.bestBid, 181.52);
  assert.equal(market.execution.bestAsk, 181.71);
  assert.equal(market.account.side, "long");
  assert.equal(market.config.initialMarginBps, 820);
  assert.ok(market.marketStructure.stressUsedPct > 20);
});

test("normalizes a CLI bundle directly before terminal DTO conversion", () => {
  const snapshot = normalizePercolatorCliBundle(cliBundle);

  assert.equal(snapshot.markets.length, 1);
  assert.equal(snapshot.markets[0].header.version, 16);
  assert.equal(snapshot.markets[0].config.maintenanceMarginBps, 500);
  assert.equal(snapshot.markets[0].oracle.publishAgeSec, 2);
});

test("extracts JSON payloads from captured CLI stdout", () => {
  const capturedStdout = `Searching for markets owned by Perco1ator...\n${JSON.stringify(cliBundle, null, 2)}\n`;
  const parsed = parsePercolatorJson(capturedStdout);

  assert.equal(parsed.label, "Percolator CLI command bundle");
  assert.equal(parsed.commands.length, 5);
});

test("downside shock reduces long account runway", () => {
  const snapshot = normalizePercolatorSnapshot(percolatorFixture);
  const sol = snapshot.markets.find((market) => market.id === "sol-perp");
  const shock = simulatePriceShock(sol, -8);

  assert.ok(shock.projectedBufferUsd < sol.account.marginBufferUsd);
  assert.ok(shock.projectedLiqDistancePct < sol.account.liquidationDistancePct);
});

test("upside shock reduces short account runway", () => {
  const snapshot = normalizePercolatorSnapshot(percolatorFixture);
  const btc = snapshot.markets.find((market) => market.id === "btc-perp");
  const shock = simulatePriceShock(btc, 8);

  assert.ok(shock.projectedPnl < btc.account.unrealizedPnlUsd);
  assert.ok(shock.projectedLiqDistancePct < btc.account.liquidationDistancePct);
});
