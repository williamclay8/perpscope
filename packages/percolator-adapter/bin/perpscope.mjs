#!/usr/bin/env node
import { readFileSync } from "node:fs";
import {
  buildPercolatorCompatibilityReport,
  compareCompatibilityReports,
  exportCompatibilityReport,
  normalizePercolatorSnapshot,
  parsePercolatorJson
} from "../index.js";

const [, , ...args] = process.argv;

function usage() {
  return [
    "Usage:",
    "  perpscope compat report <capture.json>",
    "  perpscope compat diff <previous.json> <current.json>",
    "",
    "Read-only only: the adapter rejects wallet, signer, transaction, instruction, order, private key, seed, mnemonic, and API key fields."
  ].join("\n");
}

function readCapture(path) {
  if (!path) throw new Error("Missing capture path.");
  return parsePercolatorJson(readFileSync(path, "utf8"));
}

function buildReport(input) {
  const snapshot = normalizePercolatorSnapshot(input);
  return buildPercolatorCompatibilityReport(input, snapshot);
}

function main() {
  const [scope, command, ...rest] = args;
  if (!scope || scope === "--help" || scope === "-h") {
    console.log(usage());
    return;
  }
  if (scope !== "compat") throw new Error(`Unknown scope: ${scope}`);
  if (command === "report") {
    const input = readCapture(rest[0]);
    console.log(JSON.stringify(exportCompatibilityReport(input), null, 2));
    return;
  }
  if (command === "diff") {
    const previous = buildReport(readCapture(rest[0]));
    const current = buildReport(readCapture(rest[1]));
    console.log(JSON.stringify(compareCompatibilityReports(previous, current), null, 2));
    return;
  }
  throw new Error(`Unknown compat command: ${command || ""}`.trim());
}

try {
  main();
} catch (error) {
  console.error(error.message);
  console.error("");
  console.error(usage());
  process.exitCode = 1;
}
