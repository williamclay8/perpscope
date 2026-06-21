import { Worker } from "node:worker_threads";

export const DEFAULT_MARKET_DIRECTORY_URL = "https://percolatorlaunch.com/api/markets";
export const DEFAULT_PERPSCOPE_ORIGIN = "https://williamclay8.github.io";
export const DEFAULT_BATCH_SIZE = 25;
export const DEFAULT_CACHE_TTL_MS = 12_000;
export const DEFAULT_DECODE_TIMEOUT_MS = 10_000;
export const MAX_REASONABLE_LIVE_USD = 1_000_000_000_000;
export const DEVNET_RPC_URL = "https://api.devnet.solana.com";
export const MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";

export async function buildPerpScopeDecodedSnapshot(options = {}) {
  const sdk = options.sdk || await import("@percolatorct/sdk");
  const web3 = options.web3 || await import("@solana/web3.js");
  const fetcher = options.fetcher || globalThis.fetch;
  const directory = await fetchMarketDirectory(fetcher, options.marketDirectoryUrl || DEFAULT_MARKET_DIRECTORY_URL);
  const groups = groupDirectoryByProgram(directory.markets, options.programIds);
  const connection = options.connection || new web3.Connection(
    options.rpcUrl || rpcUrlForCluster(options.cluster),
    options.commitment || "confirmed"
  );
  const decodedMarkets = [];

  for (const [programId, entries] of groups.entries()) {
    const addresses = entries.map((entry) => new web3.PublicKey(entry.slab_address));
    const markets = await sdk.getMarketsByAddress(
      connection,
      new web3.PublicKey(programId),
      addresses,
      { batchSize: options.batchSize || DEFAULT_BATCH_SIZE }
    );
    const entryBySlab = new Map(entries.map((entry) => [entry.slab_address, entry]));
    for (const market of markets) {
      decodedMarkets.push(marketToPerpScope(market, entryBySlab.get(market.slabAddress.toBase58())));
    }
  }

  const generatedAt = new Date(options.nowMs || Date.now()).toISOString();
  return {
    label: "Percolator decoded live source",
    cluster: options.cluster || "devnet",
    fixtureKind: "decoded-percolator-live-source",
    currentSlot: maxNumber(decodedMarkets.map((market) => market.currentSlot)),
    source: {
      kind: "decoded-percolator-live-source",
      provider: "@percolatorct/sdk",
      generatedAt,
      realBacked: true,
      live: true,
      scope: "live decoded protocol state",
      directory: options.marketDirectoryUrl || DEFAULT_MARKET_DIRECTORY_URL,
      rpcCluster: options.cluster || "devnet",
      note: "Read-only Percolator market accounts decoded from Solana RPC."
    },
    markets: decodedMarkets
  };
}

