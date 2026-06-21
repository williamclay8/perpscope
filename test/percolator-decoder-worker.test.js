import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  buildPerpScopeDecodedSnapshot,
  createDecoderHttpHandler,
  fetchMarketDirectory,
  groupDirectoryByProgram,
  marketToPerpScope,
  rpcUrlForCluster
} from "../src/lib/percolator-decoder-worker.js";

class FakePublicKey {
  constructor(value) {
    this.value = String(value);
  }

  toBase58() {
    return this.value;
  }
}

const fakeMarket = {
  slabAddress: new FakePublicKey("Slab111111111111111111111111111111111111111"),
  programId: new FakePublicKey("Prog111111111111111111111111111111111111111"),
  header: {
    version: 12,
    resolved: false,
    nonce: 42n,
    admin: new FakePublicKey("Admin11111111111111111111111111111111111111"),
    lastThrUpdateSlot: 98n
  },
  config: {
    confFilterBps: 20,
    unitScale: 6,
    maxStalenessSlots: 20n,
    lastEffectivePriceE6: 125000000n,
    authorityPriceE6: 124900000n
  },
  params: {
    initialMarginBps: 1000n,
    maintenanceMarginBps: 600n,
    liquidationFeeBps: 35n,
    maxCrankStalenessSlots: 50n,
    riskReductionThreshold: 500n
  },
  engine: {
    currentSlot: 100n,
    lastCrankSlot: 94n,
    marketMode: 0,
    markPriceE6: 125100000n,
    oraclePriceE6: 125000000n,
    longOi: 3000000000n,
    shortOi: 2000000000n,
    totalOpenInterest: 5000000000n,
    insuranceFund: { balance: 1200000000n },
    vault: 7000000000n,
    cTot: 1000000000n,
    pnlPosTot: 120000000n,
    negPnlAccountCount: 2n,
    fundingRateE9: 250000000n,
    fundingIndexQpbE6: 10n
  }
};

test("groups market directory entries by owning program", () => {
  const groups = groupDirectoryByProgram([
    { slab_address: "A", program_id: "P1" },
    { slab_address: "B", program_id: "P2" },
    { slab_address: "C", program_id: "P1" },
    { slab_address: "", program_id: "P1" }
  ]);

  assert.deepEqual([...groups.keys()], ["P1", "P2"]);
  assert.equal(groups.get("P1").length, 2);
});

test("maps SDK decoded markets into the PerpScope snapshot contract", () => {
  const mapped = marketToPerpScope(fakeMarket, {
    symbol: "SOL-PERP",
    name: "SOL Perp"
  });

  assert.equal(mapped.id, "sol-perp");
  assert.equal(mapped.name, "SOL-PERP");
  assert.equal(mapped.slab, "Slab111111111111111111111111111111111111111");
  assert.equal(mapped.program, "Prog111111111111111111111111111111111111111");
  assert.equal(mapped.oracle.markPrice, 125.1);
  assert.equal(mapped.engine.openInterestUsd, 5000);
  assert.equal(mapped.engine.longOpenInterestUsd, 3000);
  assert.equal(mapped.engine.shortOpenInterestUsd, 2000);
  assert.equal(mapped.account.label, "protocol aggregate");
  assert.equal(mapped.execution.receipts.length, 0);
  assert.equal(mapped.history.fundingSkew[0].source, "Percolator SDK decoded market");
});

test("builds decoded snapshots with injected SDK, fetch, and web3 seams", async () => {
  const requestedPrograms = [];
  const sdk = {
    getMarketsByAddress: async (_connection, programId, addresses) => {
      requestedPrograms.push({ programId: programId.toBase58(), addresses: addresses.map((address) => address.toBase58()) });
      return [fakeMarket];
    }
  };
  const fetcher = async () => ({
    ok: true,
    json: async () => ({
      markets: [
        { slab_address: "Slab111111111111111111111111111111111111111", program_id: "Prog111111111111111111111111111111111111111", symbol: "SOL-PERP" }
      ]
    })
  });

  const snapshot = await buildPerpScopeDecodedSnapshot({
    cluster: "devnet",
    connection: {},
    fetcher,
    nowMs: Date.parse("2026-06-21T12:00:00.000Z"),
    sdk,
    web3: { PublicKey: FakePublicKey }
  });

  assert.equal(snapshot.source.live, true);
  assert.equal(snapshot.source.scope, "live decoded protocol state");
  assert.equal(snapshot.source.provider, "@percolatorct/sdk");
  assert.equal(snapshot.markets.length, 1);
  assert.deepEqual(requestedPrograms, [{
    programId: "Prog111111111111111111111111111111111111111",
    addresses: ["Slab111111111111111111111111111111111111111"]
  }]);
});

test("fetches and validates the public market directory shape", async () => {
  const directory = await fetchMarketDirectory(async (_url, options) => ({
    ok: true,
    json: async () => ({ markets: [] }),
    options
  }));

  assert.deepEqual(directory.markets, []);
});

test("serves decoded snapshots over CORS HTTP", async () => {
  const handler = createDecoderHttpHandler({
    allowedOrigin: "https://williamclay8.github.io",
    cacheTtlMs: 1000,
    connection: {},
    fetcher: async () => ({
      ok: true,
      json: async () => ({
        markets: [
          { slab_address: "Slab111111111111111111111111111111111111111", program_id: "Prog111111111111111111111111111111111111111", symbol: "SOL-PERP" }
        ]
      })
    }),
    sdk: {
      getMarketsByAddress: async () => [fakeMarket]
    },
    web3: { PublicKey: FakePublicKey }
  });
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/perpscope.json`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://williamclay8.github.io");
    assert.equal(body.source.live, true);
    assert.equal(body.markets[0].name, "SOL-PERP");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("bounds slow decoded snapshots with a gateway error", async () => {
  const handler = createDecoderHttpHandler({
    decodeTimeoutMs: 10,
    connection: {},
    fetcher: async () => ({
      ok: true,
      json: async () => ({
        markets: [
          { slab_address: "Slab111111111111111111111111111111111111111", program_id: "Prog111111111111111111111111111111111111111", symbol: "SOL-PERP" }
        ]
      })
    }),
    sdk: {
      getMarketsByAddress: () => new Promise(() => {})
    },
    web3: { PublicKey: FakePublicKey }
  });
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/perpscope.json`);
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.error, "decoded_source_unavailable");
    assert.match(body.message, /timed out/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("bounds the default decoder thread path with a gateway error", async () => {
  const handler = createDecoderHttpHandler({
    decodeTimeoutMs: 10,
    marketDirectoryUrl: "http://127.0.0.1:1/percolator-markets.json"
  });
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/perpscope.json`);
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.error, "decoded_source_unavailable");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("selects safe default RPC URLs by cluster", () => {
  assert.match(rpcUrlForCluster("devnet"), /devnet/);
  assert.match(rpcUrlForCluster("mainnet"), /mainnet-beta/);
});
