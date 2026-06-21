import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertReadOnlySnapshot,
  buildPercolatorCompatibilityReport,
  compareCompatibilityReports,
  detectPercolatorInputShape,
  exportCompatibilityReport,
  normalizePercolatorCliBundle,
  normalizePercolatorSnapshot,
  PERPSCOPE_ADAPTER_VERSION,
  parsePercolatorJson,
  simulatePriceShock
} from "../src/lib/percolator-adapter.js";
import {
  buildReadOnlyRpcSnapshot,
  fetchReadOnlyRpcSnapshot,
  summarizeReadOnlyRpcDeployment,
  validateReadOnlyRpcRequest
} from "../src/lib/read-only-rpc-fetcher.js";
import {
  normalizeFundingSkewHistory,
  summarizeFundingSkewHistory
} from "../src/lib/funding-history.js";
import { percolatorFixture } from "../src/fixtures/percolator-market.js";

const cliBundle = JSON.parse(
  readFileSync(new URL("../examples/percolator-cli.bundle.json", import.meta.url), "utf8")
);
const listMarketsStdout = JSON.parse(
  readFileSync(new URL("../examples/percolator-list-markets.stdout.json", import.meta.url), "utf8")
);
const receiptStdout = JSON.parse(
  readFileSync(new URL("../examples/execution-receipts.stdout.json", import.meta.url), "utf8")
);
const rpcFetchFixture = JSON.parse(
  readFileSync(new URL("../examples/read-only-rpc.fetch.json", import.meta.url), "utf8")
);
const mainnetSolDeployment = JSON.parse(
  readFileSync(new URL("../examples/percolator-mainnet-sol.readonly-rpc.json", import.meta.url), "utf8")
);
const devnetWifDeployment = JSON.parse(
  readFileSync(new URL("../examples/percolator-devnet-wif.readonly-rpc.json", import.meta.url), "utf8")
);
const terminalRecipes = JSON.parse(
  readFileSync(new URL("../examples/terminal-recipes.json", import.meta.url), "utf8")
);
const historyStdout = JSON.parse(
  readFileSync(new URL("../examples/funding-skew-history.stdout.json", import.meta.url), "utf8")
);

test("normalizes Percolator-like market state into terminal DTOs", () => {
  const snapshot = normalizePercolatorSnapshot(percolatorFixture);

  assert.equal(snapshot.markets.length, 3);
  assert.equal(snapshot.markets[0].name, "SOL-PERP");
  assert.ok(snapshot.markets[0].healthScore > snapshot.markets[2].healthScore);
  assert.equal(snapshot.markets[2].status, "risk");
  assert.equal(snapshot.markets[0].execution.receipts.length, 3);
  assert.equal(snapshot.markets[0].execution.receipts[0].spreadBps, 10.5);
  assert.equal(snapshot.markets[2].execution.receipts[1].routeLatencyMs, 566);
  assert.equal(snapshot.markets[0].history.fundingSkew.length, 6);
  assert.equal(snapshot.markets[2].history.fundingSkew.at(-1).fundingBpsPerHour, 3.9);
});

test("rejects secret-bearing wallet fields in read-only snapshots", () => {
  assert.throws(
    () => assertReadOnlySnapshot({ market: { walletPath: "~/.config/solana/id.json" } }),
    /Refusing secret-bearing field/
  );
  assert.throws(
    () => assertReadOnlySnapshot({ market: { privateKey: "nope" } }),
    /Refusing secret-bearing field/
  );
  assert.throws(
    () => assertReadOnlySnapshot({ market: { secretKey: "nope" } }),
    /Refusing secret-bearing field/
  );
});