export async function fetchMarketDirectory(fetcher, url = DEFAULT_MARKET_DIRECTORY_URL) {
  if (typeof fetcher !== "function") throw new Error("A fetch implementation is required.");
  const response = await fetcher(url, {
    headers: { accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Market directory unavailable: ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body.markets)) throw new Error("Market directory did not return markets.");
  return body;
}

export function groupDirectoryByProgram(markets = [], allowedProgramIds = []) {
  const allowed = new Set((allowedProgramIds || []).filter(Boolean));
  const groups = new Map();
  for (const entry of markets) {
    if (!entry || !entry.slab_address || !entry.program_id) continue;
    if (allowed.size && !allowed.has(entry.program_id)) continue;
    if (!groups.has(entry.program_id)) groups.set(entry.program_id, []);
    groups.get(entry.program_id).push(entry);
  }
  return groups;
}

export function marketToPerpScope(market, directoryEntry = {}) {
  const header = market.header || {};
  const config = market.config || {};
  const engine = market.engine || {};
  const params = market.params || {};
  const symbol = directoryEntry.symbol || `${shortAddress(market.slabAddress)}-PERP`;
  const base = String(symbol).replace(/[-_/]?PERP$/i, "").replace(/^DEVNET[-_]/i, "") || "PERC";
  const markPrice = e6(engine.markPriceE6 || config.lastEffectivePriceE6 || config.authorityPriceE6);
  const indexPrice = e6(engine.oraclePriceE6 || config.authorityPriceE6 || config.lastEffectivePriceE6);
  const longOpenInterestUsd = atomsToUsd(engine.longOi);
  const shortOpenInterestUsd = atomsToUsd(engine.shortOi);
  const openInterestUsd = atomsToUsd(engine.totalOpenInterest) || longOpenInterestUsd + shortOpenInterestUsd;
  const currentSlot = numberOf(engine.currentSlot);
  const lastCrankSlot = numberOf(engine.lastCrankSlot);
  const oracleAgeSec = Math.max(0, (currentSlot - numberOf(header.lastThrUpdateSlot)) * 0.4);
  const crankAgeSlots = Math.max(0, currentSlot - lastCrankSlot);
  const spreadBps = Math.max(numberOf(config.confFilterBps), 1);
  const halfSpread = markPrice > 0 ? markPrice * spreadBps / 20000 : 0;

  const dto = {
    id: slug(symbol || market.slabAddress.toBase58()),
    name: symbol,
    base,
    quote: "USDC",
    status: engine.marketMode === 1 ? "resolved" : "live",
    slab: market.slabAddress.toBase58(),
    program: market.programId.toBase58(),
    currentSlot,
    header: {
      version: numberOf(header.version),
      flags: header.resolved ? ["resolved"] : [],
      nonce: stringOf(header.nonce),
      admin: shortAddress(header.admin)
    },
    config: {
      initialMarginBps: numberOf(params.initialMarginBps),
      maintenanceMarginBps: numberOf(params.maintenanceMarginBps),
      liquidationFeeBps: numberOf(params.liquidationFeeBps),
      maxStalenessSecs: Math.round(numberOf(config.maxStalenessSlots) * 0.4),
      confFilterBps: numberOf(config.confFilterBps),
      unitScale: numberOf(config.unitScale)
    },
    oracle: {
      indexPrice,
      markPrice,
      effectivePrice: markPrice || indexPrice,
      confidenceBps: numberOf(config.confFilterBps),
      publishAgeSec: Number(oracleAgeSec.toFixed(1)),
      targetAgeSec: Math.max(1, Math.round(numberOf(params.maxCrankStalenessSlots) * 0.4)),
      pricePath: pricePath(markPrice || indexPrice)
    },
    engine: {
      lastCrankSlot,
      crankAgeSlots,
      catchupRequired: crankAgeSlots > numberOf(params.maxCrankStalenessSlots),
      staleAccounts: numberOf(engine.negPnlAccountCount),
      fundingRateBpsPerHour: fundingRateBpsPerHour(engine),
      fundingIndex: stringOf(engine.fundingIndexQpbE6),
      openInterestUsd,
      longOpenInterestUsd,
      shortOpenInterestUsd,
      stressConsumedBps: stressConsumedBps(engine, params),
      stressLimitBps: numberOf(params.riskReductionThreshold) || 500,
      insuranceUsd: atomsToUsd(engine.insuranceFund?.balance),
      vaultUsd: atomsToUsd(engine.vault),
      claimUsd: atomsToUsd(engine.cTot),
      socialLossUsd: 0,
      sideMode: longOpenInterestUsd > shortOpenInterestUsd ? "long-heavy" : shortOpenInterestUsd > longOpenInterestUsd ? "short-heavy" : "balanced"
    },
    account: {
      label: "protocol aggregate",
      side: "flat",
      positionSize: 0,
      entryPrice: markPrice || indexPrice,
      collateralUsd: atomsToUsd(engine.vault),
      positionNotionalUsd: openInterestUsd,
      unrealizedPnlUsd: atomsToUsd(engine.pnlPosTot),
      realizedPnlUsd: 0,
      fundingPnlUsd: 0,
      maintenanceMarginUsd: openInterestUsd * numberOf(params.maintenanceMarginBps) / 10000,
      initialMarginUsd: openInterestUsd * numberOf(params.initialMarginBps) / 10000,
      liquidationPrice: 0,
      pnlPath: [0, atomsToUsd(engine.pnlPosTot)]
    },
    execution: {
      bestBid: Math.max(0, markPrice - halfSpread),
      bestAsk: markPrice + halfSpread,
      impact10kBps: spreadBps,
      impact50kBps: spreadBps * 3,
      markout1mBps: 0,
      markout5mBps: 0,
      fillQualityScore: spreadBps <= 20 ? 82 : spreadBps <= 60 ? 58 : 34,
      routeLatencyMs: 0,
      priorityFeeMicrolamports: 0,
      receipts: []
    },
    history: {
      fundingSkew: [
        {
          source: "Percolator SDK decoded market",
          sourceTimestamp: new Date().toISOString(),
          slot: currentSlot,
          fundingBpsPerHour: fundingRateBpsPerHour(engine),
          longOpenInterestUsd,
          shortOpenInterestUsd,
          stressConsumedBps: stressConsumedBps(engine, params),
          stressLimitBps: numberOf(params.riskReductionThreshold) || 500,
          oracleAgeSec: Number(oracleAgeSec.toFixed(1))
        }
      ]
    }
  };
  return applyDecodedSanity(dto);
}

export function createDecoderHttpHandler(options = {}) {
  const cache = { expiresAt: 0, payload: null };
  const ttlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const decodeTimeoutMs = options.decodeTimeoutMs ?? DEFAULT_DECODE_TIMEOUT_MS;
  const allowedOrigin = options.allowedOrigin || DEFAULT_PERPSCOPE_ORIGIN;

  return async function handleDecoderRequest(request, response) {
    const url = new URL(request.url || "/", "http://decoder.local");
    setCors(request, response, allowedOrigin);
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    if (url.pathname === "/healthz") {
      writeJson(response, 200, { ok: true, service: "perpscope-decoder-worker" });
      return;
    }
    if (url.pathname !== "/" && url.pathname !== "/perpscope.json") {
      writeJson(response, 404, { error: "not_found" });
      return;
    }

    try {
      if (!cache.payload || Date.now() >= cache.expiresAt || url.searchParams.get("refresh") === "1") {
        cache.payload = await buildHttpSnapshot(options, decodeTimeoutMs);
        cache.expiresAt = Date.now() + ttlMs;
      }
      writeJson(response, 200, cache.payload);
    } catch (error) {
      writeJson(response, 502, {
        error: "decoded_source_unavailable",
        message: error.message
      });
    }
  };
}

export function buildHttpSnapshot(options, timeoutMs) {
  if (options.sdk || options.web3 || options.fetcher || options.connection || options.disableWorker) {
    return withTimeout(
      buildPerpScopeDecodedSnapshot(options),
      timeoutMs,
      `Decoded source timed out after ${timeoutMs}ms.`
    );
  }

  return buildPerpScopeDecodedSnapshotInThread({
    batchSize: options.batchSize,
    cluster: options.cluster,
    commitment: options.commitment,
    marketDirectoryUrl: options.marketDirectoryUrl,
    nowMs: options.nowMs,
    programIds: options.programIds,
    rpcUrl: options.rpcUrl
  }, timeoutMs);
}

export function buildPerpScopeDecodedSnapshotInThread(workerOptions, timeoutMs) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./percolator-decoder-thread.js", import.meta.url), {
      workerData: workerOptions
    });
    let settled = false;
    const timeoutId = timeoutMs > 0 ? setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate().finally(() => {
        reject(new Error(`Decoded source timed out after ${timeoutMs}ms.`));
      });
    }, timeoutMs) : null;

    worker.once("message", (message) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (message.ok) {
        resolve(message.payload);
      } else {
        reject(new Error(message.message || "Decoded source worker failed."));
      }
    });

    worker.once("error", (error) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      reject(error);
    });

    worker.once("exit", (code) => {
      if (settled || code === 0) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      reject(new Error(`Decoded source worker exited with code ${code}.`));
    });
  });
}

