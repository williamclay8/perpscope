import { existsSync, readdirSync, readFileSync } from "node:fs";
import { normalizePercolatorSnapshot } from "../src/lib/percolator-adapter.js";
import { normalizeFundingSkewHistory } from "../src/lib/funding-history.js";
import { summarizeReadOnlyRpcDeployment } from "../src/lib/read-only-rpc-fetcher.js";
import { percolatorFixture } from "../src/fixtures/percolator-market.js";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
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

if (!/normalizePercolatorSnapshot/.test(packageEntry) || !/buildWatchtowerSignals/.test(packageEntry) || !/normalizeFundingSkewHistory/.test(packageEntry)) {
  failures.push("Adapter package should expose snapshot, Watchtower, and funding history helpers.");
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
  for (const expected of ["file-import", "drag-drop-stdout", "command-bundle", "list-markets", "read-only-rpc", "carry-history", "dto-export"]) {
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
