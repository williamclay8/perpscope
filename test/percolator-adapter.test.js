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
import {
  buildReadOnlyRpcSnapshot,
  fetchReadOnlyRpcSnapshot,
  validateReadOnlyRpcRequest
} from "../src/lib/read-only-rpc-fetcher.js";
import { percolatorFixture } from "../src/fixtures/percolator-market.js";

const cliBundle = JSON.parse(
  readFileSync(new URL("../examples/percolator-cli.bundle.json", import.meta.url), "utf8")
);
const listMarketsStdout = JSON.parse(
  readFileSync(new URL("../examples/percolator-list-markets.stdout.json", import.meta.url), "utf8")
);
const rpcFetchFixture = JSON.parse(
  readFileSync(new URL("../examples/read-only-rpc.fetch.json", import.meta.url), "utf8")
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
    "slab:account",
    "slab:accounts",
    "slab:bitmap"
  ]);
  assert.equal(snapshot.currentSlot, 346892110);
  assert.equal(market.name, "SOL-PERP");
  assert.equal(market.price.mark, 181.61);
  assert.equal(market.execution.bestBid, 181.52);
  assert.equal(market.execution.bestAsk, 181.71);
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
  assert.equal(parsed.commands.length, 7);
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
