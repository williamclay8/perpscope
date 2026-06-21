import { existsSync, readdirSync, readFileSync } from "node:fs";
import {
  buildCompatibilityBadge,
  buildCompatibilityDoctor,
  buildCompatibilityRealityCheck,
  buildPercolatorCompatibilityReport,
  compareCompatibilityReports,
  exportCompatibilityReport,
  normalizePercolatorSnapshot
} from "../src/lib/percolator-adapter.js";
import { normalizeFundingSkewHistory } from "../src/lib/funding-history.js";
import { buildReadOnlyRpcSnapshot, summarizeReadOnlyRpcDeployment } from "../src/lib/read-only-rpc-fetcher.js";
import { percolatorFixture } from "../src/fixtures/percolator-market.js";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const feedbackLoopDoc = readFileSync(new URL("../docs/feedback-loop.md", import.meta.url), "utf8");
const fieldMapDoc = readFileSync(new URL("../docs/field-compatibility-map.md", import.meta.url), "utf8");
const launchPostDoc = readFileSync(new URL("../docs/launch-post.md", import.meta.url), "utf8");
const v2LaunchPostDoc = readFileSync(new URL("../docs/perpscope-v2-launch-post.md", import.meta.url), "utf8");
const outreachLoopDoc = readFileSync(new URL("../docs/outreach-loop.md", import.meta.url), "utf8");
const releaseV04Doc = readFileSync(new URL("../docs/release-v0.4.0.md", import.meta.url), "utf8");
const releaseV05Doc = readFileSync(new URL("../docs/release-v0.5.0.md", import.meta.url), "utf8");
const releaseV06Doc = readFileSync(new URL("../docs/release-v0.6.0.md", import.meta.url), "utf8");
const releaseV07Doc = readFileSync(new URL("../docs/release-v0.7.0.md", import.meta.url), "utf8");
const releaseV08Doc = readFileSync(new URL("../docs/release-v0.8.0.md", import.meta.url), "utf8");
const releaseV09Doc = readFileSync(new URL("../docs/release-v0.9.0.md", import.meta.url), "utf8");
const releaseV10Doc = readFileSync(new URL("../docs/release-v1.0.0.md", import.meta.url), "utf8");
const releaseV101Doc = readFileSync(new URL("../docs/release-v1.0.1.md", import.meta.url), "utf8");
const releaseV11Doc = readFileSync(new URL("../docs/release-v1.1.0.md", import.meta.url), "utf8");
const releaseV12Doc = readFileSync(new URL("../docs/release-v1.2.0.md", import.meta.url), "utf8");
const releaseV13Doc = readFileSync(new URL("../docs/release-v1.3.0.md", import.meta.url), "utf8");
const releaseV14Doc = readFileSync(new URL("../docs/release-v1.4.0.md", import.meta.url), "utf8");
const releaseV15Doc = readFileSync(new URL("../docs/release-v1.5.0.md", import.meta.url), "utf8");
const releaseV16Doc = readFileSync(new URL("../docs/release-v1.6.0.md", import.meta.url), "utf8");
const releaseV17Doc = readFileSync(new URL("../docs/release-v1.7.0.md", import.meta.url), "utf8");
const releaseV18Doc = readFileSync(new URL("../docs/release-v1.8.0.md", import.meta.url), "utf8");
const releaseV19Doc = readFileSync(new URL("../docs/release-v1.9.0.md", import.meta.url), "utf8");
const releaseV20Doc = readFileSync(new URL("../docs/release-v2.0.0.md", import.meta.url), "utf8");
const adapterTargetsDoc = readFileSync(new URL("../docs/adapter-targets.md", import.meta.url), "utf8");
const embedIntegrationDoc = readFileSync(new URL("../docs/embed-integration.md", import.meta.url), "utf8");
const decodedLiveSourceDoc = readFileSync(new URL("../docs/decoded-live-source.md", import.meta.url), "utf8");
const decoderWorker = readFileSync(new URL("../scripts/percolator-decoder-worker.mjs", import.meta.url), "utf8");
const decoderWorkerLib = readFileSync(new URL("../src/lib/percolator-decoder-worker.js", import.meta.url), "utf8");
const decoderWorkerThread = readFileSync(new URL("../src/lib/percolator-decoder-thread.js", import.meta.url), "utf8");
const renderYaml = readFileSync(new URL("../render.yaml", import.meta.url), "utf8");
const contributingDoc = readFileSync(new URL("../CONTRIBUTING.md", import.meta.url), "utf8");
const terminalQuickstartDoc = readFileSync(new URL("../docs/terminal-builder-quickstart.md", import.meta.url), "utf8");
const v05PlanDoc = readFileSync(new URL("../docs/v0.5-plan.md", import.meta.url), "utf8");
const fieldMapJson = JSON.parse(readFileSync(new URL("../examples/field-compatibility-map.json", import.meta.url), "utf8"));
const compatibilityReportExport = JSON.parse(readFileSync(new URL("../examples/compatibility-report-export.json", import.meta.url), "utf8"));
const compatibilityDiff = JSON.parse(readFileSync(new URL("../examples/compatibility-diff.json", import.meta.url), "utf8"));
const minimalFixturePack = JSON.parse(readFileSync(new URL("../examples/fixture-pack-minimal-terminal.json", import.meta.url), "utf8"));
const driftedFixturePack = JSON.parse(readFileSync(new URL("../examples/fixture-pack-drifted-aliases.json", import.meta.url), "utf8"));
const receiptHeavyFixturePack = JSON.parse(readFileSync(new URL("../examples/fixture-pack-receipt-heavy-execution.json", import.meta.url), "utf8"));
const realSanitizedFixturePack = JSON.parse(readFileSync(new URL("../examples/fixture-pack-real-sanitized-rpc-shape.json", import.meta.url), "utf8"));
const captureTemplate = JSON.parse(readFileSync(new URL("../examples/capture-template.json", import.meta.url), "utf8"));
const decodedLiveSourceSample = JSON.parse(readFileSync(new URL("../examples/decoded-live-source.sample.json", import.meta.url), "utf8"));
const decodedShapeIssueTemplate = readFileSync(new URL("../.github/ISSUE_TEMPLATE/decoded-percolator-shape.yml", import.meta.url), "utf8");
const adapterMappingIssueTemplate = readFileSync(new URL("../.github/ISSUE_TEMPLATE/adapter-mapping-request.yml", import.meta.url), "utf8");
const terminalUseIssueTemplate = readFileSync(new URL("../.github/ISSUE_TEMPLATE/use-perpscope-in-terminal.yml", import.meta.url), "utf8");
const cliDoctorIssueTemplate = readFileSync(new URL("../.github/ISSUE_TEMPLATE/cli-doctor-output.yml", import.meta.url), "utf8");
const schemaDir = new URL("../schemas/", import.meta.url);
const exampleDir = new URL("../examples/", import.meta.url);
const packageEntry = readFileSync(new URL("../packages/percolator-adapter/index.js", import.meta.url), "utf8");
const packageManifest = readFileSync(new URL("../packages/percolator-adapter/package.json", import.meta.url), "utf8");
const packageJson = JSON.parse(packageManifest);
const packageCli = readFileSync(new URL("../packages/percolator-adapter/bin/perpscope.mjs", import.meta.url), "utf8");
const consumerPackage = readFileSync(new URL("../examples/adapter-consumer/package.json", import.meta.url), "utf8");
const consumerDemo = readFileSync(new URL("../examples/adapter-consumer/demo.mjs", import.meta.url), "utf8");
const embedConsumerReadme = readFileSync(new URL("../examples/embed-consumer/README.md", import.meta.url), "utf8");
const embedConsumerDemo = readFileSync(new URL("../examples/embed-consumer/demo.mjs", import.meta.url), "utf8");
const embedConsumerHtml = readFileSync(new URL("../examples/embed-consumer/index.html", import.meta.url), "utf8");
const copyIntegrationReadme = readFileSync(new URL("../examples/copy-integration/README.md", import.meta.url), "utf8");
const copyIntegrationHtml = readFileSync(new URL("../examples/copy-integration/index.html", import.meta.url), "utf8");
const reactRiskRailReadme = readFileSync(new URL("../examples/react-risk-rail/README.md", import.meta.url), "utf8");
const reactRiskRailApp = readFileSync(new URL("../examples/react-risk-rail/src/App.jsx", import.meta.url), "utf8");
const reactRiskRailCss = readFileSync(new URL("../examples/react-risk-rail/src/styles.css", import.meta.url), "utf8");
const perpscopeExportSample = JSON.parse(readFileSync(new URL("../examples/perpscope-export.sample.json", import.meta.url), "utf8"));
const perpscopeExportSchema = JSON.parse(readFileSync(new URL("../schemas/perpscope-export.schema.json", import.meta.url), "utf8"));
const npmPublishWorkflow = readFileSync(new URL("../.github/workflows/npm-publish.yml", import.meta.url), "utf8");

