import { percolatorFixture } from "./fixtures/percolator-market.js";
import {
  assertReadOnlySnapshot,
  buildCompatibilityRealityCheck,
  buildPercolatorCompatibilityReport,
  compareCompatibilityReports,
  detectPercolatorInputShape,
  exportCompatibilityReport,
  exportCompatibilityReportFromReport,
  normalizePercolatorSnapshot,
  parsePercolatorJson,
  simulatePriceShock
} from "./lib/percolator-adapter.js";
import { buildReadOnlyRpcSnapshot } from "./lib/read-only-rpc-fetcher.js";
import {
  normalizeFundingSkewHistory,
  summarizeFundingSkewHistory
} from "./lib/funding-history.js";
import { buildWatchtowerSignals } from "./lib/watchtower-signals.js";

export const DEMO_CLI_PATH = "./examples/percolator-cli.bundle.json";
export const STATIC_REAL_SNAPSHOT_PATH = "./examples/static-real-snapshot.json";
export const LIVE_DECODED_SOURCE_PARAM = "decodedSource";
export const LIVE_DECODED_SOURCE_GLOBAL = "PERPSCOPE_DECODED_SOURCE_URL";
export const LIVE_DECODED_SOURCE_MAX_BYTES = 1_000_000;
export const DEFAULT_LIVE_DECODED_SOURCE_URL = "https://perpscope-decoder-worker.onrender.com/perpscope.json";
export const RADAR_FILTERS = [
  { id: "all", label: "All" },
  { id: "hot", label: "Hot" },
  { id: "unit-checked", label: "Unit checked" },
  { id: "normalized", label: "Normalized" },
  { id: "fresh", label: "Fresh" }
];
export const EMBED_MODES = [
  { id: "feed", label: "Feed" },
  { id: "radar", label: "Radar" },
  { id: "market", label: "Market" }
];
export const TERMINAL_ADAPTER_TARGETS = [
  {
    id: "generic-terminal",
    label: "Generic terminal",
    status: "ready",
    tone: "good",
    fields: ["symbol", "mark", "heat", "source"],
    note: "drop-in market rail DTO"
  },
  {
    id: "risk-overlay",
    label: "Risk overlay",
    status: "mapped",
    tone: "good",
    fields: ["runway", "stress", "flags", "reasons"],
    note: "overlay for existing order tickets"
  },
  {
    id: "execution-lane",
    label: "Execution lane",
    status: "partial",
    tone: "warning",
    fields: ["spread", "impact", "receipts"],
    note: "waits on richer fill receipts"
  },
  {
    id: "feed-monitor",
    label: "Feed monitor",
    status: "ready",
    tone: "good",
    fields: ["slot", "age", "markets", "unit checks"],
    note: "health widget for builders"
  }
];
export const ACTUAL_PRICE_ENDPOINT = "https://api.coingecko.com/api/v3/simple/price?ids=solana,bitcoin,dogwifcoin&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true";
export const ACTUAL_PRICE_MARKETS = {
  SOL: "solana",
  BTC: "bitcoin",
  WIF: "dogwifcoin"
};
export const DATA_SOURCE_MODES = [
  {
    id: "fixture",
    label: "fixture",
    tone: "neutral",
    detail: "local demo data",
    status: "loaded"
  },
  {
    id: "static-real",
    label: "real-backed",
    tone: "warning",
    detail: "static sanitized snapshot",
    status: "available"
  },
  {
    id: "live-read",
    label: "live",
    tone: "good",
    detail: "public market prices",
    status: "available"
  },
  {
    id: "live-decoded",
    label: "percolator",
    tone: "good",
    detail: "decoded protocol feed",
    status: "ready"
  }
];
export const READ_ONLY_DEPLOYMENTS = [
  {
    id: "mainnet-sol",
    label: "mainnet SOL",
    cluster: "mainnet-beta",
    market: "SOL-PERP",
    method: "getAccountInfo",
    fixture: "percolator-mainnet-sol.readonly-rpc.json",
    owner: "Perco1ator111111111111111111111111111111111",
    dataLength: 524800,
    magic: "50455243",
    oracleAgeSec: 2,
    maxOracleAgeSec: 8
  },
  {
    id: "devnet-wif",
    label: "devnet WIF",
    cluster: "devnet",
    market: "WIF-PERP",
    method: "getAccountInfo",
    fixture: "percolator-devnet-wif.readonly-rpc.json",
    owner: "Perco1ator111111111111111111111111111111111",
    dataLength: 262400,
    magic: "50455243",
    oracleAgeSec: 7.2,
    maxOracleAgeSec: 8
  }
];
export const TERMINAL_RECIPES = [
  {
    id: "file-import",
    label: "file import",
    fixture: "decoded-slab.snapshot.json",
    entry: "Import",
    output: "terminal DTO",
    commands: "snapshot"
  },
  {
    id: "drag-drop-stdout",
    label: "stdout",
    fixture: "execution-receipts.stdout.json",
    entry: "Drop",
    output: "receipt lane",
    commands: "receipts"
  },
  {
    id: "command-bundle",
    label: "bundle",
    fixture: "percolator-cli.bundle.json",
    entry: "Try CLI",
    output: "cockpit DTO",
    commands: "8 commands"
  },
  {
    id: "list-markets",
    label: "directory",
    fixture: "percolator-list-markets.stdout.json",
    entry: "stdout",
    output: "market rail",
    commands: "list-markets"
  },
  {
    id: "read-only-rpc",
    label: "rpc read",
    fixture: "percolator-mainnet-sol.readonly-rpc.json",
    entry: "client",
    output: "market dto",
    commands: "getAccountInfo"
  },
  {
    id: "carry-history",
    label: "carry log",
    fixture: "funding-skew-history.stdout.json",
    entry: "stdout",
    output: "history dto",
    commands: "funding-history"
  },
  {
    id: "dto-export",
    label: "dto export",
    fixture: "terminal-dto-export.json",
    entry: "normalize",
    output: "builder JSON",
    commands: "provenance"
  },
  {
    id: "capture-intake",
    label: "capture intake",
    fixture: "decoded stdout / JSON",
    entry: "Paste",
    output: "compat report",
    commands: "field map"
  }
];

export const WORKBENCH_PREVIOUS_CAPTURE = {
  label: "Workbench baseline",
  cluster: "local fixture",
  market: {
    symbol: "SOL-PERP",
    slab: "PERCOLAT_SOL_8k4q...Qp2",
    program: "Perco1ator111111111111111111111111111111111"
  },
  oracle: {
    priceUsd: 181.61,
    ageSecs: 2
  },
  engine: {
    currentSlot: 346892110,
    lastCrankSlot: 346892086,
    fundingRateBpsPerHour: 0.82,
    openInterestUsd: 2430000,
    longOpenInterestUsd: 1320000,
    shortOpenInterestUsd: 1110000,
    insuranceUsd: 148000,
    claimUsd: 1
  },
  execution: {
    bestBid: 181.52,
    bestAsk: 181.71
  }
};

export const WORKBENCH_CURRENT_CAPTURE = {
  label: "Workbench drifted aliases",
  market: {
    symbol: "SOL-PERP",
    slab: "PERCOLAT_SOL_8k4q...Qp2",
    program: "Perco1ator111111111111111111111111111111111"
  },
  oraclePriceUsd: 181.61,
  oracleAgeSeconds: 2,
  oiUsd: 2430000,
  bestBidPx: 181.52,
  bestAskPx: 181.71
};

export const REALITY_CHECK_CAPTURE = {
  label: "Real-backed sanitized RPC shape / SOL",
  cluster: "mainnet-beta",
  fixtureKind: "sanitized-real-shape-candidate",
  fixture: "examples/fixture-pack-real-sanitized-rpc-shape.json",
  source: {
    kind: "read-only-rpc-decoded-account",
    basis: "Derived from examples/percolator-mainnet-sol.readonly-rpc.json",
    sanitized: true,
    realBacked: true,
    note: "candidate until a third-party decoded shape lands"
  },
  slab: "PERCOLAT_SOL_8k4q...Qp2",
  programId: "Perco1ator111111111111111111111111111111111",
  currentSlot: 346892118,
  market: {
    id: "sol-perp",
    symbol: "SOL-PERP",
    base: "SOL",
    quote: "USDC",
    status: "stable"
  },
  account: {
    owner: "Perco1ator111111111111111111111111111111111",
    dataLength: 524800,
    magic: "50455243",
    decoded: {
      header: { magic: "50455243", version: 16 },
      config: { maxStalenessSecs: 8, confFilterBps: 45, unitScale: 6 },
      params: { maintenanceMarginBps: 500, initialMarginBps: 820, maxAccounts: 4096 },
      engine: {
        currentSlot: 346892118,
        lastMarketSlot: 346892090,
        fundingRateBpsPerHour: 0.82,
        openInterestUsd: 2430000,
        longOpenInterestUsd: 1320000,
        shortOpenInterestUsd: 1110000,
        insuranceUsd: 148000,
        stressConsumedBps: 118,
        stressLimitBps: 500
      },
      bestPrice: {
        oracle: { price: "181610000", decimals: 6, ageSecs: 2 },
        bestBuy: { price: "181710000", decimals: 6 },
        bestSell: { price: "181520000", decimals: 6 },
        effectiveSpreadBps: 10
      },
      accountUsd: {
        label: "sanitized observer",
        side: "long",
        positionSize: 420,
        positionNotionalUsd: 76276.2,
        collateralUsd: 8400,
        unrealizedPnlUsd: 3067.2,
        liquidationPrice: 162.94
      },
      receipts: [{ label: "sanitized fill", markPriceUsd: 181.61, bestBid: 181.52, bestAsk: 181.71, spreadBps: 10.5, impactBps: 8.4 }],
      fundingSkew: [{ slot: 346892086, fundingBpsPerHour: 0.82, longOpenInterestUsd: 1320000, shortOpenInterestUsd: 1110000 }]
    }
  }
};

const fixtureSnapshot = normalizePercolatorSnapshot(percolatorFixture);
const fixtureCompatibilityReport = buildPercolatorCompatibilityReport(percolatorFixture, fixtureSnapshot);
const realitySnapshot = buildReadOnlyRpcSnapshot(REALITY_CHECK_CAPTURE);
const realityCompatibilityReport = buildPercolatorCompatibilityReport(REALITY_CHECK_CAPTURE, realitySnapshot);
const workbenchPreviousText = JSON.stringify(WORKBENCH_PREVIOUS_CAPTURE, null, 2);
const workbenchCurrentText = JSON.stringify(WORKBENCH_CURRENT_CAPTURE, null, 2);
const initialUrlState = readUrlState();

const state = {
  snapshot: fixtureSnapshot,
  selectedMarketId: resolveSelectedMarketId(fixtureSnapshot, initialUrlState.market || "sol-perp"),
  shockPct: -3,
  compatibilityReport: fixtureCompatibilityReport,
  compatibilityDiff: compareCompatibilityReports(fixtureCompatibilityReport, fixtureCompatibilityReport),
  realityCheck: buildCompatibilityRealityCheck(realityCompatibilityReport, { input: REALITY_CHECK_CAPTURE }),
  dataSource: createDataSourceState("fixture", percolatorFixture, fixtureSnapshot, fixtureCompatibilityReport),
  lastImportedInput: percolatorFixture,
  workbench: createCompatibilityWorkbenchState(WORKBENCH_PREVIOUS_CAPTURE, WORKBENCH_CURRENT_CAPTURE, {
    previousText: workbenchPreviousText,
    currentText: workbenchCurrentText
  }),
  captureOpen: false,
  radarFilter: initialUrlState.filter || "all",
  embedMode: initialUrlState.embed || "",
  liveLoad: { status: "idle", sourceUrl: DEFAULT_LIVE_DECODED_SOURCE_URL },
  importStatus: {
    tone: "neutral",
    label: "fixture loaded",
    detail: "PerpScope fixture loaded"
  }
};

const app = typeof document === "undefined" ? null : document.querySelector("#app");

if (app) {
  render();
  maybeAutoLoadLivePercolator();
}

