import { existsSync, readFileSync } from "node:fs";
import { normalizePercolatorSnapshot } from "../src/lib/percolator-adapter.js";
import { percolatorFixture } from "../src/fixtures/percolator-market.js";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

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

const dto = normalizePercolatorSnapshot(percolatorFixture);
if (dto.markets.length < 3) {
  failures.push("Fixture should expose at least three markets for the cockpit.");
}

if (!dto.markets.some((market) => market.status === "risk")) {
  failures.push("Fixture should include a risk state for visual QA.");
}

for (const match of readme.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
  if (!existsSync(new URL(`../${match[1]}`, import.meta.url))) {
    failures.push(`README image is missing: ${match[1]}`);
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`check-static: ${failure}`);
  process.exit(1);
}

console.log("check-static: passed");