test("detects and normalizes Percolator CLI command bundles", () => {
  assert.equal(detectPercolatorInputShape(cliBundle), "percolator-cli-bundle");

  const snapshot = normalizePercolatorSnapshot(cliBundle);
  const [market] = snapshot.markets;

  assert.equal(snapshot.source.label, "Percolator CLI demo");
  assert.deepEqual(snapshot.source.commandSet, [
    "slab:get",
    "slab:params",
    "slab:engine",
    "best-price",
    "execution:receipts",
    "slab:account",
    "slab:accounts",
    "slab:bitmap"
  ]);
  assert.equal(snapshot.currentSlot, 346892110);
  assert.equal(market.name, "SOL-PERP");
  assert.equal(market.price.mark, 181.61);
  assert.equal(market.execution.bestBid, 181.52);
  assert.equal(market.execution.bestAsk, 181.71);
  assert.equal(market.execution.receipts.length, 3);
  assert.equal(market.execution.receipts[1].markout5mBps, 9.4);
  assert.equal(market.execution.receipts[2].source, "percolator cli");
  assert.equal(market.account.side, "long");
  assert.equal(market.config.initialMarginBps, 820);
  assert.equal(market.crank.activeAccounts, 72);
  assert.equal(market.crank.maxAccounts, 4096);
  assert.ok(market.marketStructure.stressUsedPct > 20);
});

test("normalizes a CLI bundle directly before terminal DTO conversion", () => {
  const snapshot = normalizePercolatorCliBundle(cliBundle);

  assert.equal(snapshot.markets.length, 1);
  assert.equal(snapshot.markets[0].header.version, 16);
  assert.equal(snapshot.markets[0].config.maintenanceMarginBps, 500);
  assert.equal(snapshot.markets[0].oracle.publishAgeSec, 2);
});

test("builds a compatibility report for Percolator CLI captures", () => {
  const snapshot = normalizePercolatorSnapshot(cliBundle);
  const report = buildPercolatorCompatibilityReport(cliBundle, snapshot);

  assert.equal(report.shape, "percolator-cli-bundle");
  assert.equal(report.status, "partial");
  assert.equal(report.compatible, false);
  assert.equal(report.source.commandSet.length, 8);
  assert.equal(report.summary.marketCount, 1);
  assert.ok(report.score > 50);
  assert.ok(report.recognizedSections.some((section) => section.id === "price"));
  assert.ok(report.recognizedSections.some((section) => section.id === "receipts"));
  assert.ok(report.missingFields.some((field) => field.field === "history.fundingSkew"));
  assert.doesNotMatch(JSON.stringify(report), /connect wallet|sign transaction|send transaction|place order|submit trade|trade now/i);
});

test("exports a stable compatibility report artifact", () => {
  const exported = exportCompatibilityReport(cliBundle, undefined, {
    generatedAt: "2026-06-21T00:00:00.000Z"
  });

  assert.equal(exported.schema, "perpscope.compatibility-report");
  assert.equal(exported.version, 1);
  assert.equal(exported.package.name, "@perpscope/percolator-adapter");
  assert.equal(exported.package.version, PERPSCOPE_ADAPTER_VERSION);
  assert.equal(exported.generatedAt, "2026-06-21T00:00:00.000Z");
  assert.deepEqual(exported.safety, { mode: "read-only", rejected: false });
  assert.equal(exported.shape, "percolator-cli-bundle");
  assert.equal(exported.status, "partial");
  assert.equal(exported.source.commandSet.length, 8);
  assert.equal(exported.summary.missingCount, 2);
  assert.equal(exported.summary.suggestionCount, 0);
  assert.deepEqual(exported.aliasSuggestions, []);
  assert.ok(exported.recognizedSections.some((section) => section.id === "receipts"));
  assert.ok(exported.missingFields.some((field) => field.field === "history.fundingSkew"));
  assert.doesNotMatch(JSON.stringify(exported), /connect wallet|sign transaction|send transaction|place order|submit trade|trade now/i);
});

test("suggests aliases for ignored fields that look like missing terminal fields", () => {
  const report = buildPercolatorCompatibilityReport({
    label: "terminal drift sample",
    market: { symbol: "SOL-PERP", slab: "PERCOLAT_SOL", program: "Perco1ator" },
    oraclePriceUsd: 181.61,
    oracleAgeSeconds: 2,
    oiUsd: 12500000
  });

  assert.equal(report.status, "partial");
  assert.ok(report.ignoredFields.some((field) => field.path === "oraclePriceUsd"));
  assert.ok(report.aliasSuggestions.some((suggestion) => suggestion.field === "price.mark" && suggestion.candidatePath === "oraclePriceUsd"));
  assert.ok(report.aliasSuggestions.some((suggestion) => suggestion.field === "price.publishAgeSec" && suggestion.candidatePath === "oracleAgeSeconds"));
  assert.ok(report.aliasSuggestions.some((suggestion) => suggestion.field === "marketStructure.openInterestUsd" && suggestion.candidatePath === "oiUsd"));
});