const failures = [];

if (/transition\s*:\s*all\b/.test(css)) {
  failures.push("CSS must not use transition: all.");
}

if (/letter-spacing\s*:\s*-/.test(css)) {
  failures.push("CSS must not use negative letter spacing.");
}

if (/(connect wallet|sign transaction|trade now|long\s*<\/button>|short\s*<\/button>)/i.test(html + js)) {
  failures.push("Read-only app must not expose wallet/sign/trade affordances.");
}

if (/(place order|send order|market order|limit order|submit trade)/i.test(html + js)) {
  failures.push("Read-only app must not expose order entry affordances.");
}

if (!/<title>PerpScope<\/title>/.test(html) || !/<meta\s+name="description"/.test(html)) {
  failures.push("HTML should include launch-ready title and description metadata.");
}

if (!/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css)) {
  failures.push("CSS should include reduced-motion handling.");
}

if (/\.utility-button\s*{[^}]*min-height:\s*(?:[0-3]?\d|4[0-3])px/s.test(css)) {
  failures.push("Utility buttons should keep a 44px minimum hit area.");
}

if (!/aria-pressed=/.test(js)) {
  failures.push("Market selector should expose selected state to assistive tech.");
}

if (!/id="try-cli"/.test(js)) {
  failures.push("Cockpit should expose the low-friction CLI demo loader.");
}

if (!/watchtower-panel/.test(js) || !/buildWatchtowerSignals/.test(js)) {
  failures.push("Cockpit should expose the Watchtower read-only signal layer.");
}

if (!/history-panel/.test(js) || !/normalizeFundingSkewHistory/.test(js)) {
  failures.push("Cockpit should expose the funding/skew history signal layer.");
}

if (!/deployment-panel/.test(js) || !/READ_ONLY_DEPLOYMENTS/.test(js)) {
  failures.push("Cockpit should expose read-only deployment examples.");
}