function render() {
  const market = selectedMarket();
  const stress = simulatePriceShock(market, state.shockPct);
  const radar = buildTraderRadar(state.snapshot.markets, state.radarFilter);
  const hotReasons = buildMarketHotReasons(market, radar.allRows.find((row) => row.id === market.id));
  const feedHealth = buildFeedHealth(state.snapshot, state.dataSource, state.liveLoad, state.compatibilityReport);
  if (state.embedMode) {
    renderEmbed({ market, stress, radar, hotReasons, feedHealth });
    return;
  }
  const activeColor = market.status === "stable" ? "var(--mint)" : market.status === "watch" ? "var(--amber)" : "var(--red)";
  app.innerHTML = `
    <main class="shell ${market.status}-mode" style="--active-color:${activeColor}" aria-label="PerpScope read-only risk cockpit">
      <aside class="market-rail" aria-label="Markets">
        <div class="brand-lockup">
          <span class="brand-mark">P</span>
          <div>
            <strong>PerpScope</strong>
            <span>read-only</span>
          </div>
        </div>
        <nav class="market-list">
          ${state.snapshot.markets.map((item) => marketButton(item)).join("")}
        </nav>
        <div class="rail-proof">
          <span class="proof-dot"></span>
          <span>No wallet, signer, or send path</span>
        </div>
      </aside>

      <section class="workspace">
        <header class="topbar stagger-item">
          <div>
            <p class="eyebrow">${esc(state.snapshot.cluster)} / slot ${fmtInt(state.snapshot.currentSlot)}</p>
            <h1>${esc(market.name)}</h1>
          </div>
          <div class="topbar-actions" aria-label="Read-only status">
            <span class="status-chip ${toneClass(market.status)}">${esc(market.status)}</span>
            <span class="status-chip neutral">adapter dto</span>
            <button class="status-chip action" id="copy-market-link" type="button">copy link</button>
          </div>
        </header>

        <section class="cockpit-grid">
          <article class="hero-panel panel stagger-item">
            <div class="hero-copy">
              <span class="panel-label">market health</span>
              <div class="hero-score">
                ${gauge(market.healthScore, market.status)}
                <div>
                  <strong>${market.healthScore}</strong>
                  <span>score</span>
                </div>
              </div>
            </div>
            <div class="price-stack">
              <span>mark</span>
              <strong>${money(market.price.mark, market.base === "WIF" ? 3 : 2)}</strong>
              <small>${signedBps(market.price.driftBps)} vs index</small>
              ${sparkline(market.price.path, "price")}
            </div>
          </article>

          <article class="runway-panel panel stagger-item">
            <div class="panel-head">
              <span class="panel-label">liquidation runway</span>
              <strong>${pct(market.account.liquidationDistancePct)}</strong>
            </div>
            ${liquidationBand(market, stress)}
            <div class="runway-metrics">
              ${metric("liq", money(market.account.liquidationPrice, market.base === "WIF" ? 3 : 2))}
              ${metric("buffer", money(market.account.marginBufferUsd, 0), market.account.marginBufferUsd < 0 ? "danger" : "good")}
              ${metric("shock", `${state.shockPct}%`, stress.projectedStatus)}
            </div>
            <label class="shock-control">
              <span>stress</span>
              <input id="shock" type="range" min="-18" max="18" step="1" value="${state.shockPct}" aria-label="Price shock percent" />
              <span>${money(stress.nextPrice, market.base === "WIF" ? 3 : 2)}</span>
            </label>
          </article>

          ${watchtowerPanel(market, stress)}

          ${compatibilityPanel(state.compatibilityReport)}

          ${realityCheckPanel(state.realityCheck)}

          ${dataSourcePanel(state.dataSource)}

          ${feedHealthPanel(feedHealth)}

          ${dataConfidenceStrip(state)}

          ${exportHubPanel(state.embedMode)}

          ${traderRadarPanel(radar, market.id)}

          ${hotReasonsPanel(hotReasons)}

          ${workbenchPanel(state.workbench)}

          ${fundingHistoryPanel(market)}

          <article class="spine-panel panel stagger-item">
            <div class="panel-head">
              <span class="panel-label">protocol spine</span>
              <strong>${market.crank.catchupRequired ? "catchup" : "fresh"}</strong>
            </div>
            <div class="spine">
              ${spineStep("oracle", `${Math.round(market.price.freshnessScore)}%`, market.price.freshnessScore)}
              ${spineStep("crank", `${fmtInt(market.crank.ageSlots)} slots`, market.crank.freshnessScore)}
              ${spineStep("funding", `${signedBps(market.funding.bpsPerHour)} / hr`, 68)}
              ${spineStep("stress", `${Math.round(market.marketStructure.stressUsedPct)}%`, 100 - market.marketStructure.stressUsedPct)}
              ${spineStep("insurance", `${Math.round(market.solvency.coveragePct)}%`, Math.min(market.solvency.coveragePct, 100))}
            </div>
          </article>

          <article class="account-panel panel stagger-item">
            <div class="panel-head">
              <span class="panel-label">account risk</span>
              <strong>${esc(exposureLabel(market.account.side))}</strong>
            </div>
            <div class="account-strip">
              ${metric("equity", money(market.account.equityUsd, 0), market.account.equityUsd > 0 ? "good" : "danger")}
              ${metric("notional", money(market.account.positionNotionalUsd, 0))}
              ${metric("uPnL", money(market.account.unrealizedPnlUsd, 0), market.account.unrealizedPnlUsd >= 0 ? "good" : "danger")}
            </div>
            ${sparkline(market.account.pnlPath, "pnl")}
          </article>

          <article class="execution-panel panel stagger-item">
            <div class="panel-head">
              <span class="panel-label">execution quality</span>
              <strong>${market.execution.fillQualityScore}</strong>
            </div>
            <div class="impact-bars">
              ${impactBar("spread", Math.abs(market.execution.spreadBps), 80)}
              ${impactBar("$10k", market.execution.impact10kBps, 150)}
              ${impactBar("$50k", market.execution.impact50kBps, 180)}
              ${impactBar("5m", Math.abs(market.execution.markout5mBps), 100)}
            </div>
          </article>

          ${receiptPanel(market)}

          <article class="flags-panel panel stagger-item">
            <div class="panel-head">
              <span class="panel-label">flags</span>
              <strong>${market.flags.length}</strong>
            </div>
            <div class="flag-grid">
              ${market.flags.map((flag) => `<span class="flag ${flag.tone}">${esc(flag.label)}</span>`).join("")}
            </div>
            <div class="mini-ledger">
              <span>OI skew</span><strong>${signedPct(market.marketStructure.oiSkewPct)}</strong>
              <span>social loss</span><strong>${money(market.solvency.socialLossUsd, 0)}</strong>
            </div>
          </article>

          <article class="adapter-panel panel stagger-item">
            <div class="panel-head">
              <span class="panel-label">terminal adapter</span>
              <strong>${state.snapshot.markets.length} markets</strong>
            </div>
            <div class="import-dock" id="import-dock">
              <div role="status" aria-live="polite" title="${esc(state.importStatus.detail || state.importStatus.label)}">
                <span class="status-dot ${state.importStatus.tone}"></span>
                <strong>${esc(state.importStatus.label)}</strong>
              </div>
              <div class="import-actions">
                <button class="utility-button" id="try-cli" type="button">Try CLI</button>
                <button class="utility-button ghost" data-capture-open type="button">Paste</button>
                <button class="utility-button ghost" id="import-json" type="button">Import</button>
                <button class="utility-button ghost" id="reset-fixture" type="button">Reset</button>
                <input id="json-file" type="file" accept="application/json,text/plain,.json,.txt,.log" hidden />
              </div>
            </div>
            ${sourceStrip(state.snapshot)}
            <div class="adapter-flow" aria-label="Adapter flow">
              <span>slab</span>
              <span>normalize</span>
              <span>dto</span>
              <span>cockpit</span>
            </div>
            <div class="method-list">
              <code>normalizePercolatorSnapshot()</code>
              <code>buildPercolatorCompatibilityReport()</code>
              <code>compareCompatibilityReports()</code>
              <code>toTerminalMarketDto()</code>
              <code>simulatePriceShock()</code>
            </div>
          </article>

          ${deploymentPanel()}

          ${adapterTargetsPanel(buildAdapterTargets(state.snapshot, state.compatibilityReport))}

          ${recipePanel()}
        </section>
      </section>
    </main>
  `;
  bindInteractiveControls();
}

function renderEmbed({ market, stress, radar, hotReasons, feedHealth }) {
  const activeColor = market.status === "stable" ? "var(--mint)" : market.status === "watch" ? "var(--amber)" : "var(--red)";
  app.innerHTML = `
    <main class="shell embed-shell ${market.status}-mode" style="--active-color:${activeColor}" aria-label="PerpScope ${state.embedMode} embed">
      <section class="workspace">
        <header class="topbar embed-topbar stagger-item">
          <div>
            <p class="eyebrow">${esc(state.snapshot.cluster)} / ${esc(state.embedMode)} embed</p>
            <h1>${esc(embedTitle(state.embedMode, market))}</h1>
          </div>
          <div class="topbar-actions" aria-label="Embed actions">
            <span class="status-chip ${toneClass(market.status)}">${esc(market.status)}</span>
            <button class="status-chip action" data-copy-embed-url type="button">copy embed</button>
          </div>
        </header>
        <section class="cockpit-grid embed-grid">
          ${embedPanelMarkup(state.embedMode, { market, stress, radar, hotReasons, feedHealth })}
          ${exportHubPanel(state.embedMode)}
        </section>
      </section>
    </main>
  `;
  bindInteractiveControls();
}

function bindInteractiveControls() {

  app.querySelectorAll("[data-market-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedMarketId = button.dataset.marketId;
      state.shockPct = state.selectedMarketId === "wif-perp" ? -5 : -3;
      updateUrlState();
      render();
    });
  });

  app.querySelectorAll("[data-radar-market-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedMarketId = button.dataset.radarMarketId;
      state.shockPct = state.selectedMarketId === "wif-perp" ? -5 : -3;
      updateUrlState();
      render();
    });
  });

  app.querySelectorAll("[data-radar-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.radarFilter = button.dataset.radarFilter;
      updateUrlState();
      render();
    });
  });

  app.querySelector("#shock")?.addEventListener("input", (event) => {
    state.shockPct = Number(event.target.value);
    render();
  });

  const fileInput = app.querySelector("#json-file");
  app.querySelector("#import-json")?.addEventListener("click", () => fileInput.click());
  app.querySelector("#capture-import-json")?.addEventListener("click", () => fileInput.click());
  app.querySelector("#export-compatibility")?.addEventListener("click", exportCurrentCompatibilityReport);
  app.querySelector("#export-cockpit-json")?.addEventListener("click", exportCockpitJson);
  app.querySelector("#export-radar-json")?.addEventListener("click", exportRadarJson);
  app.querySelector("#copy-market-json")?.addEventListener("click", copyMarketJson);
  app.querySelectorAll("[data-copy-embed-url]").forEach((button) => {
    button.addEventListener("click", copyEmbedUrl);
  });
  app.querySelector("#analyze-workbench")?.addEventListener("click", analyzeWorkbench);
  app.querySelector("#sample-workbench")?.addEventListener("click", loadWorkbenchSample);
  app.querySelector("#export-workbench-diff")?.addEventListener("click", exportWorkbenchDiff);
  app.querySelector("#load-static-real")?.addEventListener("click", loadStaticRealSnapshot);
  app.querySelector("#load-actual-prices")?.addEventListener("click", loadActualPricesSnapshot);
  app.querySelector("#load-live-decoded")?.addEventListener("click", loadLiveDecodedSource);
  app.querySelector("#copy-market-link")?.addEventListener("click", copyMarketLink);
  app.querySelector("#try-cli")?.addEventListener("click", loadCliDemo);
  app.querySelectorAll("[data-capture-open]").forEach((button) => {
    button.addEventListener("click", () => {
      state.captureOpen = true;
      render();
      app.querySelector("#capture-text")?.focus();
    });
  });
  app.querySelector("#close-capture")?.addEventListener("click", () => {
    state.captureOpen = false;
    render();
  });
  app.querySelector("#analyze-capture")?.addEventListener("click", () => {
    analyzePastedCapture(app.querySelector("#capture-text")?.value || "");
  });
  fileInput?.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (file) await importJsonFile(file);
  });

  app.querySelector("#reset-fixture")?.addEventListener("click", () => {
    const snapshot = normalizePercolatorSnapshot(percolatorFixture);
    state.snapshot = snapshot;
    state.selectedMarketId = "sol-perp";
    state.shockPct = -3;
    state.compatibilityReport = fixtureCompatibilityReport;
    state.compatibilityDiff = compareCompatibilityReports(fixtureCompatibilityReport, fixtureCompatibilityReport);
    state.realityCheck = buildCompatibilityRealityCheck(realityCompatibilityReport, { input: REALITY_CHECK_CAPTURE });
    state.dataSource = createDataSourceState("fixture", percolatorFixture, snapshot, fixtureCompatibilityReport);
    state.lastImportedInput = percolatorFixture;
    state.workbench = createCompatibilityWorkbenchState(WORKBENCH_PREVIOUS_CAPTURE, WORKBENCH_CURRENT_CAPTURE, {
      previousText: workbenchPreviousText,
      currentText: workbenchCurrentText
    });
    state.captureOpen = false;
    state.radarFilter = "all";
    state.liveLoad = { status: "idle", sourceUrl: DEFAULT_LIVE_DECODED_SOURCE_URL };
    updateUrlState();
    state.importStatus = {
      tone: "neutral",
      label: "fixture loaded",
      detail: "PerpScope fixture loaded"
    };
    render();
  });

  const importDock = app.querySelector("#import-dock");
  bindDropZone(importDock);
  bindDropZone(app.querySelector("#capture-dropzone"));
}

function selectedMarket() {
  return state.snapshot.markets.find((market) => market.id === state.selectedMarketId) || state.snapshot.markets[0];
}