test("compares compatibility reports for drift and alias suggestions", () => {
  const previous = buildPercolatorCompatibilityReport(percolatorFixture);
  const current = buildPercolatorCompatibilityReport({
    label: "terminal drift sample",
    market: { symbol: "SOL-PERP", slab: "PERCOLAT_SOL", program: "Perco1ator" },
    oraclePriceUsd: 181.61,
    oracleAgeSeconds: 2,
    oiUsd: 12500000,
    mysteryEnvelope: { value: 1 }
  });
  const diff = compareCompatibilityReports(previous, current, {
    generatedAt: "2026-06-21T00:00:00.000Z"
  });

  assert.equal(diff.schema, "perpscope.compatibility-diff");
  assert.equal(diff.package.version, PERPSCOPE_ADAPTER_VERSION);
  assert.equal(diff.generatedAt, "2026-06-21T00:00:00.000Z");
  assert.equal(diff.statusChanged, true);
  assert.ok(diff.scoreDelta < 0);
  assert.equal(diff.summary.newMissingCount, 9);
  assert.equal(diff.summary.newIgnoredCount, 4);
  assert.equal(diff.summary.suggestionCount, 3);
  assert.ok(diff.aliasSuggestions.some((suggestion) => suggestion.candidatePath === "oraclePriceUsd"));
  assert.ok(diff.removedSections.some((section) => section.id === "history"));
});

test("refuses to export secret-bearing compatibility captures", () => {
  assert.throws(
    () => exportCompatibilityReport({ market: { slab: "SOL", privateKey: "nope" } }),
    /Refusing secret-bearing field/
  );
});

test("reports unknown captures as not compatible instead of successful market imports", () => {
  const report = buildPercolatorCompatibilityReport({ foo: "bar" });

  assert.equal(report.shape, "unknown");
  assert.equal(report.status, "unknown");
  assert.equal(report.compatible, false);
  assert.equal(report.tone, "danger");
  assert.ok(report.missingFields.some((field) => field.field === "market.slab"));
  assert.ok(report.missingFields.some((field) => field.field === "price.mark"));
  assert.deepEqual(report.ignoredFields.map((field) => field.path), ["foo"]);
});

test("reports partial decoded captures without treating ignored fields as mapped", () => {
  const report = buildPercolatorCompatibilityReport({
    label: "partial capture",
    cluster: "devnet",
    market: { symbol: "SOL-PERP", slab: "PERCOLAT_SOL", program: "Perco1ator" },
    oracle: { priceUsd: 181.61, ageSecs: 2 },
    unexpectedEnvelope: { value: 1 }
  });

  assert.equal(report.shape, "unknown");
  assert.equal(report.status, "partial");
  assert.equal(report.compatible, false);
  assert.equal(report.source.slab, "PERCOLAT_SOL");
  assert.ok(report.recognizedSections.some((section) => section.id === "market"));
  assert.ok(report.recognizedSections.some((section) => section.id === "price"));
  assert.ok(report.ignoredFields.some((field) => field.path === "unexpectedEnvelope"));
});

test("classifies raw funding row arrays as carry history, not market arrays", () => {
  const rows = [{ fundingBpsPerHour: 1.2, oiSkewPct: 9, sourceTimestamp: "2026-06-20T00:00:00Z" }];
  const report = buildPercolatorCompatibilityReport(rows);

  assert.equal(detectPercolatorInputShape(rows), "funding-skew-history");
  assert.equal(report.shape, "funding-skew-history");
  assert.ok(report.recognizedSections.some((section) => section.id === "history"));
});

test("reports read-only RPC fixtures against decoded account sections", () => {
  const snapshot = buildReadOnlyRpcSnapshot(mainnetSolDeployment);
  const report = buildPercolatorCompatibilityReport(mainnetSolDeployment, snapshot);

  assert.equal(report.shape, "read-only-rpc-fetch");
  assert.equal(report.source.slab, mainnetSolDeployment.slab);
  assert.equal(report.source.program, mainnetSolDeployment.programId);
  assert.ok(report.recognizedSections.some((section) => section.id === "price"));
  assert.ok(report.recognizedSections.some((section) => section.id === "engine"));
});

