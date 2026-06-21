import { existsSync, readdirSync, readFileSync } from "node:fs";
import {
  buildPercolatorCompatibilityReport,
  exportCompatibilityReport,
  normalizePercolatorSnapshot
} from "../src/lib/percolator-adapter.js";
import { normalizeFundingSkewHistory } from "../src/lib/funding-history.js";
import { summarizeReadOnlyRpcDeployment } from "../src/lib/read-only-rpc-fetcher.js";
import { percolatorFixture } from "../src/fixtures/percolator-market.js";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const feedbackLoopDoc = readFileSync(new URL("../docs/feedback-loop.md", import.meta.url), "utf8");
const fieldMapDoc = readFileSync(new URL("../docs/field-compatibility-map.md", import.meta.url), "utf8");
const launchPostDoc = readFileSync(new URL("../docs/launch-post.md", import.meta.url), "utf8");
const outreachLoopDoc = readFileSync(new URL("../docs/outreach-loop.md", import.meta.url), "utf8");
const releaseV04Doc = readFileSync(new URL("../docs/release-v0.4.0.md", import.meta.url), "utf8");
const releaseV05Doc = readFileSync(new URL("../docs/release-v0.5.0.md", import.meta.url), "utf8");
const terminalQuickstartDoc = readFileSync(new URL("../docs/terminal-builder-quickstart.md", import.meta.url), "utf8");
const v05PlanDoc = readFileSync(new URL("../docs/v0.5-plan.md", import.meta.url), "utf8");
const fieldMapJson = JSON.parse(readFileSync(new URL("../examples/field-compatibility-map.json", import.meta.url), "utf8"));
const compatibilityReportExport = JSON.parse(readFileSync(new URL("../examples/compatibility-report-export.json", import.meta.url), "utf8"));
const decodedShapeIssueTemplate = readFileSync(new URL("../.github/ISSUE_TEMPLATE/decoded-percolator-shape.yml", import.meta.url), "utf8");
const schemaDir = new URL("../schemas/", import.meta.url);
const exampleDir = new URL("../examples/", import.meta.url);
const packageEntry = readFileSync(new URL("../packages/percolator-adapter/index.js", import.meta.url), "utf8");
const consumerPackage = readFileSync(new URL("../examples/adapter-consumer/package.json", import.meta.url), "utf8");
const consumerDemo = readFileSync(new URL("../examples/adapter-consumer/demo.mjs", import.meta.url), "utf8");

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
if (exportedCompatibility.schema !== "perpscope.compatibility-report" || exportedCompatibility.package.version !== "0.5.0") {
  failures.push("Exported compatibility report should include the stable schema and package version.");
}

if (!/normalizePercolatorSnapshot/.test(packageEntry) || !/buildWatchtowerSignals/.test(packageEntry) || !/normalizeFundingSkewHistory/.test(packageEntry) || !/buildPercolatorCompatibilityReport/.test(packageEntry) || !/exportCompatibilityReport/.test(packageEntry)) {
  failures.push("Adapter package should expose snapshot, compatibility export, Watchtower, and funding history helpers.");
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

if (!readme.includes("npm install @perpscope/percolator-adapter") || !readme.includes("@perpscope/percolator-adapter@0.5.0")) {
  failures.push("README should document the published adapter package.");
}

if (!readme.includes("docs/field-compatibility-map.md") || !readme.includes("examples/field-compatibility-map.json") || !readme.includes("examples/compatibility-report-export.json")) {
  failures.push("README should link the field compatibility map, JSON manifest, and report export example.");
}

for (const doc of [
  "docs/terminal-builder-quickstart.md",
  "docs/launch-post.md",
  "docs/outreach-loop.md",
  "docs/release-v0.4.0.md",
  "docs/release-v0.5.0.md",
  "docs/v0.5-plan.md"
]) {
  if (!readme.includes(doc)) {
    failures.push(`README should link ${doc}.`);
  }
}

if (!readme.includes(".github/ISSUE_TEMPLATE/decoded-percolator-shape.yml")) {
  failures.push("README should link the decoded shape issue template.");
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

if (fieldMapJson.version !== "0.5.0") {
  failures.push("Field compatibility JSON should match package version 0.5.0.");
}

if (
  compatibilityReportExport.schema !== "perpscope.compatibility-report" ||
  compatibilityReportExport.package?.version !== "0.5.0" ||
  compatibilityReportExport.safety?.mode !== "read-only" ||
  !compatibilityReportExport.source?.commandSet?.length ||
  !compatibilityReportExport.missingFields?.some((field) => field.field === "history.fundingSkew")
) {
  failures.push("Compatibility report export example should include schema, version, safety, source, and missing fields.");
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
  "schemas/funding-skew-history.schema.json"
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
