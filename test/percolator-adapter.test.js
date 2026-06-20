import test from "node:test";
import assert from "node:assert/strict";
import {
  assertReadOnlySnapshot,
  normalizePercolatorSnapshot,
  simulatePriceShock
} from "../src/lib/percolator-adapter.js";
import { percolatorFixture } from "../src/fixtures/percolator-market.js";

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