test("rejects mutating fields while building compatibility reports", () => {
  assert.throws(
    () => buildPercolatorCompatibilityReport({ market: { privateKey: "secret" } }),
    /Refusing secret-bearing field/
  );
  assert.throws(
    () => buildPercolatorCompatibilityReport({ market: { signer: "nope" } }),
    /Refusing mutating field/
  );
  assert.throws(
    () =>
      buildPercolatorCompatibilityReport({
        command: "slab:get",
        stdoutText: JSON.stringify({ market: { transaction: "nope" } })
      }),
    /Refusing mutating field/
  );
});

test("uses nested slab:get market metadata from command-only bundles", () => {
  const snapshot = normalizePercolatorSnapshot({
    label: "command-only slab get",
    cluster: "local fixture",
    commands: [
      {
        command: "slab:get",
        output: {
          slab: "PERCOLAT_SOL",
          dataLen: 524800,
          market: {
            symbol: "SOL-PERP",
            base: "SOL",
            quote: "USDC",
            slab: "PERCOLAT_SOL",
            program: "Perco1ator"
          },
          header: { version: 16 },
          config: { maxStalenessSecs: 8 }
        }
      },
      { command: "best-price", output: { oracle: { priceUsd: 181.61 } } }
    ]
  });

  assert.equal(snapshot.markets[0].name, "SOL-PERP");
  assert.equal(snapshot.markets[0].slab, "PERCOLAT_SOL");
  assert.equal(snapshot.markets[0].program, "Perco1ator");
});

test("extracts JSON payloads from captured CLI stdout", () => {
  const capturedStdout = `Searching for markets owned by Perco1ator...\n${JSON.stringify(cliBundle, null, 2)}\n`;
  const parsed = parsePercolatorJson(capturedStdout);

  assert.equal(parsed.label, "Percolator CLI demo");
  assert.equal(parsed.commands.length, 8);
});

test("extracts JSON payloads from ANSI and bracket-prefixed CLI stdout", () => {
  const capturedStdout = `\u001b[32m[INFO]\u001b[0m loading\n${JSON.stringify(cliBundle)}\n[INFO] done`;
  const parsed = parsePercolatorJson(capturedStdout);

  assert.equal(parsed.label, "Percolator CLI demo");
});

test("normalizes captured list-markets stdout before snapshot shapes", () => {
  assert.equal(detectPercolatorInputShape(listMarketsStdout), "percolator-cli-bundle");

  const snapshot = normalizePercolatorSnapshot(listMarketsStdout);

  assert.deepEqual(snapshot.source.commandSet, ["list-markets"]);
  assert.equal(snapshot.markets.length, 3);
  assert.equal(snapshot.markets[0].name, "SOL-PERP");
  assert.equal(snapshot.markets[1].slab, "PERCOLAT_BTC_Aw71...Tq9");
});

test("normalizes captured execution receipt stdout", () => {
  assert.equal(detectPercolatorInputShape(receiptStdout), "percolator-cli-bundle");

  const snapshot = normalizePercolatorSnapshot(receiptStdout);
  const [market] = snapshot.markets;

  assert.deepEqual(snapshot.source.commandSet, ["execution:receipts"]);
  assert.equal(market.name, "SOL-PERP");
  assert.equal(market.price.mark, 181.61);
  assert.equal(market.execution.bestBid, 181.52);
  assert.equal(market.execution.receipts.length, 2);
  assert.equal(market.execution.receipts[0].priorityFeeMicrolamports, 2200);
  assert.equal(market.execution.receipts[1].markout5mBps, -6.8);
});

test("normalizes captured funding and skew history stdout", () => {
  assert.equal(detectPercolatorInputShape(historyStdout), "funding-skew-history");

  const snapshot = normalizePercolatorSnapshot(historyStdout);
  const history = normalizeFundingSkewHistory(historyStdout, snapshot.markets[0]);
  const summary = summarizeFundingSkewHistory(history);

  assert.equal(snapshot.markets[0].history.fundingSkew.length, 6);
  assert.equal(history.at(-1).fundingBpsPerHour, 0.82);
  assert.equal(history.at(-1).oiSkewPct.toFixed(1), "8.6");
  assert.equal(summary.tone, "good");
});