function marketButton(market) {
  const active = market.id === state.selectedMarketId ? "active" : "";
  return `
    <button class="market-button ${active}" data-market-id="${esc(market.id)}" type="button" aria-pressed="${market.id === state.selectedMarketId}">
      <span>
        <strong>${esc(market.name)}</strong>
        <small>${money(market.price.mark, market.base === "WIF" ? 3 : 2)}</small>
      </span>
      <i class="${toneClass(market.status)}">${market.healthScore}</i>
    </button>
  `;
}

function compatibilityPanel(report) {
  const sections = report.recognizedSections.slice(0, 8);
  const missing = report.missingFields.slice(0, 6);
  const ignored = report.ignoredFields.slice(0, 4);
  const suggestions = (report.aliasSuggestions || []).slice(0, 4);
  return `
    <article class="capture-panel panel stagger-item ${report.tone}" id="capture-panel">
      <div class="panel-head">
        <span class="panel-label">capture intake</span>
        <strong class="compat-status ${report.tone}">${esc(report.status)}</strong>
      </div>
      <div class="capture-hero">
        <section class="compat-score-card ${report.tone}" aria-label="Compatibility score ${report.score}">
          <strong>${report.score}</strong>
          <span>compat</span>
        </section>
        <section class="capture-dropzone" id="capture-dropzone" tabindex="0" aria-label="Drop decoded JSON or captured stdout">
          <div>
            <span class="status-dot ${report.tone}"></span>
            <strong>${esc(shapeLabel(report.shape))}</strong>
            <small>${esc(report.source.label || "decoded capture")}</small>
          </div>
          <div class="import-actions">
            <button class="utility-button" data-capture-open type="button">Paste</button>
            <button class="utility-button ghost" id="capture-import-json" type="button">Import</button>
            <button class="utility-button ghost" id="export-compatibility" type="button">Export</button>
          </div>
        </section>
      </div>
      <div class="compat-tiles" aria-label="Compatibility summary">
        ${compatTile("shape", shapeLabel(report.shape), report.tone)}
        ${compatTile("mapped", String(report.summary.recognizedCount), report.summary.recognizedCount >= 6 ? "good" : "warning")}
        ${compatTile("missing", String(report.summary.missingCount), report.summary.missingCount ? "warning" : "good")}
        ${compatTile("ignored", String(report.summary.ignoredCount), report.summary.ignoredCount ? "warning" : "good")}
      </div>
      ${compatDiffStrip(state.compatibilityDiff)}
      <div class="compat-source-strip">
        ${[
          report.source.cluster,
          report.source.currentSlot ? `slot ${fmtInt(report.source.currentSlot)}` : "",
          report.source.commandSet?.length ? `${report.source.commandSet.length} commands` : "",
          report.source.slab ? shortAddress(report.source.slab) : "",
          report.source.program ? shortAddress(report.source.program) : ""
        ].filter(Boolean).map((chip) => `<span>${esc(chip)}</span>`).join("")}
      </div>
      <div class="compat-map" aria-label="Mapped compatibility sections">
        ${sections.map(compatSection).join("")}
      </div>
      ${missing.length ? `
        <div class="compat-gap-list" aria-label="Missing useful fields">
          ${missing.map(compatGap).join("")}
        </div>
      ` : ""}
      ${ignored.length ? `
        <div class="compat-ignored" aria-label="Ignored fields">
          ${ignored.map((item) => `<span>${esc(item.label)}</span>`).join("")}
        </div>
      ` : ""}
      ${suggestions.length ? `
        <div class="compat-suggestions" aria-label="Alias suggestions">
          ${suggestions.map(compatSuggestion).join("")}
        </div>
      ` : ""}
      ${state.captureOpen ? captureEditor() : ""}
    </article>
  `;
}

function compatDiffStrip(diff) {
  if (!diff) return "";
  const changed = diff.scoreDelta || diff.summary.newMissingCount || diff.summary.newIgnoredCount || diff.summary.resolvedMissingCount || diff.summary.addedSectionCount || diff.summary.removedSectionCount;
  if (!changed) return `
    <div class="compat-diff-strip good" aria-label="Compatibility drift">
      <span>drift</span>
      <strong>stable</strong>
      <small>baseline matched</small>
    </div>
  `;
  const delta = diff.scoreDelta > 0 ? `+${diff.scoreDelta}` : String(diff.scoreDelta);
  return `
    <div class="compat-diff-strip ${diff.tone}" aria-label="Compatibility drift">
      <span>drift</span>
      <strong>${esc(delta)}</strong>
      <small>${diff.summary.newMissingCount} new gaps / ${diff.summary.resolvedMissingCount} fixed</small>
    </div>
  `;
}

function compatTile(label, value, tone = "neutral") {
  return `<section class="compat-tile ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong></section>`;
}

function compatSection(section) {
  return `
    <section class="compat-section ${section.tone}">
      <span></span>
      <strong>${esc(section.label)}</strong>
      <small>${esc(section.detail)}</small>
    </section>
  `;
}

function compatGap(field) {
  return `
    <section class="compat-gap ${field.severity}">
      <span>${esc(field.label)}</span>
      <strong>${esc(field.field)}</strong>
      <small>${esc(field.detail)}</small>
    </section>
  `;
}

function compatSuggestion(suggestion) {
  return `
    <section class="compat-suggestion ${suggestion.confidence}">
      <span>${esc(suggestion.confidence)}</span>
      <strong>${esc(suggestion.candidatePath || suggestion.action)}</strong>
      <small>${esc(suggestion.candidatePath ? `${suggestion.field} <- ${suggestion.candidatePath}` : suggestion.field)}</small>
    </section>
  `;
}

function workbenchPanel(workbench) {
  const diff = workbench.diff;
  const suggestions = diff.aliasSuggestions.slice(0, 3);
  return `
    <article class="workbench-panel panel stagger-item ${diff.tone}">
      <div class="panel-head">
        <span class="panel-label">compat workbench</span>
        <strong class="compat-status ${diff.tone}">${diff.scoreDelta > 0 ? "+" : ""}${diff.scoreDelta}</strong>
      </div>
      <div class="workbench-summary">
        ${compatTile("new gaps", String(diff.summary.newMissingCount), diff.summary.newMissingCount ? "warning" : "good")}
        ${compatTile("fixed", String(diff.summary.resolvedMissingCount), diff.summary.resolvedMissingCount ? "good" : "neutral")}
        ${compatTile("ignored", String(diff.summary.newIgnoredCount), diff.summary.newIgnoredCount ? "warning" : "good")}
        ${compatTile("aliases", String(diff.summary.suggestionCount), diff.summary.suggestionCount ? "good" : "neutral")}
      </div>
      <div class="workbench-editors">
        <label>
          <span>previous</span>
          <textarea id="workbench-previous" spellcheck="false">${esc(workbench.previousText)}</textarea>
        </label>
        <label>
          <span>current</span>
          <textarea id="workbench-current" spellcheck="false">${esc(workbench.currentText)}</textarea>
        </label>
      </div>
      ${suggestions.length ? `
        <div class="compat-suggestions" aria-label="Workbench alias suggestions">
          ${suggestions.map(compatSuggestion).join("")}
        </div>
      ` : ""}
      <div class="workbench-actions">
        <button class="utility-button" id="analyze-workbench" type="button">Compare</button>
        <button class="utility-button ghost" id="export-workbench-diff" type="button">Export Diff</button>
        <button class="utility-button ghost" id="sample-workbench" type="button">Sample</button>
      </div>
    </article>
  `;
}

function realityCheckPanel(check) {
  return `
    <article class="reality-panel panel stagger-item ${check.tone}">
      <div class="panel-head">
        <span class="panel-label">reality check</span>
        <strong class="compat-status ${check.tone}">${esc(check.status)}</strong>
      </div>
      <div class="reality-hero">
        <div>
          <strong>${esc(check.provenance.label)}</strong>
          <span>${esc(check.sourceKind)}</span>
        </div>
        <p>${esc(check.provenance.note || check.provenance.basis || "read-only decoded state")}</p>
      </div>
      <div class="reality-lanes" aria-label="Reality check summary">
        ${check.lanes.map((lane) => compatTile(lane.label, lane.value, lane.tone)).join("")}
      </div>
      <div class="reality-strip">
        ${[
          check.provenance.cluster,
          check.provenance.fixture,
          check.provenance.sanitized ? "sanitized" : "",
          `${check.mapped.recognizedCount} mapped sections`
        ].filter(Boolean).map((chip) => `<span>${esc(chip)}</span>`).join("")}
      </div>
    </article>
  `;
}

function dataSourcePanel(dataSource) {
  const loading = state.liveLoad.status === "loading";
  const actionLabel = loading ? "Loading..." : "Load Percolator";
  return `
    <article class="data-source-panel panel stagger-item ${dataSource.tone}">
      <div class="panel-head">
        <span class="panel-label">data source</span>
        <strong class="compat-status ${dataSource.tone}">${esc(dataSource.modeLabel)}</strong>
      </div>
      <div class="data-source-grid" aria-label="Data source modes">
        ${dataSource.modes.map((mode) => `
          <section class="data-source-card ${mode.tone} ${mode.active ? "active" : ""}">
            <span>${esc(mode.label)}</span>
            <strong>${esc(mode.status)}</strong>
            <small>${esc(mode.detail)}</small>
          </section>
        `).join("")}
      </div>
      <div class="data-source-strip">
        ${dataSource.chips.map((chip) => `<span>${esc(chip)}</span>`).join("")}
      </div>
      <div class="data-source-actions">
        <button class="utility-button" id="load-static-real" type="button">Load Snapshot</button>
        <button class="utility-button" id="load-actual-prices" type="button">Load Live</button>
        <button class="utility-button primary ${loading ? "loading" : ""}" id="load-live-decoded" type="button" ${loading ? "disabled" : ""}>${esc(actionLabel)}</button>
        <span>${esc(dataSource.note)}</span>
      </div>
    </article>
  `;
}

function feedHealthPanel(feedHealth) {
  return `
    <article class="feed-health-panel panel stagger-item ${feedHealth.tone}">
      <div class="panel-head">
        <span class="panel-label">feed health</span>
        <strong class="compat-status ${feedHealth.tone}">${esc(feedHealth.status)}</strong>
      </div>
      <div class="feed-health-grid" aria-label="Live feed health">
        ${feedHealth.items.map((item) => `
          <section class="${item.tone}">
            <span>${esc(item.label)}</span>
            <strong>${esc(item.value)}</strong>
          </section>
        `).join("")}
      </div>
      <div class="feed-health-strip">
        ${feedHealth.chips.map((chip) => `<span>${esc(chip)}</span>`).join("")}
      </div>
    </article>
  `;
}

function dataConfidenceStrip(appState) {
  const confidence = buildDataConfidence(appState.snapshot, appState.dataSource, appState.liveLoad);
  return `
    <article class="confidence-strip panel stagger-item ${confidence.tone}">
      <div class="confidence-rail" aria-label="Live data confidence">
        ${confidence.items.map((item) => `
          <section class="${item.tone}">
            <span>${esc(item.label)}</span>
            <strong>${esc(item.value)}</strong>
          </section>
        `).join("")}
      </div>
    </article>
  `;
}

function exportHubPanel(embedMode = "") {
  return `
    <article class="export-hub-panel panel stagger-item">
      <div class="panel-head">
        <span class="panel-label">export hub</span>
        <strong>${embedMode ? `${embedMode} embed` : "json ready"}</strong>
      </div>
      <div class="export-actions" aria-label="PerpScope export actions">
        <button class="utility-button primary" id="export-cockpit-json" type="button">Export Cockpit</button>
        <button class="utility-button" id="export-radar-json" type="button">Export Radar</button>
        <button class="utility-button ghost" id="copy-market-json" type="button">Copy Market</button>
        <button class="utility-button ghost" data-copy-embed-url type="button">Copy Embed</button>
      </div>
      <div class="embed-mode-strip" aria-label="Embed URLs">
        ${EMBED_MODES.map((mode) => `<span>${esc(mode.label)} <b>?embed=${esc(mode.id)}</b></span>`).join("")}
      </div>
    </article>
  `;
}

function hotReasonsPanel(summary) {
  return `
    <article class="hot-reasons-panel panel stagger-item ${summary.tone}">
      <div class="panel-head">
        <span class="panel-label">why hot</span>
        <strong>${esc(summary.status)}</strong>
      </div>
      <div class="reason-hero">
        <strong>${esc(summary.market)}</strong>
        <span>${esc(summary.lede)}</span>
      </div>
      <div class="reason-list" aria-label="Market heat reasons">
        ${summary.reasons.map((reason) => `
          <section class="${reason.tone}">
            <span>${esc(reason.label)}</span>
            <strong>${esc(reason.value)}</strong>
            <small>${esc(reason.detail)}</small>
          </section>
        `).join("")}
      </div>
    </article>
  `;
}

