import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildPercolatorCompatibilityReport,
  buildReadOnlyRpcSnapshot,
  buildWatchtowerSignals,
  compareCompatibilityReports,
  detectPercolatorInputShape,
  exportCompatibilityReport,
  normalizeFundingSkewHistory,
  normalizePercolatorSnapshot,
  PERPSCOPE_ADAPTER_VERSION,
  simulatePriceShock,
  summarizeFundingSkewHistory,
  validateReadOnlyRpcRequest
} from "../packages/percolator-adapter/index.js";
import { percolatorFixture } from "../src/fixtures/percolator-market.js";

const historyStdout = JSON.parse(
  readFileSync(new URL("../examples/funding-skew-history.stdout.json", import.meta.url), "utf8")
);
const rpcFixture = JSON.parse(
  readFileSync(new URL("../examples/percolator-mainnet-sol.readonly-rpc.json", import.meta.url), "utf8")
);
const packageDir = fileURLToPath(new URL("../packages/percolator-adapter/", import.meta.url));
const consumerDemo = fileURLToPath(new URL("../examples/adapter-consumer/demo.mjs", import.meta.url));
const cliFixture = fileURLToPath(new URL("../examples/percolator-cli.bundle.json", import.meta.url));
const fundingFixture = fileURLToPath(new URL("../examples/funding-skew-history.stdout.json", import.meta.url));
const minimalFixture = fileURLToPath(new URL("../examples/fixture-pack-minimal-terminal.json", import.meta.url));
const driftedFixture = fileURLToPath(new URL("../examples/fixture-pack-drifted-aliases.json", import.meta.url));
const packageCli = fileURLToPath(new URL("../packages/percolator-adapter/bin/perpscope.mjs", import.meta.url));

test("adapter package exposes read-only terminal DTO helpers", () => {
  const snapshot = normalizePercolatorSnapshot(percolatorFixture);
  const sol = snapshot.markets.find((market) => market.id === "sol-perp");
  const stress = simulatePriceShock(sol, -3);
  const signals = buildWatchtowerSignals(sol, stress);
  const history = normalizeFundingSkewHistory(sol.history.fundingSkew, sol);
  const report = buildPercolatorCompatibilityReport(percolatorFixture, snapshot);
  const exported = exportCompatibilityReport(percolatorFixture, snapshot, {
    generatedAt: "2026-06-21T00:00:00.000Z"
  });
  const drift = compareCompatibilityReports(report, report, {
    generatedAt: "2026-06-21T00:00:00.000Z"
  });

  assert.equal(detectPercolatorInputShape(percolatorFixture), "perpscope-snapshot");
  assert.equal(PERPSCOPE_ADAPTER_VERSION, "0.7.0");
  assert.equal(snapshot.markets.length, 3);
  assert.equal(report.compatible, true);
  assert.equal(report.status, "compatible");
  assert.equal(exported.schema, "perpscope.compatibility-report");
  assert.equal(exported.package.version, "0.7.0");
  assert.equal(drift.schema, "perpscope.compatibility-diff");
  assert.equal(drift.scoreDelta, 0);
  assert.equal(signals.find((signal) => signal.id === "carry").tone, "good");
  assert.equal(history.length, 6);
  assert.equal(history.at(-1).fundingBpsPerHour, 0.82);
  assert.doesNotMatch(JSON.stringify({ signals, history }), /connect wallet|sign transaction|send transaction|place order|submit trade|trade now/i);
});

test("adapter CLI exports reports and diffs", () => {
  const reportOutput = execFileSync("node", [packageCli, "compat", "report", driftedFixture], {
    encoding: "utf8"
  });
  const report = JSON.parse(reportOutput);
  const diffOutput = execFileSync("node", [packageCli, "compat", "diff", minimalFixture, driftedFixture], {
    encoding: "utf8"
  });
  const diff = JSON.parse(diffOutput);

  assert.equal(report.schema, "perpscope.compatibility-report");
  assert.equal(report.package.version, "0.7.0");
  assert.ok(report.aliasSuggestions.some((suggestion) => suggestion.candidatePath === "oraclePriceUsd"));
  assert.equal(diff.schema, "perpscope.compatibility-diff");
  assert.equal(diff.package.version, "0.7.0");
  assert.ok(diff.aliasSuggestions.some((suggestion) => suggestion.candidatePath === "oraclePriceUsd"));
});

