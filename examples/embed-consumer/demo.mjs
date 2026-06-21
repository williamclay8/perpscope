import { readFileSync } from "node:fs";
import { summarizePerpScopeExport } from "../../packages/percolator-adapter/index.js";

export function buildPerpScopeEmbedSummary(exportPayload) {
  return summarizePerpScopeExport(exportPayload);
}

const sample = JSON.parse(readFileSync(new URL("../perpscope-export.sample.json", import.meta.url), "utf8"));
console.log(JSON.stringify(buildPerpScopeEmbedSummary(sample), null, 2));