export async function withTimeout(promise, timeoutMs, message) {
  if (!timeoutMs || timeoutMs <= 0) return promise;
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message || "Operation timed out.")), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export function rpcUrlForCluster(cluster = "devnet") {
  return cluster === "mainnet" || cluster === "mainnet-beta" ? MAINNET_RPC_URL : DEVNET_RPC_URL;
}

function setCors(request, response, allowedOrigin) {
  const requestOrigin = request.headers?.origin || "";
  const origin = requestOrigin === allowedOrigin || /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(requestOrigin)
    ? requestOrigin
    : allowedOrigin;
  response.setHeader("access-control-allow-origin", origin);
  response.setHeader("access-control-allow-methods", "GET, OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
  response.setHeader("vary", "origin");
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(payload));
}

function pricePath(markPrice) {
  const price = numberOf(markPrice);
  if (!price) return [0, 0, 0, 0, 0];
  return [0.996, 0.998, 1, 1.001, 1].map((factor) => Number((price * factor).toFixed(6)));
}

function fundingRateBpsPerHour(engine) {
  if (engine?.fundingRateE9) return Number((Number(engine.fundingRateE9) / 1_000_000_000).toFixed(4));
  return Number(numberOf(engine?.fundingRateBpsPerSlotLast).toFixed(4));
}