test("adapter package normalizes captured carry history logs", () => {
  const history = normalizeFundingSkewHistory(historyStdout);
  const summary = summarizeFundingSkewHistory(history);

  assert.equal(history.length, 6);
  assert.equal(history[0].source, "terminal stdout");
  assert.equal(history.at(-1).oiSkewPct.toFixed(1), "8.6");
  assert.equal(summary.tone, "good");
});

test("adapter package exposes read-only RPC helpers", () => {
  const checked = validateReadOnlyRpcRequest(rpcFixture);
  const snapshot = buildReadOnlyRpcSnapshot(rpcFixture);

  assert.equal(checked.magic, "50455243");
  assert.equal(snapshot.markets[0].name, "SOL-PERP");
});

test("adapter package can be packed and imported outside the monorepo", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "perpscope-adapter-pack-"));
  try {
    const output = execFileSync("npm", ["pack", "--json", "--pack-destination", tempDir], {
      cwd: packageDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const [{ filename }] = JSON.parse(output);
    const tarball = join(tempDir, filename);
    execFileSync("tar", ["-xzf", tarball, "-C", tempDir], { stdio: "ignore" });

    const packed = await import(pathToFileURL(join(tempDir, "package", "index.js")).href);
    const snapshot = packed.normalizePercolatorSnapshot(percolatorFixture);
    const history = packed.normalizeFundingSkewHistory(historyStdout);
    const report = packed.buildPercolatorCompatibilityReport(percolatorFixture, snapshot);
    const exported = packed.exportCompatibilityReport(percolatorFixture, snapshot);
    const drift = packed.compareCompatibilityReports(report, report);

    assert.equal(snapshot.markets.length, 3);
    assert.equal(history.at(-1).oiSkewPct.toFixed(1), "8.6");
    assert.equal(typeof packed.buildWatchtowerSignals, "function");
    assert.equal(typeof packed.buildPercolatorCompatibilityReport, "function");
    assert.equal(typeof packed.exportCompatibilityReport, "function");
    assert.equal(typeof packed.compareCompatibilityReports, "function");
    assert.equal(exported.schema, "perpscope.compatibility-report");
    assert.equal(drift.schema, "perpscope.compatibility-diff");
    assert.equal(report.status, "compatible");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("adapter consumer example imports the package by name", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "perpscope-adapter-consumer-"));
  try {
    const consumerDir = join(tempDir, "adapter-consumer");
    const packageScopeDir = join(consumerDir, "node_modules", "@perpscope");
    mkdirSync(packageScopeDir, { recursive: true });
    copyFileSync(consumerDemo, join(consumerDir, "demo.mjs"));
    copyFileSync(cliFixture, join(tempDir, "percolator-cli.bundle.json"));
    copyFileSync(fundingFixture, join(tempDir, "funding-skew-history.stdout.json"));
    symlinkSync(packageDir, join(packageScopeDir, "percolator-adapter"), "dir");

    const consumer = await import(pathToFileURL(join(consumerDir, "demo.mjs")).href);
    const summary = consumer.buildTerminalSummary();

    assert.equal(summary.inputShape, "percolator-cli-bundle");
    assert.equal(summary.market, "SOL-PERP");
    assert.equal(summary.compatibility.status, "partial");
    assert.ok(summary.compatibility.missing.includes("history.fundingSkew"));
    assert.deepEqual(summary.compatibility.suggestions, []);
    assert.equal(summary.watchtower.length, 6);
    assert.equal(summary.carryLatest.fundingBpsPerHour, 0.82);
    assert.doesNotMatch(JSON.stringify(summary), /connect wallet|sign transaction|send transaction|place order|submit trade|trade now/i);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