if (!/recipe-panel/.test(js) || !/TERMINAL_RECIPES/.test(js)) {
  failures.push("Cockpit should expose terminal import/export recipes.");
}

if (!/capture-panel/.test(js) || !/buildPercolatorCompatibilityReport/.test(js)) {
  failures.push("Cockpit should expose the capture intake compatibility report.");
}

if (!/id="export-compatibility"/.test(js) || !/buildCompatibilityReportExport/.test(js)) {
  failures.push("Cockpit should expose a compatibility report export action.");
}

if (!/compat-diff-strip/.test(js) || !/compat-suggestions/.test(js) || !/compareCompatibilityReports/.test(js)) {
  failures.push("Cockpit should expose compatibility drift and alias suggestions.");
}

if (!/workbench-panel/.test(js) || !/createCompatibilityWorkbenchState/.test(js) || !/export-workbench-diff/.test(js)) {
  failures.push("Cockpit should expose the local compatibility workbench.");
}

if (!/reality-panel/.test(js) || !/buildCompatibilityRealityCheck/.test(js) || !/REALITY_CHECK_CAPTURE/.test(js)) {
  failures.push("Cockpit should expose the reality check panel and real-backed candidate capture.");
}

if (!/data-source-panel/.test(js) || !/STATIC_REAL_SNAPSHOT_PATH/.test(js) || !/fetchStaticRealSnapshot/.test(js) || !/createDataSourceState/.test(js) || !/ACTUAL_PRICE_ENDPOINT/.test(js) || !/fetchActualMarketSnapshot/.test(js) || !/load-actual-prices/.test(js) || !/fetchLiveDecodedSource/.test(js) || !/load-live-decoded/.test(js) || !/LIVE_DECODED_SOURCE_PARAM/.test(js)) {
  failures.push("Cockpit should expose fixture/static-real/live/decoded data source disclosure and actual public price loading.");
}

if (!/trader-radar-panel/.test(js) || !/buildTraderRadar/.test(js) || !/DEFAULT_LIVE_DECODED_SOURCE_URL/.test(js) || !/Load Percolator/.test(js)) {
  failures.push("Cockpit should expose default live Percolator loading and the Trader Radar market ranking.");
}

if (!/shouldAutoLoadLivePercolator/.test(js) || !/dataConfidenceStrip/.test(js) || !/buildDataConfidence/.test(js) || !/RADAR_FILTERS/.test(js) || !/data-radar-filter/.test(js) || !/loading decoded Percolator feed/.test(js)) {
  failures.push("Cockpit should auto-load live Percolator on the public site and expose confidence plus radar filters.");
}

if (!/hot-reasons-panel/.test(js) || !/buildMarketHotReasons/.test(js) || !/feed-health-panel/.test(js) || !/buildFeedHealth/.test(js) || !/buildShareUrl/.test(js) || !/copy-market-link/.test(js) || !/TERMINAL_ADAPTER_TARGETS/.test(js) || !/adapter-targets-panel/.test(js)) {
  failures.push("Cockpit should expose v1.7 why-hot explanations, feed health, share links, and adapter targets.");
}

if (!/buildPerpScopeExport/.test(js) || !/perpscope\.export\.v1/.test(js) || !/export-hub-panel/.test(js) || !/export-cockpit-json/.test(js) || !/export-radar-json/.test(js) || !/copy-market-json/.test(js) || !/EMBED_MODES/.test(js) || !/\?embed=/.test(js) || !/buildEmbedUrl/.test(js)) {
  failures.push("Cockpit should expose v1.8 exportable JSON and feed/radar/market embeds.");
}

if (!/createDecoderHttpHandler/.test(decoderWorker) || !/perpscope\.json/.test(decoderWorkerLib) || !/getMarketsByAddress/.test(decoderWorkerLib) || !/new Worker/.test(decoderWorkerLib) || !/buildPerpScopeDecodedSnapshot/.test(decoderWorkerThread) || !/PERPSCOPE_ALLOWED_ORIGIN/.test(decoderWorker) || !/PERPSCOPE_DECODER_TIMEOUT_MS/.test(decoderWorker) || !/localhost\|127/.test(decoderWorkerLib) || !/healthz/.test(decoderWorkerLib)) {
  failures.push("Decoder worker should expose health and PerpScope JSON endpoints backed by read-only SDK account reads.");
}

if (!/dataQuality/.test(decoderWorkerLib) || !/raw scale hidden/.test(decoderWorkerLib) || !/MAX_REASONABLE_LIVE_USD/.test(decoderWorkerLib)) {
  failures.push("Decoder worker should label and hide raw-scale live decoded values.");
}

if (!/perpscope-decoder-worker/.test(renderYaml) || !/npm run decoder:start/.test(renderYaml) || !/PERPSCOPE_ALLOWED_ORIGIN/.test(renderYaml) || !/PERPSCOPE_DECODER_TIMEOUT_MS/.test(renderYaml)) {
  failures.push("Render Blueprint should deploy the read-only decoder worker with CORS configuration.");
}

const dto = normalizePercolatorSnapshot(percolatorFixture);
if (dto.markets.length < 3) {
  failures.push("Fixture should expose at least three markets for the cockpit.");
}

if (!dto.markets.some((market) => market.status === "risk")) {
  failures.push("Fixture should include a risk state for visual QA.");
}