test("rejects secret-bearing fields in funding history logs", () => {
  assert.throws(
    () => normalizeFundingSkewHistory({ rows: [{ sourceTimestamp: "now", walletPath: "~/.config/solana/id.json" }] }),
    /Refusing mutating field/
  );
  for (const key of ["signer", "transaction", "instruction", "order", "privateKey", "secretKey"]) {
    assert.throws(
      () => normalizeFundingSkewHistory({ rows: [{ sourceTimestamp: "now", fundingBpsPerHour: 1, [key]: "nope" }] }),
      /Refusing mutating field/
    );
  }
  assert.throws(
    () => normalizeFundingSkewHistory({
      commands: [
        {
          command: "funding-history",
          stdoutText: "{\"rows\":[{\"fundingBpsPerHour\":1,\"walletPath\":\"~/.config/solana/id.json\"}]}"
        }
      ]
    }),
    /Refusing mutating field/
  );
});

test("keeps the latest funding history rows after chronological normalization", () => {
  const rows = Array.from({ length: 50 }, (_, index) => ({
    slot: index + 1,
    fundingBpsPerHour: index + 1
  }));
  const normalized = normalizeFundingSkewHistory({ rows });
  const summary = summarizeFundingSkewHistory(normalized);

  assert.equal(normalized.length, 48);
  assert.equal(normalized[0].slot, 3);
  assert.equal(normalized.at(-1).slot, 50);
  assert.equal(summary.latest.fundingBpsPerHour, 50);
});

test("normalizes receipt wrapper containers", () => {
  const receipt = {
    label: "imported fill",
    sourceTimestamp: "2026-06-20T13:24:12Z",
    spreadBps: 11,
    impactBps: 7,
    markout1mBps: 3,
    markout5mBps: -4,
    routeLatencyMs: 140,
    priorityFeeMicrolamports: 2400
  };
  const variants = [[receipt], { receipts: [receipt] }, { rows: [receipt] }, { items: [receipt] }];

  for (const output of variants) {
    const snapshot = normalizePercolatorSnapshot({
      market: { symbol: "SOL-PERP", slab: "PERCOLAT_SOL", program: "Perco1ator" },
      commands: [
        { command: "best-price", output: { oracle: { priceUsd: 181.61 } } },
        { command: "execution:receipts", output }
      ]
    });

    assert.equal(snapshot.markets[0].execution.receipts.length, 1);
    assert.equal(snapshot.markets[0].execution.receipts[0].impactBps, 7);
  }
});

test("normalizes documented top-level receipt imports with market metadata", () => {
  const snapshot = normalizePercolatorSnapshot({
    market: {
      symbol: "SOL-PERP",
      base: "SOL",
      quote: "USDC",
      slab: "PERCOLAT_SOL",
      program: "Perco1ator"
    },
    receipts: [
      {
        label: "top-level receipt",
        source: "terminal log",
        sourceTimestamp: "2026-06-20T13:24:12Z",
        markPriceUsd: 181.61,
        bestBid: 181.52,
        bestAsk: 181.71,
        spreadBps: 10.5,
        impactBps: 8.4,
        markout1mBps: 4.2,
        markout5mBps: -1.7,
        routeLatencyMs: 132,
        priorityFeeMicrolamports: 2200,
        fillQualityScore: 84
      }
    ]
  });
  const [market] = snapshot.markets;

  assert.equal(detectPercolatorInputShape({ market: { symbol: "SOL-PERP" }, receipts: [] }), "percolator-cli-bundle");
  assert.equal(market.name, "SOL-PERP");
  assert.equal(market.slab, "PERCOLAT_SOL");
  assert.equal(market.price.mark, 181.61);
  assert.equal(market.execution.receipts.length, 1);
  assert.equal(market.execution.receipts[0].source, "terminal log");
});