function marketEmbedPanel(market, stress, hotReasons) {
  return `
    <article class="market-embed-panel panel stagger-item ${market.status}">
      <div class="panel-head">
        <span class="panel-label">market widget</span>
        <strong>${esc(market.status)}</strong>
      </div>
      <div class="market-embed-hero">
        <section>
          <span>mark</span>
          <strong>${money(market.price.mark, market.base === "WIF" ? 3 : 2)}</strong>
          <small>${signedBps(market.price.driftBps)} vs index</small>
        </section>
        <section>
          <span>runway</span>
          <strong>${pct(market.account.liquidationDistancePct)}</strong>
          <small>${money(market.account.marginBufferUsd, 0)} buffer</small>
        </section>
        <section>
          <span>shock</span>
          <strong>${money(stress.nextPrice, market.base === "WIF" ? 3 : 2)}</strong>
          <small>${esc(stress.projectedStatus)}</small>
        </section>
      </div>
      <div class="reason-hero">
        <strong>${esc(hotReasons.market)}</strong>
        <span>${esc(hotReasons.lede)}</span>
      </div>
      <div class="reason-list" aria-label="Market heat reasons">
        ${hotReasons.reasons.map((reason) => `
          <section class="${reason.tone}">
            <span>${esc(reason.label)}</span>
            <strong>${esc(reason.value)}</strong>
            <small>${esc(reason.detail)}</small>
          </section>
        `).join("")}
      </div>
    </article>
  `;
}

function embedTitle(mode, market) {
  if (mode === "feed") return "Feed Health";
  if (mode === "radar") return "Trader Radar";
  return market.name;
}

function embedPanelMarkup(mode, parts) {
  if (mode === "feed") {
    return `${feedHealthPanel(parts.feedHealth)}${dataConfidenceStrip(state)}`;
  }
  if (mode === "radar") {
    return traderRadarPanel(parts.radar, parts.market.id);
  }
  return marketEmbedPanel(parts.market, parts.stress, parts.hotReasons);
}

function traderRadarPanel(radar, selectedMarketId) {
  return `
    <article class="trader-radar-panel panel stagger-item">
      <div class="panel-head">
        <span class="panel-label">trader radar</span>
        <strong>${radar.rows.length} shown</strong>
      </div>
      <div class="radar-filters" aria-label="Trader radar filters">
        ${RADAR_FILTERS.map((filter) => `
          <button class="${radar.filter === filter.id ? "active" : ""}" data-radar-filter="${esc(filter.id)}" type="button" aria-pressed="${radar.filter === filter.id}">${esc(filter.label)}</button>
        `).join("")}
      </div>
      <div class="radar-summary" aria-label="Live market radar summary">
        ${radar.tiles.map((tile) => compatTile(tile.label, tile.value, tile.tone)).join("")}
      </div>
      <div class="radar-list" aria-label="Ranked market health list">
        ${radar.rows.length ? radar.rows.map((row) => radarRow(row, selectedMarketId)).join("") : radarEmptyRow(radar.filter)}
      </div>
    </article>
  `;
}

function adapterTargetsPanel(targets) {
  return `
    <article class="adapter-targets-panel panel stagger-item">
      <div class="panel-head">
        <span class="panel-label">adapter targets</span>
        <strong>${targets.ready}/${targets.targets.length} ready</strong>
      </div>
      <div class="adapter-target-grid" aria-label="Terminal adapter targets">
        ${targets.targets.map((target) => `
          <section class="${target.tone}">
            <div>
              <span>${esc(target.label)}</span>
              <strong>${esc(target.status)}</strong>
            </div>
            <small>${esc(target.note)}</small>
            <p>${target.fields.map((field) => `<b>${esc(field)}</b>`).join("")}</p>
          </section>
        `).join("")}
      </div>
    </article>
  `;
}

function radarRow(row, selectedMarketId) {
  return `
    <button class="radar-row ${row.tone} ${row.id === selectedMarketId ? "active" : ""}" data-radar-market-id="${esc(row.id)}" type="button" aria-pressed="${row.id === selectedMarketId}">
      <span class="radar-rank">${esc(row.rank)}</span>
      <span class="radar-market">
        <strong>${esc(row.name)}</strong>
        <small>${esc(row.detail)}</small>
      </span>
      <span class="radar-metrics">
        <b>${esc(row.scoreLabel)}</b>
        <small>${esc(row.qualityLabel)}</small>
      </span>
    </button>
  `;
}

function radarEmptyRow(filter) {
  return `
    <div class="radar-empty">
      <strong>No ${esc(filter.replace("-", " "))} markets</strong>
      <span>Switch filters or load the live Percolator feed.</span>
    </div>
  `;
}

function captureEditor() {
  return `
    <div class="capture-editor">
      <textarea id="capture-text" spellcheck="false" placeholder="Paste decoded JSON or captured stdout"></textarea>
      <div class="capture-editor-actions">
        <button class="utility-button" id="analyze-capture" type="button">Analyze</button>
        <button class="utility-button ghost" id="close-capture" type="button">Close</button>
      </div>
    </div>
  `;
}

async function importJsonFile(file) {
  try {
    const imported = parsePercolatorJson(await file.text());
    loadImportedSnapshot(imported, {
      detailPrefix: file.name
    });
  } catch (error) {
    state.compatibilityReport = rejectedCompatibilityReport(error);
    state.compatibilityDiff = compareCompatibilityReports(fixtureCompatibilityReport, state.compatibilityReport);
    state.realityCheck = buildCompatibilityRealityCheck(state.compatibilityReport, { input: state.lastImportedInput });
    state.importStatus = {
      tone: "danger",
      label: error.message.slice(0, 44),
      detail: error.message
    };
  }
  render();
}

function analyzePastedCapture(text) {
  try {
    if (!String(text).trim()) throw new Error("Paste decoded JSON or captured stdout first.");
    const imported = parsePercolatorJson(text);
    loadImportedSnapshot(imported, {
      label: "capture analyzed",
      detailPrefix: "pasted capture"
    });
    state.captureOpen = false;
  } catch (error) {
    state.compatibilityReport = rejectedCompatibilityReport(error);
    state.compatibilityDiff = compareCompatibilityReports(fixtureCompatibilityReport, state.compatibilityReport);
    state.realityCheck = buildCompatibilityRealityCheck(state.compatibilityReport, { input: state.lastImportedInput });
    state.importStatus = {
      tone: "danger",
      label: error.message.slice(0, 44),
      detail: error.message
    };
  }
  render();
}

async function loadCliDemo() {
  try {
    const imported = await fetchCliDemoSnapshot(fetch);
    loadImportedSnapshot(imported, {
      label: "demo cli loaded",
      detailPrefix: DEMO_CLI_PATH.replace(/^\.\//, "")
    });
  } catch (error) {
    state.compatibilityReport = rejectedCompatibilityReport(error);
    state.compatibilityDiff = compareCompatibilityReports(fixtureCompatibilityReport, state.compatibilityReport);
    state.realityCheck = buildCompatibilityRealityCheck(state.compatibilityReport, { input: state.lastImportedInput });
    state.importStatus = {
      tone: "danger",
      label: error.message.slice(0, 44),
      detail: error.message
    };
  }
  render();
}

async function loadStaticRealSnapshot() {
  try {
    const imported = await fetchStaticRealSnapshot(fetch);
    loadImportedSnapshot(imported, {
      label: "static real loaded",
      detailPrefix: STATIC_REAL_SNAPSHOT_PATH.replace(/^\.\//, ""),
      dataSourceMode: "static-real"
    });
  } catch (error) {
    state.importStatus = {
      tone: "danger",
      label: error.message.slice(0, 44),
      detail: error.message
    };
  }
  render();
}

async function loadActualPricesSnapshot() {
  try {
    const imported = await fetchActualMarketSnapshot(fetch);
    loadImportedSnapshot(imported, {
      label: "live prices loaded",
      detailPrefix: "CoinGecko public price feed",
      dataSourceMode: "live-read"
    });
  } catch (error) {
    state.importStatus = {
      tone: "danger",
      label: error.message.slice(0, 44),
      detail: error.message
    };
    state.dataSource = {
      ...state.dataSource,
      note: "live unavailable; keeping current source"
    };
  }
  render();
}

async function loadLiveDecodedSource() {
  const sourceUrl = getLiveDecodedSourceUrl();
  state.liveLoad = { status: "loading", sourceUrl, startedAt: Date.now() };
  state.dataSource = {
    ...state.dataSource,
    note: "loading decoded Percolator feed"
  };
  state.importStatus = {
    tone: "neutral",
    label: "loading percolator",
    detail: sourceUrl
  };
  render();
  try {
    const imported = await fetchLiveDecodedSource(fetch, sourceUrl);
    loadImportedSnapshot(imported, {
      label: "decoded live loaded",
      detailPrefix: decodedSourceLabel(sourceUrl),
      dataSourceMode: "live-decoded"
    });
    state.liveLoad = { status: "loaded", sourceUrl, loadedAt: Date.now() };
  } catch (error) {
    state.liveLoad = { status: "error", sourceUrl, error: error.message };
    state.importStatus = {
      tone: "danger",
      label: error.message.slice(0, 44),
      detail: error.message
    };
    state.dataSource = {
      ...state.dataSource,
      note: "decoded source unavailable; keeping current source"
    };
  }
  render();
}

async function copyMarketLink() {
  const url = buildShareUrl(globalThis.location, {
    market: state.selectedMarketId,
    filter: state.radarFilter,
    embed: state.embedMode
  });
  try {
    await globalThis.navigator?.clipboard?.writeText?.(url);
    state.importStatus = {
      tone: "good",
      label: "link copied",
      detail: url
    };
  } catch {
    state.importStatus = {
      tone: "neutral",
      label: "link ready",
      detail: url
    };
  }
  updateUrlState();
  render();
}

async function copyEmbedUrl() {
  const url = buildEmbedUrl(globalThis.location, state.embedMode || "market", {
    market: state.selectedMarketId,
    filter: state.radarFilter
  });
  await copyTextToClipboard(url, "embed copied", "embed ready");
}

async function copyMarketJson() {
  const payload = buildPerpScopeExport(currentExportContext()).market;
  await copyTextToClipboard(`${JSON.stringify(payload, null, 2)}\n`, "market copied", "market ready");
}

function maybeAutoLoadLivePercolator(locationLike = globalThis.location) {
  if (!shouldAutoLoadLivePercolator(locationLike)) return;
  queueMicrotask(() => {
    if (state.dataSource.mode === "fixture" && state.liveLoad.status === "idle") {
      loadLiveDecodedSource();
    }
  });
}

export function shouldAutoLoadLivePercolator(locationLike = globalThis.location) {
  const origin = locationLike?.origin || "";
  const params = new URLSearchParams(locationLike?.search || "");
  if (params.get("fixture") === "1" || params.get("live") === "0") return false;
  return origin === "https://williamclay8.github.io";
}

export function readUrlState(locationLike = globalThis.location) {
  const params = new URLSearchParams(locationLike?.search || "");
  const filter = params.get("filter");
  const embed = params.get("embed");
  return {
    market: params.get("market") || "",
    filter: RADAR_FILTERS.some((entry) => entry.id === filter) ? filter : "",
    embed: EMBED_MODES.some((entry) => entry.id === embed) ? embed : ""
  };
}

export function buildShareUrl(locationLike = globalThis.location, selection = {}) {
  const base = locationLike?.href || "https://williamclay8.github.io/perpscope/";
  const url = new URL(base);
  if (selection.market) url.searchParams.set("market", selection.market);
  if (selection.filter && selection.filter !== "all") {
    url.searchParams.set("filter", selection.filter);
  } else {
    url.searchParams.delete("filter");
  }
  if (selection.embed) {
    url.searchParams.set("embed", selection.embed);
  } else if (selection.embed === "") {
    url.searchParams.delete("embed");
  }
  url.hash = "";
  return url.toString();
}

export function buildEmbedUrl(locationLike = globalThis.location, mode = "feed", selection = {}) {
  return buildShareUrl(locationLike, {
    ...selection,
    embed: EMBED_MODES.some((entry) => entry.id === mode) ? mode : "feed"
  });
}

function updateUrlState(locationLike = globalThis.location, historyLike = globalThis.history) {
  if (!historyLike?.replaceState || !locationLike?.href) return;
  const url = buildShareUrl(locationLike, {
    market: state.selectedMarketId,
    filter: state.radarFilter,
    embed: state.embedMode
  });
  historyLike.replaceState({}, "", url);
}

function resolveSelectedMarketId(snapshot, candidate) {
  const markets = snapshot?.markets || [];
  return markets.some((market) => market.id === candidate) ? candidate : markets[0]?.id || "";
}

export async function fetchStaticRealSnapshot(fetcher) {
  const response = await fetcher(STATIC_REAL_SNAPSHOT_PATH);
  if (!response.ok) throw new Error("Static real snapshot unavailable.");
  return parsePercolatorJson(await response.text());
}

export async function fetchActualMarketSnapshot(fetcher, options = {}) {
  const response = await fetcher(ACTUAL_PRICE_ENDPOINT);
  if (!response.ok) throw new Error("Live public prices unavailable.");
  return createActualMarketSnapshot(JSON.parse(await response.text()), options);
}

export async function fetchLiveDecodedSource(fetcher, sourceUrl, options = {}) {
  const endpoint = sanitizeLiveDecodedSourceUrl(sourceUrl, options.location);
  const response = await fetcher(endpoint, { cache: "no-store", credentials: "omit", mode: "cors" });
  if (!response.ok) throw new Error("Decoded Percolator source unavailable.");
  const contentType = response.headers?.get?.("content-type") || "";
  if (contentType && !/json|text\/plain/i.test(contentType)) {
    throw new Error("Decoded Percolator source must return JSON.");
  }
  const contentLength = Number(response.headers?.get?.("content-length") || 0);
  if (contentLength > LIVE_DECODED_SOURCE_MAX_BYTES) {
    throw new Error("Decoded Percolator source is too large.");
  }
  const body = await response.text();
  if (body.length > LIVE_DECODED_SOURCE_MAX_BYTES) {
    throw new Error("Decoded Percolator source is too large.");
  }
  const imported = parsePercolatorJson(body);
  assertLiveDecodedSource(imported);
  return imported;
}

export function getLiveDecodedSourceUrl(locationLike = globalThis.location, globalLike = globalThis) {
  const params = new URLSearchParams(locationLike?.search || "");
  const configured = params.get(LIVE_DECODED_SOURCE_PARAM) || globalLike?.[LIVE_DECODED_SOURCE_GLOBAL] || DEFAULT_LIVE_DECODED_SOURCE_URL;
  return sanitizeLiveDecodedSourceUrl(configured, locationLike);
}

export function sanitizeLiveDecodedSourceUrl(value, locationLike = globalThis.location) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("Decoded source URL is missing.");
  let url;
  try {
    const base = locationLike?.href || locationLike?.origin || "https://perpscope.local/";
    url = new URL(raw, base);
  } catch {
    throw new Error("Decoded source URL is invalid.");
  }
  if (url.username || url.password) {
    throw new Error("Decoded source URL cannot include credentials.");
  }
  const localHttp = url.protocol === "http:" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
  if (url.protocol !== "https:" && !localHttp) {
    throw new Error("Decoded source must use HTTPS or localhost HTTP.");
  }
  if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname) && isPrivateNetworkHost(url.hostname)) {
    throw new Error("Decoded source cannot target private network hosts.");
  }
  url.hash = "";
  return url.toString();
}