if (!dto.markets.every((market) => market.history?.fundingSkew?.length >= 1)) {
  failures.push("Fixture markets should expose funding/skew history rows.");
}

const compatibilityReport = buildPercolatorCompatibilityReport(percolatorFixture, dto);
if (compatibilityReport.status !== "compatible") {
  failures.push("Fixture compatibility report should be compatible.");
}

const exportedCompatibility = exportCompatibilityReport(percolatorFixture, dto, {
  generatedAt: "2026-06-21T00:00:00.000Z"
});
if (exportedCompatibility.schema !== "perpscope.compatibility-report" || exportedCompatibility.package.version !== "2.0.0") {
  failures.push("Exported compatibility report should include the stable schema and package version.");
}

const driftReport = buildPercolatorCompatibilityReport({
  label: "terminal drift sample",
  market: { symbol: "SOL-PERP", slab: "PERCOLAT_SOL", program: "Perco1ator" },
  oraclePriceUsd: 181.61,
  oracleAgeSeconds: 2,
  oiUsd: 12500000
});
const drift = compareCompatibilityReports(compatibilityReport, driftReport, {
  generatedAt: "2026-06-21T00:00:00.000Z"
});
if (drift.schema !== "perpscope.compatibility-diff" || drift.package.version !== "2.0.0" || !drift.aliasSuggestions.some((suggestion) => suggestion.candidatePath === "oraclePriceUsd")) {
  failures.push("Compatibility diff should include schema, version, and alias suggestions.");
}

const realityCheck = buildCompatibilityRealityCheck(
  buildPercolatorCompatibilityReport(realSanitizedFixturePack, buildReadOnlyRpcSnapshot(realSanitizedFixturePack)),
  { input: realSanitizedFixturePack, generatedAt: "2026-06-21T00:00:00.000Z" }
);
if (realityCheck.schema !== "perpscope.reality-check" || realityCheck.package.version !== "2.0.0" || realityCheck.status !== "candidate" || realityCheck.mapped.requiredCount !== 3) {
  failures.push("Reality check should classify the real-backed sanitized fixture candidate.");
}

const templateDoctor = buildCompatibilityDoctor(captureTemplate, {
  generatedAt: "2026-06-21T00:00:00.000Z"
});
const templateBadge = buildCompatibilityBadge(templateDoctor, {
  generatedAt: "2026-06-21T00:00:00.000Z"
});
if (templateDoctor.schema !== "perpscope.compatibility-doctor" || templateDoctor.package.version !== "2.0.0" || templateDoctor.required.mapped !== 3 || !templateDoctor.nextActions.length) {
  failures.push("Capture template should produce a useful compatibility doctor summary.");
}
if (templateBadge.schema !== "perpscope.compatibility-badge" || !templateBadge.markdown.includes("PerpScope compatible")) {
  failures.push("Capture template should produce a compatibility badge.");
}

if (!/normalizePercolatorSnapshot/.test(packageEntry) || !/buildWatchtowerSignals/.test(packageEntry) || !/normalizeFundingSkewHistory/.test(packageEntry) || !/buildPercolatorCompatibilityReport/.test(packageEntry) || !/exportCompatibilityReport/.test(packageEntry) || !/compareCompatibilityReports/.test(packageEntry) || !/buildCompatibilityRealityCheck/.test(packageEntry) || !/buildCompatibilityDoctor/.test(packageEntry) || !/buildCompatibilityBadge/.test(packageEntry) || !/parsePerpScopeExport/.test(packageEntry) || !/summarizePerpScopeExport/.test(packageEntry) || !/summarizeFeedHealth/.test(packageEntry) || !/rankRadarRows/.test(packageEntry)) {
  failures.push("Adapter package should expose snapshot, compatibility, export parsing, Watchtower, and funding history helpers.");
}

if (!/"bin"\s*:/.test(packageManifest) || !/"perpscope"\s*:/.test(packageManifest) || !/perpscope init/.test(packageCli) || !/compat report/.test(packageCli) || !/compat diff/.test(packageCli) || !/compat doctor/.test(packageCli) || !/compat badge/.test(packageCli)) {
  failures.push("Adapter package should expose the perpscope init, report, diff, doctor, and badge commands.");
}

if (packageJson.repository?.url !== "https://github.com/williamclay8/perpscope") {
  failures.push("Adapter package should expose repository metadata for npm provenance.");
}

if (!/"@perpscope\/percolator-adapter": "file:\.\.\/\.\.\/packages\/percolator-adapter"/.test(consumerPackage)) {
  failures.push("Adapter consumer example should depend on the local package by package name.");
}

if (!/from "@perpscope\/percolator-adapter"/.test(consumerDemo) || !/buildTerminalSummary/.test(consumerDemo)) {
  failures.push("Adapter consumer demo should import @perpscope/percolator-adapter and export a summary builder.");
}

if (!readme.includes("examples/adapter-consumer/") || !readme.includes("docs/feedback-loop.md")) {
  failures.push("README should link the external consumer example and feedback loop.");
}

if (!readme.includes("Embed In Your Terminal In 60 Seconds") || !readme.includes("docs/embed-integration.md") || !readme.includes("examples/copy-integration/") || !readme.includes("examples/embed-consumer/") || !readme.includes("examples/react-risk-rail/") || !readme.includes("examples/perpscope-export.sample.json") || !readme.includes("perpscope.export.v1")) {
  failures.push("README should document the v1.9 embed and export integration path.");
}

