#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
const CAPTURE_TEMPLATE = {
  label: "My terminal read-only capture",
  cluster: "mainnet-beta",
  market: {
    symbol: "SOL-PERP",
    base: "SOL",
    quote: "USDC",
    slab: "PERCOLAT_SOL_...",
    program: "Perco1ator111111111111111111111111111111111"
  },
  oracle: {
    priceUsd: 181.61,
    ageSecs: 2
  },
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
  execution: {
    bestBid: 181.52,
    bestAsk: 181.71,
    receipts: [
      {
        label: "latest fill",
        sourceTimestamp: "2026-06-20T13:24:12Z",
        spreadBps: 10.5,
        impactBps: 8.4,
        markout1mBps: 4.2,
        markout5mBps: -1.7,
        routeLatencyMs: 132,
        priorityFeeMicrolamports: 2200
      }
    ]
  },
  account: {
    side: "long",
    positionSize: 420,
    positionNotionalUsd: 76276.2,
    collateralUsd: 8400,
    unrealizedPnlUsd: 3067.2,
    liquidationPrice: 162.94
  },
  history: {
    fundingSkew: [
      {
        sourceTimestamp: "2026-06-20T13:24:00Z",
        slot: 346892086,
        fundingBpsPerHour: 0.82,
        longOpenInterestUsd: 1320000,
        shortOpenInterestUsd: 1110000,
        stressConsumedBps: 118,
        stressLimitBps: 500,
        oracleAgeSec: 2.1
      }
    ]
  }
};

function usage() {
  return [
    "Usage:",
    "  perpscope init [output.json] [--force]",
    "  perpscope compat report <capture.json>",
    "  perpscope compat diff <previous.json> <current.json>",
    "  perpscope compat doctor <capture.json> [--strict|--json]",
    "  perpscope compat badge <capture.json> [--json|--markdown]",
    "",
    "Read-only only: the adapter rejects wallet, signer, transaction, instruction, order, private key, seed, mnemonic, and API key fields."
  ].join("\n");
}

function initMessage(path) {
  return [
    `Created ${path}`,
    "",
    "Next:",
    `  perpscope compat doctor ${path}`,
    `  perpscope compat badge ${path}`,
    "",
    "Edit the capture with sanitized read-only decoded state before sharing it."
  ].join("\n");
}

function initCapture(path = "perpscope.capture.json", options = {}) {
  if (existsSync(path) && !options.force) {
    throw new Error(`${path} already exists. Use --force to overwrite.`);
  }
  writeFileSync(path, `${JSON.stringify(CAPTURE_TEMPLATE, null, 2)}\n`);
  return path;
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

function doctorExitCode(doctor, options = {}) {
  if (doctor.status === "rejected" || doctor.required.mapped < doctor.required.total) return 1;
  if (options.strict && (
    doctor.useful.mapped < doctor.useful.total ||
    doctor.unknownFields.length ||
    doctor.aliasSuggestions.length
  )) return 2;
  return 0;
}

function main() {
  const [scope, command, ...rest] = args;
  if (!scope || scope === "--help" || scope === "-h") {
    console.log(usage());
    return;
  }
  if (scope === "init") {
    const output = command && !command.startsWith("--") ? command : "perpscope.capture.json";
    const flags = [command, ...rest].filter(Boolean);
    console.log(initMessage(initCapture(output, { force: flags.includes("--force") })));
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
    const doctor = buildCompatibilityDoctor(buildReport(input), { input });
    console.log(rest.includes("--json") ? JSON.stringify(doctor, null, 2) : formatDoctor(doctor));
    process.exitCode = doctorExitCode(doctor, { strict: rest.includes("--strict") });
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