export function createActualMarketSnapshot(priceFeed, options = {}) {
  const nowMs = options.nowMs || Date.now();
  const generatedAt = new Date(nowMs).toISOString();
  const markets = fixtureSnapshot.markets.map((market) => actualMarketFromDto(market, priceFeed, nowMs));
  const updatedAtValues = markets
    .map((market) => Number(market.oracle?.lastUpdatedAt || 0))
    .filter((value) => value > 0);
  const latestUpdatedAt = updatedAtValues.length ? Math.max(...updatedAtValues) : Math.floor(nowMs / 1000);
  return {
    label: "Live public prices / simulated Percolator risk",
    cluster: "public market feed",
    fixtureKind: "live-public-market-prices",
    currentSlot: fixtureSnapshot.currentSlot,
    source: {
      kind: "public-market-price-feed",
      provider: "CoinGecko simple price",
      endpoint: ACTUAL_PRICE_ENDPOINT,
      generatedAt,
      lastUpdatedAt: latestUpdatedAt,
      realBacked: true,
      live: true,
      scope: "live public prices",
      note: "Actual public prices with simulated Percolator risk context; not live decoded protocol state."
    },
    markets
  };
}

export async function fetchCliDemoSnapshot(fetcher) {
  const response = await fetcher(DEMO_CLI_PATH);
  if (!response.ok) throw new Error("CLI demo fixture unavailable.");
  return parsePercolatorJson(await response.text());
}

export function createImportedSnapshotState(imported, options = {}) {
  const shape = detectPercolatorInputShape(imported);
  const snapshot = shape === "read-only-rpc-fetch"
    ? buildReadOnlyRpcSnapshot(imported)
    : normalizePercolatorSnapshot(imported);
  const compatibilityReport = buildPercolatorCompatibilityReport(imported, snapshot);
  const compatibilityDiff = compareCompatibilityReports(fixtureCompatibilityReport, compatibilityReport);
  const realityCheck = buildCompatibilityRealityCheck(compatibilityReport, { input: imported });
  if (!snapshot.markets.length) {
    throw new Error("No markets found.");
  }
  if (compatibilityReport.status === "unknown") {
    const error = new Error("Capture has no recognized Percolator sections.");
    error.compatibilityReport = compatibilityReport;
    throw error;
  }
  const commandCount = Array.isArray(snapshot.source?.commandSet) ? snapshot.source.commandSet.length : 0;
  const tone = compatibilityReport.tone === "danger" ? "warning" : compatibilityReport.tone;
  return {
    snapshot,
    selectedMarketId: resolveSelectedMarketId(snapshot, options.selectedMarketId || readUrlState().market || snapshot.markets[0].id),
    shockPct: -3,
    compatibilityReport,
    compatibilityDiff,
    realityCheck,
    dataSource: createDataSourceState(options.dataSourceMode || dataSourceModeForInput(imported), imported, snapshot, compatibilityReport),
    lastImportedInput: imported,
    captureOpen: false,
    importStatus: {
      tone,
      label: options.label || `${snapshot.markets.length} ${shapeLabel(shape)}`,
      detail: `${options.detailPrefix || "import"}: ${snapshot.markets.length} market import${commandCount ? `, ${commandCount} commands` : ""}${compatibilityReport.summary.missingCount ? `, ${compatibilityReport.summary.missingCount} missing fields` : ""}`
    }
  };
}

function loadImportedSnapshot(imported, options = {}) {
  try {
    Object.assign(state, createImportedSnapshotState(imported, {
      ...options,
      selectedMarketId: state.selectedMarketId
    }));
    updateUrlState();
  } catch (error) {
    if (error.compatibilityReport) state.compatibilityReport = error.compatibilityReport;
    state.compatibilityDiff = compareCompatibilityReports(fixtureCompatibilityReport, state.compatibilityReport);
    state.realityCheck = buildCompatibilityRealityCheck(state.compatibilityReport, { input: state.lastImportedInput });
    throw error;
  }
}