if (!readme.includes("npm install @perpscope/percolator-adapter") || !readme.includes("@perpscope/percolator-adapter@2.0.0") || !readme.includes("2-Minute Terminal Builder Check") || !readme.includes("Submit A Shape")) {
  failures.push("README should document the published adapter package.");
}

for (const required of ["CONTRIBUTING.md", "adapter-mapping-request.yml", "use-perpscope-in-terminal.yml", "cli-doctor-output.yml"]) {
  if (!readme.includes(required)) failures.push(`README should link ${required}.`);
}

if (!readme.includes("docs/field-compatibility-map.md") || !readme.includes("examples/field-compatibility-map.json") || !readme.includes("examples/compatibility-report-export.json") || !readme.includes("examples/compatibility-diff.json") || !readme.includes("examples/fixture-pack-drifted-aliases.json") || !readme.includes("examples/fixture-pack-real-sanitized-rpc-shape.json") || !readme.includes("examples/static-real-snapshot.json") || !readme.includes("examples/capture-template.json")) {
  failures.push("README should link the field compatibility map, JSON manifest, report export, diff, and fixture pack examples.");
}

for (const doc of [
  "docs/terminal-builder-quickstart.md",
  "docs/launch-post.md",
  "docs/perpscope-v2-launch-post.md",
  "docs/outreach-loop.md",
  "docs/release-v0.4.0.md",
  "docs/release-v0.5.0.md",
  "docs/release-v0.6.0.md",
  "docs/release-v0.7.0.md",
  "docs/release-v0.8.0.md",
  "docs/release-v0.9.0.md",
  "docs/release-v1.0.0.md",
  "docs/release-v1.0.1.md",
  "docs/release-v1.1.0.md",
  "docs/release-v1.2.0.md",
  "docs/release-v1.3.0.md",
  "docs/release-v1.4.0.md",
  "docs/release-v1.5.0.md",
  "docs/release-v1.6.0.md",
  "docs/release-v1.7.0.md",
  "docs/release-v1.8.0.md",
  "docs/release-v1.9.0.md",
  "docs/release-v2.0.0.md",
  "docs/adapter-targets.md",
  "docs/embed-integration.md",
  "docs/decoded-live-source.md",
  "docs/v0.5-plan.md"
]) {
  if (!readme.includes(doc)) {
    failures.push(`README should link ${doc}.`);
  }
}

if (!readme.includes(".github/ISSUE_TEMPLATE/decoded-percolator-shape.yml")) {
  failures.push("README should link the decoded shape issue template.");
}

for (const [name, template] of [
  ["decoded shape", decodedShapeIssueTemplate],
  ["adapter mapping", adapterMappingIssueTemplate],
  ["terminal integration", terminalUseIssueTemplate],
  ["CLI doctor", cliDoctorIssueTemplate]
]) {
  for (const unsafe of ["wallet", "private keys", "mnemonics", "signers", "transactions", "instructions", "order payloads", "API keys"]) {
    if (!template.includes(unsafe)) failures.push(`${name} issue template should reject ${unsafe}.`);
  }
}

for (const required of ["Submit A Sanitized Capture", "Do Not Include", "Local Checks", "What Issue #16 Needs"]) {
  if (!contributingDoc.includes(required)) failures.push(`CONTRIBUTING should include ${required}.`);
}

if (!feedbackLoopDoc.includes("issues/new?template=decoded-percolator-shape.yml")) {
  failures.push("Feedback loop should link the decoded shape issue form.");
}

for (const label of ["compatibility", "fixture", "risk-signal", "terminal-adapter", "docs"]) {
  if (!feedbackLoopDoc.includes(`\`${label}\``)) {
    failures.push(`Feedback loop should document ${label} triage label.`);
  }
}

for (const unsafe of ["wallet paths", "private keys", "mnemonics", "signatures", "transactions", "instructions", "order payloads", "API keys"]) {
  if (!feedbackLoopDoc.includes(unsafe) || !decodedShapeIssueTemplate.includes(unsafe)) {
    failures.push(`Feedback loop and issue template should reject ${unsafe}.`);
  }
}

for (const required of ["Source kind", "Trader-facing question", "Sanitized read-only payload", "Safety checklist", "Can this become a public fixture?"]) {
  if (!decodedShapeIssueTemplate.includes(required)) {
    failures.push(`Decoded shape issue template should include ${required}.`);
  }
}

for (const doc of [launchPostDoc, outreachLoopDoc, terminalQuickstartDoc]) {
  if (!doc.includes("npm install @perpscope/percolator-adapter")) {
    failures.push("Launch, outreach, and quickstart docs should include the npm install command.");
  }
  if (!doc.includes("https://github.com/williamclay8/perpscope/issues/new?template=decoded-percolator-shape.yml")) {
    failures.push("Launch, outreach, and quickstart docs should link the decoded-shape intake form.");
  }
}

for (const required of ["@perpscope/percolator-adapter@0.4.0", "npm install @perpscope/percolator-adapter", "57 node tests", "Safety Boundary"]) {
  if (!releaseV04Doc.includes(required)) {
    failures.push(`v0.4 release notes should include ${required}.`);
  }
}

for (const required of ["@perpscope/percolator-adapter@0.5.0", "exportCompatibilityReport", "examples/compatibility-report-export.json", "Safety Boundary"]) {
  if (!releaseV05Doc.includes(required)) {
    failures.push(`v0.5 release notes should include ${required}.`);
  }
}