function stressConsumedBps(engine, params) {
  const openInterest = atomsToUsd(engine?.totalOpenInterest);
  const vault = atomsToUsd(engine?.vault);
  if (!openInterest || !vault) return 0;
  const consumed = openInterest / Math.max(vault, 1) * 100;
  return Math.min(Math.round(consumed), numberOf(params?.riskReductionThreshold) || 500);
}

function applyDecodedSanity(market) {
  const issues = [];
  const normalized = {
    ...market,
    config: {
      ...market.config,
      initialMarginBps: saneBps(market.config.initialMarginBps, "initial margin", issues),
      maintenanceMarginBps: saneBps(market.config.maintenanceMarginBps, "maintenance margin", issues),
      liquidationFeeBps: saneBps(market.config.liquidationFeeBps, "liquidation fee", issues)
    },
    oracle: {
      ...market.oracle,
      indexPrice: sanePrice(market.oracle.indexPrice, "index price", issues),
      markPrice: sanePrice(market.oracle.markPrice, "mark price", issues),
      effectivePrice: sanePrice(market.oracle.effectivePrice, "effective price", issues)
    },
    engine: {
      ...market.engine,
      openInterestUsd: saneUsd(market.engine.openInterestUsd, "open interest", issues),
      longOpenInterestUsd: saneUsd(market.engine.longOpenInterestUsd, "long OI", issues),
      shortOpenInterestUsd: saneUsd(market.engine.shortOpenInterestUsd, "short OI", issues),
      insuranceUsd: saneUsd(market.engine.insuranceUsd, "insurance", issues),
      vaultUsd: saneUsd(market.engine.vaultUsd, "vault", issues),
      claimUsd: saneUsd(market.engine.claimUsd, "claim", issues),
      stressConsumedBps: saneBps(market.engine.stressConsumedBps, "stress consumed", issues),
      stressLimitBps: saneBps(market.engine.stressLimitBps, "stress limit", issues) || 500
    },
    account: {
      ...market.account,
      collateralUsd: saneUsd(market.account.collateralUsd, "aggregate collateral", issues),
      positionNotionalUsd: saneUsd(market.account.positionNotionalUsd, "aggregate notional", issues),
      unrealizedPnlUsd: saneUsd(market.account.unrealizedPnlUsd, "aggregate uPnL", issues),
      maintenanceMarginUsd: saneUsd(market.account.maintenanceMarginUsd, "maintenance margin", issues),
      initialMarginUsd: saneUsd(market.account.initialMarginUsd, "initial margin", issues),
      pnlPath: (market.account.pnlPath || []).map((value) => saneUsd(value, "PnL path", issues))
    },
    history: {
      ...market.history,
      fundingSkew: (market.history?.fundingSkew || []).map((row) => ({
        ...row,
        longOpenInterestUsd: saneUsd(row.longOpenInterestUsd, "history long OI", issues),
        shortOpenInterestUsd: saneUsd(row.shortOpenInterestUsd, "history short OI", issues),
        stressLimitBps: saneBps(row.stressLimitBps, "history stress limit", issues)
      }))
    }
  };

  const price = normalized.oracle.markPrice || normalized.oracle.indexPrice || normalized.oracle.effectivePrice;
  normalized.oracle.markPrice = normalized.oracle.markPrice || price;
  normalized.oracle.indexPrice = normalized.oracle.indexPrice || price;
  normalized.oracle.effectivePrice = normalized.oracle.effectivePrice || price;
  normalized.account.entryPrice = sanePrice(normalized.account.entryPrice || price, "entry price", issues);
  normalized.execution.bestBid = sanePrice(normalized.execution.bestBid, "best bid", issues);
  normalized.execution.bestAsk = sanePrice(normalized.execution.bestAsk, "best ask", issues);
  normalized.status = issues.length ? "watch" : normalized.status;
  normalized.dataQuality = {
    status: issues.length ? "uncertain" : "normalized",
    confidence: issues.length ? "low" : "high",
    badges: issues.length
      ? ["live decoded", "sanity checked", "raw scale hidden"]
      : ["live decoded", "normalized"],
    issues,
    note: issues.length
      ? "Some decoded values looked raw or unit-ambiguous, so PerpScope hid those figures instead of presenting them as USD."
      : "Decoded values passed PerpScope display sanity checks."
  };
  normalized.flags = [
    ...(normalized.flags || []),
    ...(issues.length ? [{ tone: "warning", label: "unit check" }] : [])
  ].slice(0, 5);
  return normalized;
}