export function createDataSourceState(modeId, input, snapshot, report) {
  const mode = DATA_SOURCE_MODES.find((entry) => entry.id === modeId) || DATA_SOURCE_MODES[0];
  const source = snapshot?.source || {};
  const inputSource = input && typeof input === "object" && !Array.isArray(input) ? input.source || {} : {};
  const live = inputSource.live === true;
  const updatedAt = Number(inputSource.lastUpdatedAt || 0) || timestampSeconds(inputSource.generatedAt);
  const modes = DATA_SOURCE_MODES.map((entry) => ({
    ...entry,
    active: entry.id === mode.id
  }));
  return {
    mode: mode.id,
    modeLabel: mode.label,
    tone: mode.tone,
    modes,
    chips: [
      source.label || input?.label || "decoded fixture",
      snapshot?.cluster || input?.cluster || "unknown",
      report?.shape || detectPercolatorInputShape(input),
      live ? (inputSource.scope || "live public prices") : "not live",
      updatedAt ? `updated ${new Date(updatedAt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""
    ].filter(Boolean),
    note: mode.id === "static-real"
      ? "static sanitized snapshot; not a stream"
      : mode.id === "live-read"
        ? "actual public prices; simulated risk context"
        : mode.id === "live-decoded"
          ? "decoded protocol feed; read-only"
          : "default cockpit data is a local fixture"
  };
}

export function buildDataConfidence(snapshot, dataSource = {}, liveLoad = {}) {
  const markets = snapshot?.markets || [];
  const unitChecked = markets.filter((market) => market.dataQuality?.status === "uncertain").length;
  const normalized = markets.filter((market) => market.dataQuality?.status !== "uncertain").length;
  const live = dataSource.mode === "live-decoded";
  const loading = liveLoad.status === "loading";
  return {
    tone: loading ? "warning" : live ? "good" : "neutral",
    items: [
      { label: "source", value: loading ? "loading" : live ? "decoded live" : dataSource.modeLabel || "fixture", tone: live ? "good" : loading ? "warning" : "neutral" },
      { label: "markets", value: String(markets.length), tone: markets.length ? "good" : "warning" },
      { label: "unit checked", value: String(unitChecked), tone: unitChecked ? "warning" : "good" },
      { label: "normalized", value: String(normalized), tone: normalized ? "good" : "neutral" },
      { label: "wallet", value: "read-only", tone: "good" }
    ]
  };
}

export function buildFeedHealth(snapshot, dataSource = {}, liveLoad = {}, report = {}) {
  const markets = snapshot?.markets || [];
  const source = snapshot?.source || {};
  const live = dataSource.mode === "live-decoded";
  const loading = liveLoad.status === "loading";
  const errored = liveLoad.status === "error";
  const sourceLabel = live || loading || errored ? liveLoad.sourceUrl : "";
  const updatedAt = Number(source.lastUpdatedAt || 0) || timestampSeconds(source.generatedAt);
  const ageSec = updatedAt ? Math.max(0, Math.round(Date.now() / 1000 - updatedAt)) : 0;
  const unitChecked = markets.filter((market) => market.dataQuality?.status === "uncertain").length;
  const missing = Number(report?.summary?.missingCount || 0);
  const status = loading ? "loading" : errored ? "error" : live ? "live" : dataSource.modeLabel || "fixture";
  const tone = errored ? "danger" : loading || unitChecked || missing ? "warning" : live ? "good" : "neutral";
  return {
    status,
    tone,
    items: [
      { label: "markets", value: String(markets.length), tone: markets.length ? "good" : "warning" },
      { label: "slot", value: snapshot?.currentSlot ? fmtInt(snapshot.currentSlot) : "waiting", tone: snapshot?.currentSlot ? "good" : "warning" },
      { label: "age", value: updatedAt ? compactAge(ageSec) : "unknown", tone: !updatedAt || ageSec > 300 ? "warning" : "good" },
      { label: "unit checks", value: String(unitChecked), tone: unitChecked ? "warning" : "good" },
      { label: "gaps", value: String(missing), tone: missing ? "warning" : "good" }
    ],
    chips: [
      sourceLabel ? decodedSourceLabel(sourceLabel) : source.provider || source.kind || "local fixture",
      source.provider,
      source.live ? "source.live=true" : "fixture mode",
      errored ? liveLoad.error : ""
    ].filter(Boolean)
  };
}

export function buildMarketHotReasons(market, radarRow = {}) {
  const stress = Number(market?.marketStructure?.stressUsedPct || 0);
  const skew = Number(market?.marketStructure?.oiSkewPct || 0);
  const funding = Number(market?.funding?.bpsPerHour || 0);
  const oracleAge = Number(market?.price?.publishAgeSec || 0);
  const crankSlots = Number(market?.crank?.ageSlots || 0);
  const spread = Math.abs(Number(market?.execution?.spreadBps || 0));
  const quality = market?.dataQuality?.status === "uncertain";
  const flags = market?.flags || [];
  const reasons = [
    {
      label: "stress",
      value: pct(stress),
      detail: stress >= 80 ? "near cap" : stress >= 50 ? "crowded" : "contained",
      tone: stress >= 80 ? "danger" : stress >= 50 ? "warning" : "good"
    },
    {
      label: "skew",
      value: signedPct(skew),
      detail: Math.abs(skew) >= 35 ? "one-sided OI" : "balanced",
      tone: Math.abs(skew) >= 35 ? "warning" : "good"
    },
    {
      label: "carry",
      value: `${signedBps(funding)} / hr`,
      detail: Math.abs(funding) >= 2 ? "funding pressure" : "quiet",
      tone: Math.abs(funding) >= 2 ? "warning" : "good"
    },
    {
      label: "freshness",
      value: oracleAge ? `${oracleAge.toFixed(1)}s` : `${fmtInt(crankSlots)} slots`,
      detail: oracleAge > 10 || crankSlots > 80 ? "watch stale reads" : "fresh",
      tone: oracleAge > 10 || crankSlots > 80 ? "warning" : "good"
    },
    {
      label: "spread",
      value: signedBps(spread).replace("+", ""),
      detail: spread >= 20 ? "expensive entry" : "normal",
      tone: spread >= 20 ? "warning" : "good"
    },
    {
      label: "decode",
      value: quality ? "unit check" : "normalized",
      detail: quality ? "raw-scale value hidden" : "display-safe",
      tone: quality ? "warning" : "good"
    }
  ];
  const danger = reasons.filter((reason) => reason.tone === "danger").length + flags.filter((flag) => flag.tone === "danger").length;
  const warning = reasons.filter((reason) => reason.tone === "warning").length + flags.filter((flag) => flag.tone === "warning").length;
  const tone = danger ? "danger" : warning ? "warning" : "good";
  return {
    market: market?.name || "market",
    status: radarRow?.scoreLabel || `${market?.healthScore || 0} score`,
    lede: danger ? "Risk is concentrated here." : warning ? "Worth watching before sizing." : "No major heat source.",
    tone,
    reasons
  };
}

export function buildAdapterTargets(snapshot = {}, report = {}) {
  const missing = Number(report?.summary?.missingCount || 0);
  const marketCount = (snapshot.markets || []).length;
  const targets = TERMINAL_ADAPTER_TARGETS.map((target) => {
    const partial = target.id === "execution-lane" && missing > 0;
    return {
      ...target,
      status: partial ? "partial" : target.status,
      tone: partial ? "warning" : target.tone,
      note: target.id === "generic-terminal" ? `${marketCount} markets into a terminal rail` : target.note
    };
  });
  return {
    ready: targets.filter((target) => target.tone === "good").length,
    targets
  };
}

export function buildTraderRadar(markets = [], filter = "all") {
  const allRows = markets.map((market) => {
    const quality = market.dataQuality || {};
    const dangerFlags = (market.flags || []).filter((flag) => flag.tone === "danger").length;
    const warningFlags = (market.flags || []).filter((flag) => flag.tone === "warning").length;
    const stress = Number(market.marketStructure?.stressUsedPct || 0);
    const skew = Math.abs(Number(market.marketStructure?.oiSkewPct || 0));
    const funding = Math.abs(Number(market.funding?.bpsPerHour || 0));
    const oracleAge = Number(market.price?.publishAgeSec || 0);
    const qualityPenalty = quality.status === "uncertain" ? 18 : 0;
    const heat = clamp(
      dangerFlags * 28 +
      warningFlags * 12 +
      stress * 0.42 +
      skew * 0.2 +
      funding * 5 +
      oracleAge * 1.2 +
      qualityPenalty,
      0,
      100
    );
    const tone = heat >= 68 ? "danger" : heat >= 34 ? "warning" : "good";
    const detail = [
      `${pct(stress)} stress`,
      `${signedPct(Number(market.marketStructure?.oiSkewPct || 0))} skew`,
      `${signedBps(Number(market.funding?.bpsPerHour || 0))} carry`
    ].join(" / ");
    return {
      id: market.id,
      name: market.name,
      heat,
      tone,
      detail,
      scoreLabel: `${Math.round(heat)} heat`,
      qualityLabel: quality.status === "uncertain" ? "unit check" : "normalized"
    };
  }).sort((a, b) => b.heat - a.heat).map((row, index) => ({
    ...row,
    rank: String(index + 1).padStart(2, "0")
  }));

  const rows = filterRadarRows(allRows, filter);
  const hot = allRows.filter((row) => row.tone === "danger");
  const watch = allRows.filter((row) => row.tone === "warning");
  const uncertain = markets.filter((market) => market.dataQuality?.status === "uncertain").length;
  return {
    allRows,
    rows,
    filter,
    hot,
    watch,
    tiles: [
      { label: "hottest", value: allRows[0]?.name || "none", tone: allRows[0]?.tone || "neutral" },
      { label: "unit checks", value: String(uncertain), tone: uncertain ? "warning" : "good" },
      { label: "markets", value: `${rows.length}/${allRows.length}`, tone: "neutral" }
    ]
  };
}

function filterRadarRows(rows, filter) {
  if (filter === "hot") return rows.filter((row) => row.tone === "danger");
  if (filter === "unit-checked") return rows.filter((row) => row.qualityLabel === "unit check");
  if (filter === "normalized") return rows.filter((row) => row.qualityLabel === "normalized");
  if (filter === "fresh") return rows.filter((row) => row.tone !== "danger" && row.qualityLabel === "normalized");
  return rows;
}

function dataSourceModeForInput(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input.source || {} : {};
  const sourceText = [
    source.kind,
    source.scope,
    source.provider,
    input?.fixtureKind
  ].filter(Boolean).join(" ");
  if (source.live === true && /decoded|protocol|percolator|read-only-rpc/i.test(sourceText) && !/public-market-price/i.test(sourceText)) {
    return "live-decoded";
  }
  if (source.live === true) return "live-read";
  if (source.realBacked || /real|static/i.test(input?.fixtureKind || "")) return "static-real";
  return "fixture";
}

function assertLiveDecodedSource(input) {
  const shape = detectPercolatorInputShape(input);
  const source = input && typeof input === "object" && !Array.isArray(input) ? input.source || {} : {};
  const account = input?.account || input?.accountInfo || {};
  assertReadOnlySnapshot(input, "decodedSource");
  assertNoLiveDecodedMutation(input);
  if (source.live !== true) {
    throw new Error("Decoded source must declare source.live=true.");
  }
  if (!source.kind || !source.scope || !source.provider || !source.generatedAt) {
    throw new Error("Decoded source must include kind, provider, scope, and generatedAt provenance.");
  }
  if (account.data && !account.decoded) {
    throw new Error("Decoded source must include decoded account sections; raw account data alone is not enough.");
  }
  if (shape === "unknown") {
    throw new Error("Decoded source has no recognized Percolator sections.");
  }
}

function assertNoLiveDecodedMutation(value, path = "decodedSource") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizeKey(key);
    if (isLiveDecodedMutationKey(normalized)) {
      throw new Error(`Refusing mutating field in decoded source: ${path}.${key}`);
    }
    if (child && typeof child === "object") assertNoLiveDecodedMutation(child, `${path}.${key}`);
  }
}

function isLiveDecodedMutationKey(key) {
  return [
    "instruction",
    "instructions",
    "order",
    "orders",
    "sendtransaction",
    "signer",
    "signature",
    "signtransaction",
    "transaction",
    "transactions",
    "apikey",
    "authorization"
  ].includes(key);
}

function decodedSourceLabel(sourceUrl) {
  try {
    return new URL(sourceUrl).host || "decoded source";
  } catch {
    return "decoded source";
  }
}

function timestampSeconds(value) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0;
}

function compactAge(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function isPrivateNetworkHost(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "0.0.0.0" || host.endsWith(".local")) return true;
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [first, second] = parts;
  return first === 10
    || first === 0
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168);
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function actualMarketFromDto(market, priceFeed, nowMs) {
  const feedId = ACTUAL_PRICE_MARKETS[market.base];
  const feed = feedId ? priceFeed?.[feedId] || {} : {};
  const markPrice = positiveNumber(feed.usd) || market.price.mark;
  const change24hPct = finiteNumber(feed.usd_24h_change, 0);
  const lastUpdatedAt = finiteNumber(feed.last_updated_at, Math.floor(nowMs / 1000));
  const publishAgeSec = Math.max(0, Math.round(nowMs / 1000 - lastUpdatedAt));
  const indexPrice = change24hPct
    ? markPrice / (1 + change24hPct / 100)
    : markPrice;
  const spreadBps = Math.max(Math.abs(market.execution.spreadBps || 8), 4);
  const halfSpread = markPrice * (spreadBps / 20000);
  const oldNotional = Math.max(Math.abs(market.account.positionSize) * Math.max(market.price.mark, 1), 1);
  const positionSize = market.account.positionSize || market.account.positionNotionalUsd / Math.max(market.price.mark, 1);
  const positionNotionalUsd = Math.abs(positionSize) * markPrice;
  const unrealizedPnlUsd = market.account.unrealizedPnlUsd + positionSize * (markPrice - market.price.mark);
  const pricePath = [...(market.price.path || []).slice(-8), markPrice];
  const sourceTimestamp = new Date(lastUpdatedAt * 1000).toISOString();

  return {
    id: market.id,
    name: market.name,
    base: market.base,
    quote: market.quote,
    status: market.status,
    slab: market.slab,
    program: market.program,
    header: market.header,
    config: {
      ...market.config,
      maxStalenessSecs: Math.max(Number(market.config?.maxStalenessSecs || 0), 300)
    },
    oracle: {
      markPrice,
      indexPrice,
      effectivePrice: markPrice,
      confidenceBps: market.price.confidenceBps,
      publishAgeSec,
      pricePath,
      lastUpdatedAt,
      legs: [
        {
          name: "CoinGecko simple price",
          weight: 1,
          ageSec: publishAgeSec,
          confidenceBps: market.price.confidenceBps
        }
      ]
    },
    engine: {
      currentSlot: market.currentSlot,
      lastMarketSlot: market.currentSlot - market.crank.ageSlots,
      fundingRateBpsPerHour: market.funding.bpsPerHour,
      openInterestUsd: market.marketStructure.openInterestUsd,
      longOpenInterestUsd: market.marketStructure.longOpenInterestUsd,
      shortOpenInterestUsd: market.marketStructure.shortOpenInterestUsd,
      insuranceUsd: market.solvency.insuranceUsd,
      vaultUsd: market.solvency.vaultUsd,
      claimUsd: market.solvency.claimUsd,
      stressConsumedBps: market.marketStructure.stressUsedPct * 5,
      stressLimitBps: 500
    },
    account: {
      label: "Simulated risk context",
      side: market.account.side,
      positionSize,
      positionNotionalUsd,
      collateralUsd: market.account.collateralUsd,
      unrealizedPnlUsd,
      realizedPnlUsd: market.account.realizedPnlUsd,
      fundingPnlUsd: market.account.fundingPnlUsd,
      liquidationPrice: market.account.liquidationPrice
    },
    execution: {
      bestBid: markPrice - halfSpread,
      bestAsk: markPrice + halfSpread,
      spreadBps,
      impact10kBps: market.execution.impact10kBps,
      impact50kBps: market.execution.impact50kBps,
      markout1mBps: change24hPct / 24,
      markout5mBps: change24hPct / 4.8,
      fillQualityScore: market.execution.fillQualityScore,
      routeLatencyMs: market.execution.routeLatencyMs,
      priorityFeeMicrolamports: market.execution.priorityFeeMicrolamports,
      receipts: [{
        id: `${market.base}-${lastUpdatedAt}-public-price`,
        label: "public price tick",
        source: "CoinGecko simple price",
        sourceTimestamp,
        slot: market.currentSlot,
        side: market.account.side === "short" ? "sell" : "buy",
        notionalUsd: Math.min(10000, oldNotional),
        quotePrice: markPrice,
        fillPrice: markPrice,
        markPrice,
        bestBid: markPrice - halfSpread,
        bestAsk: markPrice + halfSpread,
        spreadBps,
        impactBps: market.execution.impact10kBps,
        markout1mBps: change24hPct / 24,
        markout5mBps: change24hPct / 4.8,
        routeLatencyMs: market.execution.routeLatencyMs,
        priorityFeeMicrolamports: market.execution.priorityFeeMicrolamports,
        oracleAgeSec: publishAgeSec,
        crankAgeSlots: market.crank.ageSlots,
        fundingBpsPerHour: market.funding.bpsPerHour,
        fillQualityScore: market.execution.fillQualityScore
      }]
    },
    history: {
      fundingSkew: [
        ...(market.history?.fundingSkew || []).slice(-5),
        {
          source: "public price tick / simulated risk context",
          sourceTimestamp,
          slot: market.currentSlot,
          fundingBpsPerHour: market.funding.bpsPerHour,
          longOpenInterestUsd: market.marketStructure.longOpenInterestUsd,
          shortOpenInterestUsd: market.marketStructure.shortOpenInterestUsd,
          stressConsumedBps: market.marketStructure.stressUsedPct * 5,
          stressLimitBps: 500,
          oracleAgeSec: publishAgeSec
        }
      ]
    }
  };
}

function positiveNumber(value) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : 0;
}

function finiteNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function buildCompatibilityReportExport(input, snapshot, report, options = {}) {
  if (input && report?.status !== "rejected") {
    return exportCompatibilityReport(input, snapshot, options);
  }
  return exportCompatibilityReportFromReport(report, options);
}

function currentExportContext() {
  const market = selectedMarket();
  const radar = buildTraderRadar(state.snapshot.markets, state.radarFilter);
  return {
    snapshot: state.snapshot,
    market,
    radar,
    hotReasons: buildMarketHotReasons(market, radar.allRows.find((row) => row.id === market.id)),
    feedHealth: buildFeedHealth(state.snapshot, state.dataSource, state.liveLoad, state.compatibilityReport),
    adapterTargets: buildAdapterTargets(state.snapshot, state.compatibilityReport),
    dataSource: state.dataSource,
    liveLoad: state.liveLoad,
    compatibilityReport: state.compatibilityReport,
    radarFilter: state.radarFilter,
    embedMode: state.embedMode,
    location: globalThis.location
  };
}

export function buildPerpScopeExport(context = {}, options = {}) {
  const snapshot = context.snapshot || {};
  const market = context.market || (snapshot.markets || [])[0] || {};
  const radar = context.radar || buildTraderRadar(snapshot.markets || [], context.radarFilter || "all");
  const hotReasons = context.hotReasons || buildMarketHotReasons(market, radar.allRows?.find((row) => row.id === market.id));
  const feedHealth = context.feedHealth || buildFeedHealth(snapshot, context.dataSource, context.liveLoad, context.compatibilityReport);
  const adapterTargets = context.adapterTargets || buildAdapterTargets(snapshot, context.compatibilityReport);
  const generatedAt = options.generatedAt || new Date().toISOString();
  return {
    schema: "perpscope.export.v1",
    version: "1.9.0",
    generatedAt,
    selection: {
      market: market.id || "",
      filter: context.radarFilter || radar.filter || "all",
      embed: context.embedMode || "",
      shareUrl: buildShareUrl(context.location, {
        market: market.id,
        filter: context.radarFilter || radar.filter || "all",
        embed: context.embedMode || ""
      })
    },
    source: {
      label: snapshot.source?.label || snapshot.label || "PerpScope snapshot",
      cluster: snapshot.cluster || "unknown",
      currentSlot: snapshot.currentSlot || 0,
      live: snapshot.source?.live === true,
      provider: snapshot.source?.provider || "",
      mode: context.dataSource?.mode || "fixture"
    },
    feedHealth,
    radar: {
      filter: radar.filter,
      rows: radar.rows,
      allRows: radar.allRows,
      tiles: radar.tiles
    },
    market: {
      id: market.id || "",
      name: market.name || "",
      status: market.status || "",
      healthScore: market.healthScore || 0,
      price: market.price || {},
      account: market.account || {},
      marketStructure: market.marketStructure || {},
      funding: market.funding || {},
      execution: market.execution || {},
      flags: market.flags || [],
      whyHot: hotReasons
    },
    adapterTargets,
    safety: {
      mode: "read-only",
      wallet: false,
      signer: false,
      transaction: false,
      orderRouting: false
    }
  };
}

function exportCockpitJson() {
  const payload = buildPerpScopeExport(currentExportContext());
  downloadJson("perpscope-export.json", payload);
  state.importStatus = {
    tone: "good",
    label: "cockpit exported",
    detail: "perpscope-export.json"
  };
  render();
}

function exportRadarJson() {
  const payload = buildPerpScopeExport(currentExportContext());
  downloadJson("perpscope-radar.json", {
    schema: "perpscope.radar.v1",
    generatedAt: payload.generatedAt,
    source: payload.source,
    selection: payload.selection,
    feedHealth: payload.feedHealth,
    radar: payload.radar,
    safety: payload.safety
  });
  state.importStatus = {
    tone: "good",
    label: "radar exported",
    detail: "perpscope-radar.json"
  };
  render();
}

function exportCurrentCompatibilityReport() {
  const report = buildCompatibilityReportExport(state.lastImportedInput, state.snapshot, state.compatibilityReport);
  const filename = compatibilityReportFilename(report);
  downloadJson(filename, report);
  state.importStatus = {
    tone: "good",
    label: "report exported",
    detail: filename
  };
  render();
}

async function copyTextToClipboard(text, successLabel, fallbackLabel) {
  try {
    await globalThis.navigator?.clipboard?.writeText?.(text);
    state.importStatus = {
      tone: "good",
      label: successLabel,
      detail: text.slice(0, 140)
    };
  } catch {
    state.importStatus = {
      tone: "neutral",
      label: fallbackLabel,
      detail: text.slice(0, 140)
    };
  }
  render();
}

function analyzeWorkbench() {
  try {
    state.workbench = createCompatibilityWorkbenchState(
      parsePercolatorJson(app.querySelector("#workbench-previous")?.value || ""),
      parsePercolatorJson(app.querySelector("#workbench-current")?.value || ""),
      {
        previousText: app.querySelector("#workbench-previous")?.value || "",
        currentText: app.querySelector("#workbench-current")?.value || ""
      }
    );
    state.importStatus = {
      tone: state.workbench.diff.tone === "danger" ? "warning" : state.workbench.diff.tone,
      label: "diff compared",
      detail: `${state.workbench.diff.summary.newMissingCount} new gaps, ${state.workbench.diff.summary.suggestionCount} suggestions`
    };
  } catch (error) {
    state.importStatus = {
      tone: "danger",
      label: error.message.slice(0, 44),
      detail: error.message
    };
  }
  render();
}

function loadWorkbenchSample() {
  state.workbench = createCompatibilityWorkbenchState(WORKBENCH_PREVIOUS_CAPTURE, WORKBENCH_CURRENT_CAPTURE, {
    previousText: workbenchPreviousText,
    currentText: workbenchCurrentText
  });
  state.importStatus = {
    tone: "good",
    label: "sample diff loaded",
    detail: "Workbench sample pair loaded"
  };
  render();
}

function exportWorkbenchDiff() {
  const filename = "perpscope-compatibility-diff.json";
  downloadJson(filename, state.workbench.diff);
  state.importStatus = {
    tone: "good",
    label: "diff exported",
    detail: filename
  };
  render();
}

export function createCompatibilityWorkbenchState(previousInput, currentInput, options = {}) {
  const previousReport = buildPercolatorCompatibilityReport(previousInput);
  const currentReport = buildPercolatorCompatibilityReport(currentInput);
  const diff = compareCompatibilityReports(previousReport, currentReport);
  return {
    previousText: options.previousText || JSON.stringify(previousInput, null, 2),
    currentText: options.currentText || JSON.stringify(currentInput, null, 2),
    previousReport,
    currentReport,
    diff
  };
}

function compatibilityReportFilename(report) {
  const source = [
    report.shape,
    report.source?.slab || report.source?.cluster || "capture"
  ].filter(Boolean).join("-");
  return `perpscope-compatibility-${slugify(source)}.json`;
}

function downloadJson(filename, value) {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined") return;
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function slugify(value) {
  return String(value || "capture")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "capture";
}

function rejectedCompatibilityReport(error) {
  const message = error?.message || "Capture rejected.";
  return {
    shape: "rejected",
    status: "rejected",
    compatible: false,
    tone: "danger",
    score: 0,
    recognizedSections: [
      {
        id: "safety",
        label: "read-only safety",
        tone: "danger",
        detail: "capture rejected"
      }
    ],
    missingFields: [],
    ignoredFields: [],
    aliasSuggestions: [],
    source: {
      label: message.slice(0, 80),
      mode: "read-only",
      commandSet: [],
      cluster: state.snapshot?.cluster || "unknown",
      currentSlot: state.snapshot?.currentSlot || 0,
      marketCount: state.snapshot?.markets?.length || 0,
      slab: "",
      program: ""
    },
    summary: {
      recognizedCount: 1,
      missingCount: 0,
      ignoredCount: 0,
      suggestionCount: 0,
      marketCount: state.snapshot?.markets?.length || 0,
      commandCount: 0
    }
  };
}

function bindDropZone(element) {
  if (!element) return;
  element.addEventListener("dragover", (event) => {
    event.preventDefault();
    element.classList.add("dragging");
  });
  element.addEventListener("dragleave", () => element.classList.remove("dragging"));
  element.addEventListener("drop", async (event) => {
    event.preventDefault();
    element.classList.remove("dragging");
    const [file] = event.dataTransfer.files || [];
    if (file) await importJsonFile(file);
  });
}

function gauge(score, status) {
  const color = status === "stable" ? "var(--mint)" : status === "watch" ? "var(--amber)" : "var(--red)";
  return `
    <div class="gauge" style="--score:${score}; --gauge-color:${color}" aria-label="Health score ${score}">
      <span></span>
    </div>
  `;
}

function liquidationBand(market, stress) {
  const current = market.price.mark;
  const liq = market.account.liquidationPrice;
  const lo = Math.min(current, liq, stress.nextPrice);
  const hi = Math.max(current, liq, stress.nextPrice);
  const pad = Math.max((hi - lo) * 0.35, current * 0.025);
  const min = lo - pad;
  const max = hi + pad;
  const currentLeft = clamp(((current - min) / (max - min)) * 100, 3, 97);
  const liqLeft = clamp(((liq - min) / (max - min)) * 100, 3, 97);
  const stressLeft = clamp(((stress.nextPrice - min) / (max - min)) * 100, 3, 97);
  return `
    <div class="liq-band" aria-label="Liquidation band: mark ${money(current, market.base === "WIF" ? 3 : 2)}, liquidation ${money(liq, market.base === "WIF" ? 3 : 2)}, stress ${money(stress.nextPrice, market.base === "WIF" ? 3 : 2)}">
      <span class="danger-zone" style="left:${Math.min(currentLeft, liqLeft)}%; width:${Math.abs(currentLeft - liqLeft)}%"></span>
      <i class="marker current" style="left:${currentLeft}%"><b>mark</b></i>
      <i class="marker liquidation" style="left:${liqLeft}%"><b>liq</b></i>
      <i class="marker stress" style="left:${stressLeft}%"><b>stress</b></i>
    </div>
  `;
}

function spineStep(label, value, score) {
  const tone = score >= 68 ? "good" : score >= 42 ? "warning" : "danger";
  return `
    <div class="spine-step ${tone}">
      <i></i>
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `;
}

function metric(label, value, tone = "neutral") {
  return `<div class="metric ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
}

function impactBar(label, value, max) {
  const width = clamp((value / max) * 100, 4, 100);
  const tone = value > max * 0.65 ? "danger" : value > max * 0.35 ? "warning" : "good";
  return `
    <div class="impact-row" aria-label="${esc(label)} impact ${value.toFixed(1)} basis points">
      <span>${esc(label)}</span>
      <i><b class="${tone}" style="width:${width}%"></b></i>
      <strong>${value.toFixed(1)}</strong>
    </div>
  `;
}

function watchtowerPanel(market, stress) {
  const signals = buildWatchtowerSignals(market, stress);
  const summary = watchtowerSummary(signals);
  return `
    <article class="watchtower-panel panel stagger-item">
      <div class="panel-head">
        <span class="panel-label">watchtower</span>
        <strong>${esc(summary)}</strong>
      </div>
      <div class="watchtower-grid" aria-label="Read-only perps risk signals">
        ${signals.map((signal) => watchSignalCard(signal)).join("")}
      </div>
    </article>
  `;
}

function watchSignalCard(signal) {
  const width = clamp(signal.score, 4, 100);
  return `
    <section class="watch-card ${signal.tone}" aria-label="${esc(signal.label)} ${esc(signal.value)}">
      <div class="watch-card-head">
        <span></span>
        <strong>${esc(signal.label)}</strong>
        <i>${esc(signal.tone)}</i>
      </div>
      <b>${esc(signal.value)}</b>
      <p>${esc(signal.detail)}</p>
      <div class="watch-meter" aria-hidden="true"><span style="width:${width}%"></span></div>
      <small>${esc(signal.subvalue)}</small>
    </section>
  `;
}

function watchtowerSummary(signals) {
  const dangerCount = signals.filter((signal) => signal.tone === "danger").length;
  const warningCount = signals.filter((signal) => signal.tone === "warning").length;
  if (dangerCount) return `${dangerCount} hot`;
  if (warningCount) return `${warningCount} watch`;
  return "clear";
}

function fundingHistoryPanel(market) {
  const rows = normalizeFundingSkewHistory(market.history?.fundingSkew || [], market);
  const summary = summarizeFundingSkewHistory(rows, market);
  const latest = summary.latest;
  return `
    <article class="history-panel panel stagger-item">
      <div class="panel-head">
        <span class="panel-label">carry history</span>
        <strong>${esc(summary.tone)}</strong>
      </div>
      <div class="history-summary">
        ${historyTile("funding", `${signedBps(latest.fundingBpsPerHour)} / hr`, fundingTone(latest.fundingBpsPerHour))}
        ${historyTile("OI skew", signedPct(latest.oiSkewPct), skewTone(latest.oiSkewPct))}
        ${historyTile("stress", pct(latest.stressUsedPct), latest.stressUsedPct >= 75 ? "danger" : latest.stressUsedPct >= 52 ? "warning" : "good")}
        ${historyTile("oracle", `${latest.oracleAgeSec.toFixed(1)}s`, latest.oracleAgeSec >= 8 ? "danger" : latest.oracleAgeSec >= 5 ? "warning" : "good")}
      </div>
      <div class="history-lanes" aria-label="Funding, skew, stress, and oracle age history">
        ${historyLine("funding", rows.map((row) => row.fundingBpsPerHour), signedBps)}
        ${historyLine("OI skew", rows.map((row) => row.oiSkewPct), signedPct)}
        ${historyLine("stress", rows.map((row) => row.stressUsedPct), pct)}
        ${historyLine("oracle", rows.map((row) => row.oracleAgeSec), (value) => `${value.toFixed(1)}s`)}
      </div>
      <div class="history-source-strip">
        <span>${esc(latest.source || "adapter")}</span>
        <span>${esc(timeLabel(latest.sourceTimestamp, latest.slot))}</span>
        <span>${fmtInt(latest.slot || market.currentSlot)}</span>
      </div>
    </article>
  `;
}

function historyTile(label, value, tone = "neutral") {
  return `<div class="history-tile ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
}

function historyLine(label, points, formatter) {
  const cleanPoints = points.map(Number).filter(Number.isFinite);
  if (!cleanPoints.length) return "";
  const width = 280;
  const height = 56;
  const min = Math.min(...cleanPoints, 0);
  const max = Math.max(...cleanPoints, 0);
  const range = max - min || 1;
  const path = cleanPoints.map((value, index) => {
    const x = (index / (cleanPoints.length - 1 || 1)) * width;
    const y = height - ((value - min) / range) * (height - 12) - 6;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const latest = cleanPoints[cleanPoints.length - 1];
  const zeroY = height - ((0 - min) / range) * (height - 12) - 6;
  return `
    <section class="history-lane" aria-label="${esc(label)} history ${esc(formatter(latest))}">
      <div>
        <span>${esc(label)}</span>
        <strong>${esc(formatter(latest))}</strong>
      </div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)} sparkline">
        <line x1="0" y1="${zeroY.toFixed(1)}" x2="${width}" y2="${zeroY.toFixed(1)}"></line>
        <polyline points="${path}"></polyline>
      </svg>
    </section>
  `;
}

function receiptPanel(market) {
  const receipts = market.execution.receipts || [];
  const latest = receipts[0];
  const averageLatency = receipts.length ? mean(receipts.map((receipt) => receipt.routeLatencyMs)) : market.execution.routeLatencyMs;
  const averageFee = receipts.length ? mean(receipts.map((receipt) => receipt.priorityFeeMicrolamports)) : market.execution.priorityFeeMicrolamports;
  const markoutPath = receipts.map((receipt) => receipt.markout5mBps);
  const averageMarkout = receipts.length ? mean(markoutPath) : market.execution.markout5mBps;
  return `
    <article class="receipt-panel panel stagger-item">
      <div class="panel-head">
        <span class="panel-label">receipt timeline</span>
        <strong>${receipts.length || "0"} fills</strong>
      </div>
      <div class="receipt-summary">
        ${receiptTile("latest", latest ? timeLabel(latest.sourceTimestamp, latest.slot) : "waiting")}
        ${receiptTile("latency", `${Math.round(averageLatency)} ms`, averageLatency <= 180 ? "good" : averageLatency <= 360 ? "warning" : "danger")}
        ${receiptTile("priority", feeLabel(averageFee))}
        ${receiptTile("5m markout", signedBps(averageMarkout), averageMarkout >= 0 ? "good" : "danger")}
      </div>
      ${receiptSparkline(markoutPath.length ? markoutPath : [market.execution.markout1mBps, market.execution.markout5mBps], averageMarkout)}
      <div class="receipt-timeline" aria-label="Execution receipt timeline">
        ${receipts.length ? receipts.map((receipt, index) => receiptStep(receipt, index)).join("") : emptyReceiptStep(market)}
      </div>
    </article>
  `;
}

function receiptTile(label, value, tone = "neutral") {
  return `<div class="receipt-tile ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
}