for (const required of ["@perpscope/percolator-adapter@0.6.0", "compareCompatibilityReports", "examples/compatibility-diff.json", "alias suggestions", "Safety Boundary"]) {
  if (!releaseV06Doc.includes(required)) {
    failures.push(`v0.6 release notes should include ${required}.`);
  }
}

for (const required of ["@perpscope/percolator-adapter@0.7.0", "perpscope compat report", "perpscope compat diff", "compatibility workbench", "fixture-pack-drifted-aliases", "Safety Boundary"]) {
  if (!releaseV07Doc.includes(required)) {
    failures.push(`v0.7 release notes should include ${required}.`);
  }
}

for (const required of ["@perpscope/percolator-adapter@0.8.0", "buildCompatibilityRealityCheck", "reality check", "fixture-pack-real-sanitized-rpc-shape", "Safety Boundary"]) {
  if (!releaseV08Doc.includes(required)) {
    failures.push(`v0.8 release notes should include ${required}.`);
  }
}

for (const required of ["@perpscope/percolator-adapter@0.9.0", "buildCompatibilityDoctor", "buildCompatibilityBadge", "perpscope compat doctor", "perpscope compat badge", "examples/capture-template.json", "Safety Boundary"]) {
  if (!releaseV09Doc.includes(required)) {
    failures.push(`v0.9 release notes should include ${required}.`);
  }
}

for (const required of ["@perpscope/percolator-adapter@1.0.0", "perpscope init", "CI-ready", "2-minute terminal-builder check", "exit codes", "Safety Boundary"]) {
  if (!releaseV10Doc.includes(required)) {
    failures.push(`v1.0 release notes should include ${required}.`);
  }
}

for (const required of ["@perpscope/percolator-adapter@1.0.1", "README first-screen cleanup", "CONTRIBUTING.md", "adapter mapping request", "CLI doctor output", "Safety Boundary"]) {
  if (!releaseV101Doc.includes(required)) {
    failures.push(`v1.0.1 release notes should include ${required}.`);
  }
}

for (const required of ["@perpscope/percolator-adapter@1.1.0", "Data Source", "examples/static-real-snapshot.json", "Load Snapshot", "not a live stream", "Safety Boundary"]) {
  if (!releaseV11Doc.includes(required)) {
    failures.push(`v1.1 release notes should include ${required}.`);
  }
}

for (const required of ["Load Live", "CoinGecko simple price", "actual public prices", "simulated risk context", "not live decoded protocol state", "Safety Boundary"]) {
  if (!releaseV12Doc.includes(required)) {
    failures.push(`v1.2 release notes should include ${required}.`);
  }
}

for (const required of ["Load Decoded", "?decodedSource=", "decoded live source", "raw Solana account data", "Safety"]) {
  if (!releaseV13Doc.includes(required)) {
    failures.push(`v1.3 release notes should include ${required}.`);
  }
}

for (const required of ["@percolatorct/sdk", "getMultipleAccounts", "percolatorlaunch.com/api/markets", "?decodedSource=", "account.decoded", "source.live"]) {
  if (!decodedLiveSourceDoc.includes(required)) {
    failures.push(`Decoded live source doc should include ${required}.`);
  }
}

for (const required of ["perpscope-decoder-worker", "/perpscope.json", "/healthz", "render.yaml", "Safety"]) {
  if (!releaseV14Doc.includes(required)) {
    failures.push(`v1.4 release notes should include ${required}.`);
  }
}

for (const required of ["Load Percolator", "Trader Radar", "dataQuality", "unit-ambiguous", "Safety"]) {
  if (!releaseV15Doc.includes(required)) {
    failures.push(`v1.5 release notes should include ${required}.`);
  }
}

for (const required of ["Auto-loads", "Data Confidence", "Trader Radar filters", "?fixture=1", "Safety"]) {
  if (!releaseV16Doc.includes(required)) {
    failures.push(`v1.6 release notes should include ${required}.`);
  }
}

for (const required of ["Why Hot", "Feed Health", "?market=", "Adapter Targets", "Safety"]) {
  if (!releaseV17Doc.includes(required)) {
    failures.push(`v1.7 release notes should include ${required}.`);
  }
}

for (const required of ["perpscope.export.v1", "?embed=feed", "Export Hub", "adapter target", "Safety"]) {
  if (!releaseV18Doc.includes(required)) {
    failures.push(`v1.8 release notes should include ${required}.`);
  }
}

for (const required of ["perpscope.export.v1", "docs/embed-integration.md", "examples/perpscope-export.sample.json", "examples/embed-consumer", "?embed=market", "Safety"]) {
  if (!releaseV19Doc.includes(required)) {
    failures.push(`v1.9 release notes should include ${required}.`);
  }
}

for (const required of ["schemas/perpscope-export.schema.json", "parsePerpScopeExport", "summarizePerpScopeExport", "examples/copy-integration", "examples/embed-consumer", "@perpscope/percolator-adapter", "Safety"]) {
  if (!releaseV20Doc.includes(required)) {
    failures.push(`v2.0 release notes should include ${required}.`);
  }
}

for (const required of ["Terminal Rail", "Risk Overlay", "Execution Lane", "Feed Monitor", "?embed=market"]) {
  if (!adapterTargetsDoc.includes(required)) {
    failures.push(`Adapter target docs should include ${required}.`);
  }
}