test("normalizes list-markets wrapper containers", () => {
  const markets = [
    { symbol: "SOL-PERP", base: "SOL", quote: "USDC", slab: "PERCOLAT_SOL", priceUsd: 181.61 },
    { symbol: "BTC-PERP", base: "BTC", quote: "USDC", slab: "PERCOLAT_BTC", priceUsd: 64240.8 }
  ];

  for (const output of [{ markets }, { items: markets }, { rows: markets }, { accounts: markets }]) {
    const snapshot = normalizePercolatorSnapshot({
      command: "list-markets",
      output
    });

    assert.equal(snapshot.markets.length, 2);
    assert.equal(snapshot.markets[1].name, "BTC-PERP");
  }
});

test("does not treat raw protocol account or vault integers as USD", () => {
  const snapshot = normalizePercolatorSnapshot({
    label: "raw cli only",
    cluster: "local fixture",
    market: { symbol: "SOL-PERP", slab: "PERCOLAT_SOL", program: "Perco1ator" },
    commands: [
      { command: "slab:params", output: { maintenanceMarginBps: 500, initialMarginBps: 820 } },
      {
        command: "slab:engine",
        output: {
          vault: "910000",
          stressConsumedBps: 118,
          stressLimitBps: 500
        }
      },
      {
        command: "best-price",
        output: {
          oracle: { price: "181610000", decimals: 6, ageSecs: 2 },
          bestBuy: { price: "181710000", decimals: 6 },
          bestSell: { price: "181520000", decimals: 6 }
        }
      },
      {
        command: "slab:account",
        output: {
          capital: "8400",
          pnl: "3067",
          reservedPnl: "541",
          positionBasisQ: "420"
        }
      }
    ]
  });
  const [market] = snapshot.markets;

  assert.equal(market.price.mark, 181.61);
  assert.equal(market.execution.bestBid, 181.52);
  assert.equal(market.execution.bestAsk, 181.71);
  assert.equal(market.account.positionSize, 0);
  assert.equal(market.account.collateralUsd, 0);
  assert.equal(market.account.unrealizedPnlUsd, 0);
  assert.equal(market.solvency.vaultUsd, 0);
});

test("ignores raw price integers without decimals or explicit USD fields", () => {
  const snapshot = normalizePercolatorSnapshot({
    market: { symbol: "SOL-PERP", slab: "PERCOLAT_SOL", program: "Perco1ator" },
    commands: [
      {
        command: "best-price",
        output: {
          oracle: { price: "181610000" },
          bestBuy: { price: "181710000" },
          bestSell: { price: "181520000" }
        }
      }
    ]
  });

  assert.equal(snapshot.markets[0].price.mark, 0);
});

test("summarizes slab:accounts container variants", () => {
  const rows = [
    { idx: 1, kind: "User", stale: false },
    { idx: 2, kind: "User", stale: true }
  ];
  const variants = [rows, { rows }, { items: rows }, { accounts: rows }];

  for (const accounts of variants) {
    const snapshot = normalizePercolatorSnapshot({
      market: { symbol: "SOL-PERP", slab: "PERCOLAT_SOL", program: "Perco1ator" },
      commands: [
        { command: "best-price", output: { oracle: { priceUsd: 181.61 } } },
        { command: "slab:accounts", output: accounts }
      ]
    });

    assert.equal(snapshot.markets[0].crank.activeAccounts, 2);
    assert.equal(snapshot.markets[0].crank.staleAccounts, 1);
  }
});

test("keeps zero slab bitmap occupancy and capacity", () => {
  const snapshot = normalizePercolatorSnapshot({
    market: { symbol: "SOL-PERP", slab: "PERCOLAT_SOL", program: "Perco1ator" },
    commands: [
      { command: "best-price", output: { oracle: { priceUsd: 181.61 } } },
      { command: "slab:bitmap", output: { numUsed: 0, capacity: 4096 } }
    ]
  });

  assert.equal(snapshot.markets[0].crank.activeAccounts, 0);
  assert.equal(snapshot.markets[0].crank.maxAccounts, 4096);
});

