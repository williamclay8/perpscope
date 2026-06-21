import React from "react";
import { createRoot } from "react-dom/client";
import { summarizePerpScopeExport } from "@perpscope/percolator-adapter";
import sampleExport from "../../perpscope-export.sample.json";
import "./styles.css";

export function PerpScopeRiskRail({ payload = sampleExport }) {
  const summary = summarizePerpScopeExport(payload);

  return (
    <aside className="perpscope-rail" aria-label="PerpScope read-only risk rail">
      <header className="rail-header">
        <div>
          <span className="eyebrow">PerpScope rail</span>
          <h1>{summary.market}</h1>
        </div>
        <strong>{summary.heat}</strong>
      </header>

      <dl className="rail-stats">
        <div>
          <dt>Feed</dt>
          <dd>{summary.feedHealth.markets} markets</dd>
        </div>
        <div>
          <dt>Slot</dt>
          <dd>{summary.feedHealth.slot}</dd>
        </div>
        <div>
          <dt>Checks</dt>
          <dd>{summary.feedHealth.unitChecks} / {summary.feedHealth.gaps}</dd>
        </div>
        <div>
          <dt>Safety</dt>
          <dd>{summary.readOnly ? "read-only" : "blocked"}</dd>
        </div>
      </dl>

      <section className="reason-grid" aria-label="Why hot reasons">
        {summary.whyHot.map((reason) => (
          <article className={`reason reason-${reason.tone}`} key={reason.label}>
            <span>{reason.label}</span>
            <strong>{reason.value}</strong>
          </article>
        ))}
      </section>
    </aside>
  );
}

function App() {
  return (
    <main className="preview-shell">
      <section className="terminal-surface">
        <div className="chart-header">
          <span>WIF-PERP</span>
          <strong>$1.790</strong>
        </div>
        <div className="chart-line" />
      </section>
      <PerpScopeRiskRail />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