for (const required of ["?embed=feed", "?embed=radar&filter=hot", "?embed=market&market=wif-perp", "perpscope.export.v1", "https://perpscope-decoder-worker.onrender.com/perpscope.json", "parsePerpScopeExport", "summarizePerpScopeExport", "schemas/perpscope-export.schema.json", "Fields To Trust", "Safety"]) {
  if (!embedIntegrationDoc.includes(required)) {
    failures.push(`Embed integration docs should include ${required}.`);
  }
}

if (
  perpscopeExportSample.schema !== "perpscope.export.v1" ||
  perpscopeExportSample.version !== "2.0.0" ||
  perpscopeExportSample.selection?.embed !== "market" ||
  perpscopeExportSample.safety?.wallet !== false ||
  perpscopeExportSample.safety?.signer !== false ||
  perpscopeExportSample.safety?.transaction !== false ||
  perpscopeExportSample.safety?.orderRouting !== false ||
  !perpscopeExportSample.radar?.rows?.length ||
  !perpscopeExportSample.market?.whyHot?.reasons?.length ||
  !perpscopeExportSample.feedHealth?.items?.some((item) => item.label === "unit checks") ||
  !perpscopeExportSample.adapterTargets?.targets?.length
) {
  failures.push("PerpScope export sample should expose schema, version, selection, feed health, radar, why-hot, adapter targets, and read-only safety.");
}

if (
  perpscopeExportSchema.properties?.schema?.const !== "perpscope.export.v1" ||
  perpscopeExportSchema.properties?.safety?.properties?.wallet?.const !== false ||
  !perpscopeExportSchema.required?.includes("adapterTargets") ||
  !perpscopeExportSchema.required?.includes("feedHealth")
) {
  failures.push("PerpScope export schema should lock schema, safety, feed health, and adapter targets.");
}

for (const required of ["perpscope-export.sample.json", "summarizePerpScopeExport"]) {
  if (!embedConsumerDemo.includes(required)) {
    failures.push(`Embed consumer demo should include ${required}.`);
  }
}

for (const required of ["?embed=radar", "?embed=market", "perpscope.export.v1", "../perpscope-export.sample.json", "summarizePerpScopeExport", "schema locked"]) {
  if (!embedConsumerHtml.includes(required)) {
    failures.push(`Embed consumer HTML should include ${required}.`);
  }
}

for (const required of ["?embed=feed", "?embed=radar&filter=hot", "?embed=market&market=wif-perp", "perpscope.export.v1", "summarizePerpScopeExport", "read-only"]) {
  if (!embedConsumerReadme.includes(required)) {
    failures.push(`Embed consumer README should include ${required}.`);
  }
}

for (const required of ["Copy PerpScope Into A Terminal", "?embed=radar", "summarizePerpScopeExport", "perpscope-export.schema.json", "perpscope-export.sample.json", "../embed-consumer/"]) {
  if (!copyIntegrationHtml.includes(required)) {
    failures.push(`Copy integration page should include ${required}.`);
  }
}

for (const required of ["?embed=radar", "@perpscope/percolator-adapter", "perpscope.export.v1", "http://127.0.0.1:4173/examples/copy-integration/"]) {
  if (!copyIntegrationReadme.includes(required)) {
    failures.push(`Copy integration README should include ${required}.`);
  }
}

for (const required of ["summarizePerpScopeExport", "@perpscope/percolator-adapter", "perpscope-export.sample.json", "read-only"]) {
  if (!reactRiskRailReadme.includes(required) || !reactRiskRailApp.includes(required)) {
    failures.push(`React risk rail example should include ${required}.`);
  }
}

if (!/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*360px/.test(reactRiskRailCss) || !/border-radius:\s*8px/.test(reactRiskRailCss)) {
  failures.push("React risk rail CSS should keep a stable terminal rail layout.");
}

for (const required of ["@perpscope/percolator-adapter@2.0.0", "summarizePerpScopeExport", "examples/copy-integration", "examples/embed-consumer", "schemas/perpscope-export.schema.json", "no wallet connection"]) {
  if (!v2LaunchPostDoc.includes(required)) {
    failures.push(`v2 launch post should include ${required}.`);
  }
}

if (!npmPublishWorkflow.includes("Expected 2.0.0") || !npmPublishWorkflow.includes("npm publish --access public --provenance")) {
  failures.push("npm publish workflow should be configured for adapter v2.0.0 trusted publishing.");
}

for (const required of ["compatibility report", "Export", "wallet", "transaction", "npm run check", "0.5.0"]) {
  if (!v05PlanDoc.toLowerCase().includes(required.toLowerCase())) {
    failures.push(`v0.5 plan should mention ${required}.`);
  }
}

for (const required of [
  "market.slab",
  "market.program",
  "price.mark",
  "Watchtower",
  "fundingBpsPerHour",
  "walletPath",
  "privateKey",
  "transaction"
]) {
  if (!fieldMapDoc.includes(required)) {
    failures.push(`Field compatibility map should document ${required}.`);
  }
}

if (fieldMapJson.version !== "2.0.0") {
  failures.push("Field compatibility JSON should match package version 2.0.0.");
}

if (
  compatibilityReportExport.schema !== "perpscope.compatibility-report" ||
  compatibilityReportExport.package?.version !== "2.0.0" ||
  compatibilityReportExport.safety?.mode !== "read-only" ||
  !compatibilityReportExport.source?.commandSet?.length ||
  !compatibilityReportExport.missingFields?.some((field) => field.field === "history.fundingSkew") ||
  !Array.isArray(compatibilityReportExport.aliasSuggestions)
) {
  failures.push("Compatibility report export example should include schema, version, safety, source, and missing fields.");
}