test("summarizes slab bitmap used index occupancy", () => {
  const snapshot = normalizePercolatorSnapshot({
    market: { symbol: "SOL-PERP", slab: "PERCOLAT_SOL", program: "Perco1ator" },
    commands: [
      { command: "best-price", output: { oracle: { priceUsd: 181.61 } } },
      { command: "slab:bitmap", output: { usedIndices: [1, 4, 7], capacity: 4096 } }
    ]
  });

  assert.equal(snapshot.markets[0].crank.activeAccounts, 3);
  assert.equal(snapshot.markets[0].crank.maxAccounts, 4096);
});

test("normalizes single-command stdoutText entries", () => {
  const snapshot = normalizePercolatorSnapshot({
    command: "best-price",
    market: { symbol: "SOL-PERP", slab: "PERCOLAT_SOL", program: "Perco1ator" },
    stdoutText: `noise\n${JSON.stringify({ oracle: { price: "181610000", decimals: 6 } })}\n`
  });

  assert.equal(snapshot.markets[0].price.mark, 181.61);
});

test("rejects secret-bearing JSON parsed from CLI stdout", () => {
  assert.throws(
    () =>
      normalizePercolatorSnapshot({
        command: "slab:get",
        stdoutText: JSON.stringify({ market: { privateKey: "secret" } })
      }),
    /Refusing secret-bearing field/
  );
});

test("builds snapshots from read-only RPC fixtures", () => {
  const checked = validateReadOnlyRpcRequest(rpcFetchFixture);
  assert.equal(checked.magic, "50455243");

  const snapshot = buildReadOnlyRpcSnapshot(rpcFetchFixture);
  const [market] = snapshot.markets;

  assert.equal(market.name, "SOL-PERP");
  assert.equal(market.price.mark, 181.61);
  assert.equal(market.crank.activeAccounts, 72);
  assert.equal(market.account.label, "RPC observer");
});

test("validates documented read-only deployment examples", () => {
  for (const fixture of [mainnetSolDeployment, devnetWifDeployment]) {
    const summary = summarizeReadOnlyRpcDeployment(fixture);
    const snapshot = buildReadOnlyRpcSnapshot(fixture);
    const [market] = snapshot.markets;

    assert.equal(summary.owner, fixture.expectations.owner);
    assert.equal(summary.dataLength, fixture.expectations.dataLength);
    assert.equal(summary.magic, fixture.expectations.magic);
    assert.ok(summary.oracleAgeSec <= summary.maxOracleAgeSec);
    assert.equal(market.slab, fixture.slab);
    assert.equal(market.program, fixture.programId);
  }
});

test("rejects deployment fixtures with stale oracle expectations", () => {
  assert.throws(
    () =>
      summarizeReadOnlyRpcDeployment({
        ...devnetWifDeployment,
        account: {
          ...devnetWifDeployment.account,
          decoded: {
            ...devnetWifDeployment.account.decoded,
            bestPrice: {
              ...devnetWifDeployment.account.decoded.bestPrice,
              oracle: {
                ...devnetWifDeployment.account.decoded.bestPrice.oracle,
                ageSecs: 11
              }
            }
          }
        }
      }),
    /oracle freshness/
  );
});

test("documents terminal import and export recipes with live fixtures", () => {
  assert.deepEqual(
    terminalRecipes.recipes.map((recipe) => recipe.id),
    ["file-import", "drag-drop-stdout", "command-bundle", "list-markets", "read-only-rpc", "carry-history", "dto-export", "capture-intake"]
  );

  for (const recipe of terminalRecipes.recipes) {
    const fixture = JSON.parse(readFileSync(new URL(`../${recipe.fixture}`, import.meta.url), "utf8"));
    const serialized = JSON.stringify(fixture);
    assert.doesNotMatch(serialized, /connect wallet|sign transaction|send transaction|place order|submit trade|trade now/i);

    if (recipe.inputShape === "read-only-rpc-fetch") {
      const summary = summarizeReadOnlyRpcDeployment(fixture);
      assert.equal(summary.method, "getAccountInfo");
      assert.ok(summary.freshness > 0);
      continue;
    }

    if (recipe.inputShape === "funding-skew-history") {
      const history = normalizeFundingSkewHistory(fixture);
      assert.ok(history.length >= 1);
      continue;
    }

    if (recipe.inputShape === "perpscope-terminal-export") {
      assert.equal(fixture.name, terminalRecipes.dtoExport.name);
      assert.ok(fixture.source.mode === "read-only");
      assert.ok(Array.isArray(fixture.markets));
      continue;
    }

    const snapshot = normalizePercolatorSnapshot(fixture);
    assert.ok(snapshot.markets.length >= 1);
    assert.equal(snapshot.source.mode, "read-only");
  }
});