function receiptStep(receipt, index) {
  const qualityTone = receipt.fillQualityScore >= 72 ? "good" : receipt.fillQualityScore >= 48 ? "warning" : "danger";
  return `
    <section class="receipt-step ${qualityTone}" aria-label="${esc(receipt.label)} at ${esc(timeLabel(receipt.sourceTimestamp, receipt.slot))}">
      <div class="receipt-step-head">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <strong>${esc(receipt.label)}</strong>
        <i>${esc(notionalLabel(receipt.notionalUsd))}</i>
      </div>
      <div class="receipt-chips">
        <span>${esc(timeLabel(receipt.sourceTimestamp, receipt.slot))}</span>
        <span>${Math.round(receipt.routeLatencyMs)} ms</span>
        <span>${esc(feeLabel(receipt.priorityFeeMicrolamports))}</span>
        <span>${esc(receipt.source)}</span>
      </div>
      <div class="receipt-bars">
        ${receiptBar("spread", receipt.spreadBps, 130)}
        ${receiptBar("impact", receipt.impactBps, 150)}
        ${receiptBar("1m", receipt.markout1mBps, 70, true)}
        ${receiptBar("5m", receipt.markout5mBps, 80, true)}
      </div>
    </section>
  `;
}

function receiptBar(label, value, max, signed = false) {
  const width = clamp((Math.abs(value) / max) * 100, 4, 100);
  const tone = signed
    ? value >= 0 ? "good" : Math.abs(value) > max * 0.45 ? "danger" : "warning"
    : value > max * 0.65 ? "danger" : value > max * 0.35 ? "warning" : "good";
  const display = signed ? signedBps(value) : `${Number(value).toFixed(1)}`;
  return `
    <div class="receipt-bar" aria-label="${esc(label)} ${display}">
      <span>${esc(label)}</span>
      <i><b class="${tone}" style="width:${width}%"></b></i>
      <strong>${esc(display)}</strong>
    </div>
  `;
}

