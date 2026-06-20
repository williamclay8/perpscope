import { percolatorFixture } from "./fixtures/percolator-market.js";
import {
  detectPercolatorInputShape,
  normalizePercolatorSnapshot,
  parsePercolatorJson,
  simulatePriceShock
} from "./lib/percolator-adapter.js";

export const DEMO_CLI_PATH = "./examples/percolator-cli.bundle.json";

const state = {
  snapshot: normalizePercolatorSnapshot(percolatorFixture),
  selectedMarketId: "sol-perp",
  shockPct: -3,
  importStatus: {
    tone: "neutral",
    label: "fixture loaded",
    detail: "PerpScope fixture loaded"
  }
};

const app = typeof document === "undefined" ? null : document.querySelector("#app");

if (app) render();

function render() {
  const market = selectedMarket();
  const stress = simulatePriceShock(market, state.shockPct);
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
              <strong>${esc(market.account.side)}</strong>
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
              <code>toTerminalMarketDto()</code>
              <code>simulatePriceShock()</code>
            </div>
          </article>
        </section>
      </section>
    </main>
  `;

  app.querySelectorAll("[data-market-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedMarketId = button.dataset.marketId;
      state.shockPct = state.selectedMarketId === "wif-perp" ? -5 : -3;
      render();
    });
  });

  app.querySelector("#shock").addEventListener("input", (event) => {
    state.shockPct = Number(event.target.value);
    render();
  });

  const fileInput = app.querySelector("#json-file");
  app.querySelector("#import-json").addEventListener("click", () => fileInput.click());
  app.querySelector("#try-cli").addEventListener("click", loadCliDemo);
  fileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (file) await importJsonFile(file);
  });

  app.querySelector("#reset-fixture").addEventListener("click", () => {
    state.snapshot = normalizePercolatorSnapshot(percolatorFixture);
    state.selectedMarketId = "sol-perp";
    state.shockPct = -3;
    state.importStatus = {
      tone: "neutral",
      label: "fixture loaded",
      detail: "PerpScope fixture loaded"
    };
    render();
  });

  const importDock = app.querySelector("#import-dock");
  importDock.addEventListener("dragover", (event) => {
    event.preventDefault();
    importDock.classList.add("dragging");
  });
  importDock.addEventListener("dragleave", () => importDock.classList.remove("dragging"));
  importDock.addEventListener("drop", async (event) => {
    event.preventDefault();
    importDock.classList.remove("dragging");
    const [file] = event.dataTransfer.files || [];
    if (file) await importJsonFile(file);
  });
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

async function importJsonFile(file) {
  try {
    const imported = parsePercolatorJson(await file.text());
    loadImportedSnapshot(imported, {
      detailPrefix: file.name
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

async function loadCliDemo() {
  try {
    const imported = await fetchCliDemoSnapshot(fetch);
    loadImportedSnapshot(imported, {
      label: "demo cli loaded",
      detailPrefix: DEMO_CLI_PATH.replace(/^\.\//, "")
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

export async function fetchCliDemoSnapshot(fetcher) {
  const response = await fetcher(DEMO_CLI_PATH);
  if (!response.ok) throw new Error("CLI demo fixture unavailable.");
  return parsePercolatorJson(await response.text());
}

export function createImportedSnapshotState(imported, options = {}) {
  const shape = detectPercolatorInputShape(imported);
  const snapshot = normalizePercolatorSnapshot(imported);
  if (!snapshot.markets.length) {
    throw new Error("No markets found.");
  }
  const commandCount = Array.isArray(snapshot.source?.commandSet) ? snapshot.source.commandSet.length : 0;
  return {
    snapshot,
    selectedMarketId: snapshot.markets[0].id,
    shockPct: -3,
    importStatus: {
      tone: "good",
      label: options.label || `${snapshot.markets.length} ${shapeLabel(shape)}`,
      detail: `${options.detailPrefix || "import"}: ${snapshot.markets.length} market import${commandCount ? `, ${commandCount} commands` : ""}`
    }
  };
}

function loadImportedSnapshot(imported, options = {}) {
  Object.assign(state, createImportedSnapshotState(imported, options));
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

function shapeLabel(shape) {
  if (shape === "percolator-cli-bundle") return "cli bundle";
  if (shape === "perpscope-snapshot") return "snapshot";
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
