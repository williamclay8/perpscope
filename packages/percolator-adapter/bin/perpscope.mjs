#!/usr/bin/env node
import { readFileSync } from "node:fs";
import {
  buildCompatibilityBadge,
  buildCompatibilityDoctor,
  buildReadOnlyRpcSnapshot,
  buildPercolatorCompatibilityReport,
  compareCompatibilityReports,
  detectPercolatorInputShape,
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
    "  perpscope compat doctor <capture.json>",
    "  perpscope compat badge <capture.json> [--json|--markdown]",
    "",
    "Read-only only: the adapter rejects wallet, signer, transaction, instruction, order, private key, seed, mnemonic, and API key fields."
  ].join("\n");
}

function readCapture(path) {
  if (!path) throw new Error("Missing capture path.");
  return parsePercolatorJson(readFileSync(path, "utf8"));
}

function buildReport(input) {
  const snapshot = detectPercolatorInputShape(input) === "read-only-rpc-fetch"
    ? buildReadOnlyRpcSnapshot(input)
    : normalizePercolatorSnapshot(input);
  return buildPercolatorCompatibilityReport(input, snapshot);
}

function formatDoctor(doctor) {
  const lines = [
    `PerpScope compat doctor: ${doctor.pass ? "PASS" : "CHECK"}`,
    `shape: ${doctor.shape}`,
    `status: ${doctor.status} (${doctor.score}/100)`,
    `safety: ${doctor.safety}`,
    `required: ${doctor.required.label}`,
    `useful: ${doctor.useful.label}`,
    `unknown fields: ${doctor.unknownFields.length}`,
    `alias suggestions: ${doctor.aliasSuggestions.length}`
  ];
  if (doctor.nextActions.length) {
    lines.push("next actions:");
    for (const action of doctor.nextActions) lines.push(`- ${action}`);
  }
  return lines.join("\n");
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
  if (command === "doctor") {
    const input = readCapture(rest[0]);
    console.log(formatDoctor(buildCompatibilityDoctor(buildReport(input), { input })));
    return;
  }
  if (command === "badge") {
    const input = readCapture(rest[0]);
    const badge = buildCompatibilityBadge(buildReport(input), { input });
    console.log(rest.includes("--json") ? JSON.stringify(badge, null, 2) : badge.markdown);
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