test("rejects mutating or invalid read-only RPC requests", () => {
  assert.throws(
    () => validateReadOnlyRpcRequest({ ...rpcFetchFixture, signer: "nope" }),
    /Refusing mutating field/
  );
  assert.throws(
    () =>
      validateReadOnlyRpcRequest({
        slab: rpcFetchFixture.slab,
        programId: rpcFetchFixture.programId,
        account: { decoded: { header: {}, config: {} } }
      }),
    /requires account owner/
  );
  assert.throws(
    () =>
      validateReadOnlyRpcRequest({
        slab: rpcFetchFixture.slab,
        programId: rpcFetchFixture.programId,
        account: { owner: rpcFetchFixture.programId, magic: "50455243", decoded: { header: {}, config: {} } }
      }),
    /requires account data length/
  );
  assert.throws(
    () =>
      validateReadOnlyRpcRequest({
        slab: rpcFetchFixture.slab,
        programId: rpcFetchFixture.programId,
        account: { owner: rpcFetchFixture.programId, dataLength: 524800, decoded: { header: {}, config: {} } }
      }),
    /requires account magic/
  );
  assert.throws(
    () => validateReadOnlyRpcRequest({
      ...rpcFetchFixture,
      account: {
        ...rpcFetchFixture.account,
        decoded: {
          ...rpcFetchFixture.account.decoded,
          nested: { signer: "nope" }
        }
      }
    }),
    /Refusing mutating field/
  );
  assert.throws(
    () => validateReadOnlyRpcRequest({
      ...rpcFetchFixture,
      account: { ...rpcFetchFixture.account, owner: "WrongProgram" }
    }),
    /owner does not match/
  );
  assert.throws(
    () => validateReadOnlyRpcRequest({
      ...rpcFetchFixture,
      account: { ...rpcFetchFixture.account, dataLength: 64 }
    }),
    /data length is too small/
  );
  assert.throws(
    () => validateReadOnlyRpcRequest({
      ...rpcFetchFixture,
      account: { ...rpcFetchFixture.account, magic: "badc0de" }
    }),
    /magic does not match/
  );
  assert.throws(
    () => buildReadOnlyRpcSnapshot({
      ...rpcFetchFixture,
      account: {
        owner: rpcFetchFixture.programId,
        dataLength: 524800,
        magic: "50455243"
      }
    }),
    /requires decoded slab data/
  );
});

test("fetches read-only RPC snapshots through an injected client", async () => {
  const snapshot = await fetchReadOnlyRpcSnapshot(
    {
      label: rpcFetchFixture.label,
      cluster: rpcFetchFixture.cluster,
      slab: rpcFetchFixture.slab,
      programId: rpcFetchFixture.programId,
      currentSlot: rpcFetchFixture.currentSlot,
      market: rpcFetchFixture.market
    },
    {
      getAccountInfo: async () => rpcFetchFixture.account
    }
  );

  assert.equal(snapshot.markets[0].name, "SOL-PERP");
});

test("fetches read-only RPC snapshots through slab aliases", async () => {
  let requestedSlab = "";
  const snapshot = await fetchReadOnlyRpcSnapshot(
    {
      label: rpcFetchFixture.label,
      cluster: rpcFetchFixture.cluster,
      slabAddress: rpcFetchFixture.slab,
      programId: rpcFetchFixture.programId,
      currentSlot: rpcFetchFixture.currentSlot,
      market: rpcFetchFixture.market
    },
    {
      getAccountInfo: async (slab) => {
        requestedSlab = slab;
        return rpcFetchFixture.account;
      }
    }
  );

  assert.equal(requestedSlab, rpcFetchFixture.slab);
  assert.equal(snapshot.markets[0].name, "SOL-PERP");
});

test("requires an injected read-only RPC client", async () => {
  await assert.rejects(
    () => fetchReadOnlyRpcSnapshot(rpcFetchFixture, {}),
    /requires a client with getAccountInfo/
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