function saneUsd(value, label, issues) {
  const next = Number(value);
  if (!Number.isFinite(next) || next < 0) {
    issues.push(`${label} unavailable`);
    return 0;
  }
  if (next > MAX_REASONABLE_LIVE_USD) {
    issues.push(`${label} raw scale`);
    return 0;
  }
  return next;
}

function sanePrice(value, label, issues) {
  const next = Number(value);
  if (!Number.isFinite(next) || next < 0) {
    issues.push(`${label} unavailable`);
    return 0;
  }
  if (next > 1_000_000) {
    issues.push(`${label} raw scale`);
    return 0;
  }
  return next;
}

function saneBps(value, label, issues) {
  const next = Number(value);
  if (!Number.isFinite(next) || next < 0) {
    issues.push(`${label} unavailable`);
    return 0;
  }
  if (next > 10_000) {
    issues.push(`${label} raw scale`);
    return 0;
  }
  return next;
}

function atomsToUsd(value, decimals = 6) {
  const next = numberOf(value);
  return next ? Number((next / 10 ** decimals).toFixed(6)) : 0;
}

function e6(value) {
  return atomsToUsd(value, 6);
}

function maxNumber(values) {
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length ? Math.max(...numbers) : 0;
}

function numberOf(value) {
  if (value === undefined || value === null) return 0;
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function stringOf(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function slug(value) {
  return String(value || "market").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "market";
}

function shortAddress(value) {
  const text = String(value || "");
  if (text.length <= 18) return text;
  return `${text.slice(0, 8)}...${text.slice(-6)}`;
}