if (
  compatibilityDiff.schema !== "perpscope.compatibility-diff" ||
  compatibilityDiff.package?.version !== "2.0.0" ||
  !compatibilityDiff.aliasSuggestions?.some((suggestion) => suggestion.candidatePath === "oraclePriceUsd") ||
  compatibilityDiff.summary?.suggestionCount < 1
) {
  failures.push("Compatibility diff example should include schema, version, alias suggestions, and summary counts.");
}

for (const [name, fixture] of [
  ["minimal terminal", minimalFixturePack],
  ["drifted aliases", driftedFixturePack],
  ["receipt-heavy execution", receiptHeavyFixturePack],
  ["real-backed sanitized RPC shape", realSanitizedFixturePack],
  ["capture template", captureTemplate],
  ["decoded live source sample", decodedLiveSourceSample]
]) {
  try {
    const report = buildPercolatorCompatibilityReport(fixture);
    if (!["compatible", "partial"].includes(report.status)) {
      failures.push(`Fixture pack should map into a usable report: ${name}`);
    }
  } catch (error) {
    failures.push(`Fixture pack should normalize: ${name} (${error.message})`);
  }
}

if (!buildPercolatorCompatibilityReport(driftedFixturePack).aliasSuggestions.some((suggestion) => suggestion.candidatePath === "oraclePriceUsd")) {
  failures.push("Drifted fixture pack should produce alias suggestions.");
}

for (const field of ["market.slab", "market.program", "price.mark"]) {
  if (!fieldMapJson.requiredFields?.some((entry) => entry.field === field && entry.severity === "danger")) {
    failures.push(`Field compatibility JSON should require ${field}.`);
  }
}

for (const signal of ["runway", "freshness", "execution", "impact", "carry", "solvency"]) {
  if (!fieldMapJson.watchtowerSignals?.some((entry) => entry.id === signal)) {
    failures.push(`Field compatibility JSON should include Watchtower signal ${signal}.`);
  }
}

for (const fixture of fieldMapJson.safeFixtures || []) {
  if (!existsSync(new URL(`../${fixture}`, import.meta.url))) {
    failures.push(`Field compatibility safe fixture is missing: ${fixture}`);
  }
}

for (const match of readme.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
  if (!match[1].trim()) {
    failures.push("README images should use non-empty alt text.");
  }
  if (!existsSync(new URL(`../${match[2]}`, import.meta.url))) {
    failures.push(`README image is missing: ${match[2]}`);
  }
}

for (const filename of readdirSync(schemaDir).filter((name) => name.endsWith(".json"))) {
  try {
    JSON.parse(readFileSync(new URL(filename, schemaDir), "utf8"));
  } catch (error) {
    failures.push(`Schema JSON should parse: ${filename} (${error.message})`);
  }
}

for (const filename of readdirSync(exampleDir).filter((name) => name.endsWith(".json"))) {
  try {
    JSON.parse(readFileSync(new URL(filename, exampleDir), "utf8"));
  } catch (error) {
    failures.push(`Example JSON should parse: ${filename} (${error.message})`);
  }
}

for (const filename of [
  "percolator-mainnet-sol.readonly-rpc.json",
  "percolator-devnet-wif.readonly-rpc.json"
]) {
  try {
    summarizeReadOnlyRpcDeployment(JSON.parse(readFileSync(new URL(filename, exampleDir), "utf8")));
  } catch (error) {
    failures.push(`Read-only deployment example should validate: ${filename} (${error.message})`);
  }
}

try {
  const recipeManifest = JSON.parse(readFileSync(new URL("terminal-recipes.json", exampleDir), "utf8"));
  const recipeIds = new Set((recipeManifest.recipes || []).map((recipe) => recipe.id));
  for (const expected of ["file-import", "drag-drop-stdout", "command-bundle", "list-markets", "read-only-rpc", "carry-history", "dto-export", "capture-intake"]) {
    if (!recipeIds.has(expected)) failures.push(`Terminal recipes should include ${expected}.`);
  }
  for (const recipe of recipeManifest.recipes || []) {
    if (recipe.fixture && !existsSync(new URL(`../${recipe.fixture}`, import.meta.url))) {
      failures.push(`Terminal recipe fixture is missing: ${recipe.fixture}`);
    }
  }
} catch (error) {
  failures.push(`Terminal recipe manifest should parse and validate (${error.message})`);
}

try {
  const history = normalizeFundingSkewHistory(JSON.parse(readFileSync(new URL("funding-skew-history.stdout.json", exampleDir), "utf8")));
  if (history.length < 4) failures.push("Funding/skew history example should expose at least four rows.");
} catch (error) {
  failures.push(`Funding/skew history example should validate (${error.message})`);
}

for (const schema of [
  "schemas/perpscope-snapshot.schema.json",
  "schemas/percolator-cli-bundle.schema.json",
  "schemas/read-only-rpc-fetch.schema.json",
  "schemas/funding-skew-history.schema.json",
  "schemas/perpscope-export.schema.json"
]) {
  if (!readme.includes(schema)) {
    failures.push(`README should link ${schema}.`);
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`check-static: ${failure}`);
  process.exit(1);
}

console.log("check-static: passed");