function receiptSparkline(points, averageMarkout) {
  const cleanPoints = points.map(Number).filter(Number.isFinite);
  if (!cleanPoints.length) return "";
  const width = 420;
  const height = 54;
  const min = Math.min(...cleanPoints, 0);
  const max = Math.max(...cleanPoints, 0);
  const range = max - min || 1;
  const path = cleanPoints.map((value, index) => {
    const x = (index / (cleanPoints.length - 1 || 1)) * width;
    const y = height - ((value - min) / range) * (height - 14) - 7;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const zeroY = height - ((0 - min) / range) * (height - 14) - 7;
  const tone = averageMarkout >= 0 ? "good" : "danger";
  return `
    <div class="receipt-pulse ${tone}">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="5 minute markout sparkline">
        <line x1="0" y1="${zeroY.toFixed(1)}" x2="${width}" y2="${zeroY.toFixed(1)}"></line>
        <polyline points="${path}"></polyline>
      </svg>
    </div>
  `;
}

function emptyReceiptStep(market) {
  return `
    <section class="receipt-step neutral" aria-label="No execution receipts imported">
      <div class="receipt-step-head">
        <span>--</span>
        <strong>adapter ready</strong>
        <i>read</i>
      </div>
      <div class="receipt-chips">
        <span>${Math.round(market.execution.routeLatencyMs)} ms</span>
        <span>${esc(feeLabel(market.execution.priorityFeeMicrolamports))}</span>
        <span>${signedBps(market.execution.markout5mBps)}</span>
      </div>
    </section>
  `;
}

function timeLabel(timestamp, slot) {
  const date = timestamp ? new Date(timestamp) : null;
  if (date && !Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return slot ? `slot ${fmtInt(slot)}` : "now";
}

function feeLabel(value) {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 1000) return `${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k uLamports`;
  return `${Math.round(amount)} uLamports`;
}

function notionalLabel(value) {
  const amount = Number(value) || 0;
  return amount > 0 ? money(amount, 0) : "fill";
}

function exposureLabel(side) {
  if (side === "short") return "net -";
  if (side === "long") return "net +";
  return "flat";
}

function scoreTone(score) {
  if (score >= 68) return "good";
  if (score >= 42) return "warning";
  return "danger";
}

function fundingTone(value) {
  const abs = Math.abs(Number(value));
  if (abs >= 3.2) return "danger";
  if (abs >= 1.4) return "warning";
  return "good";
}

function skewTone(value) {
  const abs = Math.abs(Number(value));
  if (abs >= 48) return "danger";
  if (abs >= 24) return "warning";
  return "good";
}

function sparkline(points, tone) {
  if (!points.length) return "";
  const width = 280;
  const height = 72;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const path = points.map((value, index) => {
    const x = (index / (points.length - 1 || 1)) * width;
    const y = height - ((value - min) / range) * (height - 12) - 6;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `
    <svg class="spark ${tone}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${tone} sparkline from ${money(min, 2)} to ${money(max, 2)}">
      <polyline points="${path}" />
    </svg>
  `;
}

function sourceStrip(snapshot) {
  const source = snapshot.source || {};
  const commands = Array.isArray(source.commandSet) ? source.commandSet.length : 0;
  const chips = [
    source.label || "decoded snapshot",
    source.mode || "read-only",
    commands ? `${commands} cli commands` : `${snapshot.markets.length} markets`
  ];
  return `
    <div class="source-strip" aria-label="Snapshot provenance">
      ${chips.map((chip) => `<span>${esc(chip)}</span>`).join("")}
    </div>
  `;
}

export function buildDeploymentSummaries(deployments = READ_ONLY_DEPLOYMENTS) {
  return deployments.map((deployment) => {
    const freshnessRatio = deployment.maxOracleAgeSec
      ? deployment.oracleAgeSec / deployment.maxOracleAgeSec
      : 1;
    return {
      ...deployment,
      ownerShort: shortAddress(deployment.owner),
      size: dataSize(deployment.dataLength),
      freshnessPct: clamp((1 - freshnessRatio) * 100, 0, 100),
      tone: freshnessRatio <= 0.55 ? "good" : freshnessRatio <= 1 ? "warning" : "danger"
    };
  });
}

export function buildTerminalRecipeSummaries(recipes = TERMINAL_RECIPES) {
  return recipes.map((recipe, index) => ({
    ...recipe,
    step: String(index + 1).padStart(2, "0")
  }));
}

function deploymentPanel() {
  const deployments = buildDeploymentSummaries();
  return `
    <article class="deployment-panel panel stagger-item">
      <div class="panel-head">
        <span class="panel-label">deployment reads</span>
        <strong>${deployments.length} examples</strong>
      </div>
      <div class="deployment-grid" aria-label="Read-only Percolator deployment examples">
        ${deployments.map((deployment) => deploymentCard(deployment)).join("")}
      </div>
    </article>
  `;
}

function deploymentCard(deployment) {
  return `
    <section class="deployment-card ${deployment.tone}" aria-label="${esc(deployment.label)} ${esc(deployment.market)} read example">
      <div class="deployment-title">
        <span>${esc(deployment.cluster)}</span>
        <strong>${esc(deployment.market)}</strong>
        <i>${esc(deployment.method)}</i>
      </div>
      <div class="deployment-ledger">
        <span>owner</span><strong>${esc(deployment.ownerShort)}</strong>
        <span>len</span><strong>${esc(deployment.size)}</strong>
        <span>magic</span><strong>${esc(deployment.magic)}</strong>
        <span>oracle</span><strong>${deployment.oracleAgeSec.toFixed(1)}s / ${deployment.maxOracleAgeSec}s</strong>
      </div>
      <div class="deployment-freshness" aria-hidden="true"><span style="width:${deployment.freshnessPct}%"></span></div>
      <small>${esc(deployment.fixture)}</small>
    </section>
  `;
}

function recipePanel() {
  const recipes = buildTerminalRecipeSummaries();
  return `
    <article class="recipe-panel panel stagger-item">
      <div class="panel-head">
        <span class="panel-label">terminal recipes</span>
        <strong>${recipes.length} paths</strong>
      </div>
      <div class="recipe-flow" aria-label="Terminal import and export recipes">
        ${recipes.map((recipe) => recipeCard(recipe)).join("")}
      </div>
      <div class="dto-strip" aria-label="DTO export provenance">
        <span>source</span>
        <span>cluster</span>
        <span>slot</span>
        <span>slab</span>
        <span>program</span>
        <span>watchtower</span>
      </div>
    </article>
  `;
}

function recipeCard(recipe) {
  return `
    <section class="recipe-card" aria-label="${esc(recipe.label)} recipe">
      <span>${esc(recipe.step)}</span>
      <strong>${esc(recipe.label)}</strong>
      <p>${esc(recipe.entry)} -> ${esc(recipe.output)}</p>
      <small>${esc(recipe.commands)}</small>
    </section>
  `;
}

function shapeLabel(shape) {
  if (shape === "percolator-cli-bundle") return "cli bundle";
  if (shape === "perpscope-snapshot") return "snapshot";
  if (shape === "read-only-rpc-fetch") return "rpc read";
  if (shape === "funding-skew-history") return "carry history";
  if (shape === "percolator-market-array") return "market array";
  if (shape === "unknown") return "unknown";
  if (shape === "rejected") return "rejected";
  return "market import";
}

function toneClass(status) {
  return status === "stable" ? "good" : status === "watch" ? "warning" : "danger";
}

function money(value, digits = 2) {
  const amount = Number(value);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}m`;
  if (abs >= 10000) return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function pct(value) {
  return `${Number(value).toFixed(1)}%`;
}

function signedPct(value) {
  const next = Number(value);
  return `${next >= 0 ? "+" : ""}${next.toFixed(1)}%`;
}

function signedBps(value) {
  const next = Number(value);
  return `${next >= 0 ? "+" : ""}${next.toFixed(1)} bps`;
}

function fmtInt(value) {
  return Number(value).toLocaleString("en-US");
}

function dataSize(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}mb`;
  if (value >= 1000) return `${Math.round(value / 1000)}kb`;
  return `${value}b`;
}

function shortAddress(value) {
  const text = String(value || "");
  if (text.length <= 18) return text;
  return `${text.slice(0, 8)}...${text.slice(-6)}`;
}

function mean(values) {
  const numbers = values.map(Number).filter(Number.isFinite);
  if (!numbers.length) return 0;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
