import { normalizeFundingSkewHistory } from "./funding-history.js";

export const PERPSCOPE_ADAPTER_VERSION = "1.1.0";

const KEYPAIR_FIELD_PATTERN = /(^|_)(secret|private|keypair|mnemonic|seed|walletPath|wallet)(_|$)/i;
const HISTORY_COMMAND_KEYS = new Set([
  "fundinghistory",
  "fundingskewhistory",
  "fundingrates",
  "skewhistory",
  "marketcarryhistory"
]);

export function assertReadOnlySnapshot(value, path = "snapshot") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const nextPath = `${path}.${key}`;
    if (KEYPAIR_FIELD_PATTERN.test(key) || /secret|private|keypair|mnemonic|seed|walletpath|wallet/.test(normalizeKey(key))) {
      throw new Error(`Refusing secret-bearing field in read-only snapshot: ${nextPath}`);
    }
    if (child && typeof child === "object") {
      assertReadOnlySnapshot(child, nextPath);
    }
  }
}

export function detectPercolatorInputShape(input) {
  if (!input || typeof input !== "object") return "unknown";
  if (Array.isArray(input)) return isFundingHistoryArray(input) ? "funding-skew-history" : "percolator-market-array";
  if (isReadOnlyRpcInput(input)) return "read-only-rpc-fetch";
  if (isFundingHistoryInput(input)) return "funding-skew-history";
  if (Array.isArray(input.commands) || input.command || hasCliSections(input)) return "percolator-cli-bundle";
  if (Array.isArray(input.markets)) return "perpscope-snapshot";
  return "unknown";
}

export function normalizePercolatorCliBundle(bundle) {
  assertReadOnlySnapshot(bundle);
  return coercePercolatorCliBundle(bundle);
}

export function parsePercolatorJson(text) {
  const source = String(text).trim();
  try {
    return JSON.parse(source);
  } catch {
    const extracted = extractJsonPayload(source);
    if (!extracted) throw new Error("No JSON payload found.");
    return JSON.parse(extracted);
  }
}

export function normalizePercolatorSnapshot(input) {
  assertReadOnlySnapshot(input);
  const snapshot = coercePercolatorSnapshot(input);
  const markets = (snapshot.markets || []).map((market) =>
    toTerminalMarketDto(market, snapshot.currentSlot)
  );
  const aggregateHealth = average(markets.map((market) => market.healthScore));
  return {
    source: snapshot.source,
    cluster: snapshot.cluster || "unknown",
    currentSlot: snapshot.currentSlot || 0,
    aggregateHealth,
    aggregateStatus: labelFromScore(aggregateHealth),
    markets
  };
}

export function buildPercolatorCompatibilityReport(input, normalizedSnapshot) {
  assertReadOnlySnapshot(input);
  assertReadOnlyCompatibilityCapture(input);
  const shape = detectPercolatorInputShape(input);
  const scope = compatibilityScope(input);
  assertReadOnlyCompatibilityCapture(scope, "capture.normalized");
  const snapshot = normalizedSnapshot || normalizePercolatorSnapshot(input);
  const context = {
    input,
    scope,
    shape,
    snapshot,
    market: compatibilityMarket(firstItem(snapshot.markets), input)
  };
  const recognizedSections = COMPATIBILITY_SECTION_SPECS
    .filter((section) => section.present(context))
    .map((section) => ({
      id: section.id,
      label: section.label,
      tone: section.tone ? section.tone(context) : "good",
      detail: section.detail(context)
    }));
  const missingFields = COMPATIBILITY_FIELD_SPECS
    .filter((field) => !field.present(context))
    .map((field) => ({
      field: field.field,
      label: field.label,
      severity: field.severity,
      detail: field.detail
    }));
  const ignoredFields = ignoredCompatibilityFields(input);
  const aliasSuggestions = buildCompatibilityAliasSuggestions(missingFields, ignoredFields);
  const dangerCount = missingFields.filter((field) => field.severity === "danger").length;
  const warningCount = missingFields.length - dangerCount;
  const recognizedDataCount = recognizedSections.filter((section) => section.id !== "safety").length;
  const unknownStatus = shape === "unknown" && recognizedDataCount === 0;
  const unknownPenalty = unknownStatus ? 22 : shape === "unknown" ? 10 : 0;
  const score = clamp(100 - dangerCount * 18 - warningCount * 8 - ignoredFields.length * 3 - unknownPenalty, 0, 100);
  const tone = unknownStatus || dangerCount ? "danger" : warningCount || ignoredFields.length ? "warning" : "good";
  const status = unknownStatus ? "unknown" : dangerCount || warningCount || ignoredFields.length ? "partial" : "compatible";
  const compatible = status === "compatible";
  const source = snapshot.source || {};
  const commandSet = Array.isArray(source.commandSet) ? source.commandSet : commandNames(input);

  return {
    shape,
    status,
    compatible,
    tone,
    score,
    recognizedSections,
    missingFields,
    ignoredFields,
    aliasSuggestions,
    source: {
      label: source.label || stringOf(scope, ["label", "sourceLabel"], "decoded capture"),
      mode: source.mode || "read-only",
      commandSet,
      cluster: snapshot.cluster || "unknown",
      currentSlot: snapshot.currentSlot || 0,
      marketCount: snapshot.markets.length,
      slab: context.market.slab || "",
      program: context.market.program || ""
    },
    summary: {
      recognizedCount: recognizedSections.length,
      missingCount: missingFields.length,
      ignoredCount: ignoredFields.length,
      suggestionCount: aliasSuggestions.length,
      marketCount: snapshot.markets.length,
      commandCount: commandSet.length
    }
  };
}

export function compareCompatibilityReports(previousReport, currentReport, options = {}) {
  const previous = normalizeCompatibilityReport(previousReport);
  const current = normalizeCompatibilityReport(currentReport);
  const resolvedMissing = differenceByField(previous.missingFields, current.missingFields);
  const newMissing = differenceByField(current.missingFields, previous.missingFields);
  const resolvedIgnored = differenceByPath(previous.ignoredFields, current.ignoredFields);
  const newIgnored = differenceByPath(current.ignoredFields, previous.ignoredFields);
  const addedSections = differenceById(current.recognizedSections, previous.recognizedSections);
  const removedSections = differenceById(previous.recognizedSections, current.recognizedSections);
  const scoreDelta = Number(current.score || 0) - Number(previous.score || 0);
  const statusChanged = previous.status !== current.status;
  const suggestionSet = mergeAliasSuggestions(
    current.aliasSuggestions || buildCompatibilityAliasSuggestions(current.missingFields, current.ignoredFields),
    buildCompatibilityAliasSuggestions(newMissing, newIgnored)
  );
  const tone = current.status === "rejected" || newMissing.some((field) => field.severity === "danger")
    ? "danger"
    : scoreDelta < 0 || newMissing.length || newIgnored.length || removedSections.length
      ? "warning"
      : "good";

  return {
    schema: "perpscope.compatibility-diff",
    version: 1,
    package: {
      name: "@perpscope/percolator-adapter",
      version: options.packageVersion || PERPSCOPE_ADAPTER_VERSION
    },
    generatedAt: options.generatedAt || new Date().toISOString(),
    tone,
    scoreDelta,
    statusChanged,
    previous: compatibilityDiffSummary(previous),
    current: compatibilityDiffSummary(current),
    resolvedMissing,
    newMissing,
    resolvedIgnored,
    newIgnored,
    addedSections,
    removedSections,
    aliasSuggestions: suggestionSet,
    summary: {
      resolvedMissingCount: resolvedMissing.length,
      newMissingCount: newMissing.length,
      resolvedIgnoredCount: resolvedIgnored.length,
      newIgnoredCount: newIgnored.length,
      addedSectionCount: addedSections.length,
      removedSectionCount: removedSections.length,
      suggestionCount: suggestionSet.length
    }
  };
}

export function exportCompatibilityReport(input, normalizedSnapshot, options = {}) {
  const snapshot = normalizedSnapshot || normalizePercolatorSnapshot(input);
  const report = buildPercolatorCompatibilityReport(input, snapshot);
  return exportCompatibilityReportFromReport(report, options);
}

export function exportCompatibilityReportFromReport(report, options = {}) {
  return {
    schema: "perpscope.compatibility-report",
    version: 1,
    package: {
      name: "@perpscope/percolator-adapter",
      version: options.packageVersion || PERPSCOPE_ADAPTER_VERSION
    },
    generatedAt: options.generatedAt || new Date().toISOString(),
    safety: {
      mode: "read-only",
      rejected: report.status === "rejected"
    },
    shape: report.shape,
    status: report.status,
    compatible: report.compatible,
    tone: report.tone,
    score: report.score,
    recognizedSections: report.recognizedSections,
    missingFields: report.missingFields,
    ignoredFields: report.ignoredFields,
    aliasSuggestions: report.aliasSuggestions || buildCompatibilityAliasSuggestions(report.missingFields, report.ignoredFields),
    source: report.source,
    summary: {
      ...report.summary,
      suggestionCount: report.summary?.suggestionCount ?? (report.aliasSuggestions || []).length
    }
  };
}

export function buildCompatibilityRealityCheck(inputOrReport, options = {}) {
  const hasReportShape = inputOrReport && typeof inputOrReport === "object" && Array.isArray(inputOrReport.recognizedSections);
  const input = hasReportShape ? options.input : inputOrReport;
  const report = hasReportShape ? normalizeCompatibilityReport(inputOrReport) : buildPercolatorCompatibilityReport(inputOrReport);
  const requiredFields = COMPATIBILITY_FIELD_SPECS.filter((field) => field.severity === "danger");
  const optionalFields = COMPATIBILITY_FIELD_SPECS.filter((field) => field.severity !== "danger");
  const missingFieldSet = new Set((report.missingFields || []).map((field) => field.field));
  const mappedRequired = requiredFields.filter((field) => !missingFieldSet.has(field.field));
  const mappedOptional = optionalFields.filter((field) => !missingFieldSet.has(field.field));
  const provenance = realityProvenance(input, report);
  const unknownCount = report.summary?.ignoredCount ?? report.ignoredFields.length;
  const aliasCount = report.summary?.suggestionCount ?? report.aliasSuggestions.length;
  const dangerMissing = (report.missingFields || []).filter((field) => field.severity === "danger").length;
  const warningMissing = (report.missingFields || []).length - dangerMissing;
  const tone = dangerMissing
    ? "danger"
    : warningMissing || unknownCount || provenance.status === "candidate"
      ? "warning"
      : "good";

  return {
    schema: "perpscope.reality-check",
    version: 1,
    package: {
      name: "@perpscope/percolator-adapter",
      version: options.packageVersion || PERPSCOPE_ADAPTER_VERSION
    },
    generatedAt: options.generatedAt || new Date().toISOString(),
    tone,
    status: provenance.status,
    sourceKind: provenance.kind,
    provenance,
    mapped: {
      requiredCount: mappedRequired.length,
      requiredTotal: requiredFields.length,
      optionalCount: mappedOptional.length,
      optionalTotal: optionalFields.length,
      recognizedCount: report.summary?.recognizedCount ?? report.recognizedSections.length
    },
    gaps: {
      dangerMissing,
      warningMissing,
      unknownCount,
      aliasCount
    },
    lanes: [
      realityLane("required", `${mappedRequired.length}/${requiredFields.length}`, dangerMissing ? "danger" : "good"),
      realityLane("useful", `${mappedOptional.length}/${optionalFields.length}`, warningMissing ? "warning" : "good"),
      realityLane("unknown", String(unknownCount), unknownCount ? "warning" : "good"),
      realityLane("aliases", String(aliasCount), aliasCount ? "good" : "neutral")
    ]
  };
}

export function buildCompatibilityDoctor(inputOrReport, options = {}) {
  const hasReportShape = inputOrReport && typeof inputOrReport === "object" && Array.isArray(inputOrReport.recognizedSections);
  const report = hasReportShape ? normalizeCompatibilityReport(inputOrReport) : buildPercolatorCompatibilityReport(inputOrReport);
  const reality = buildCompatibilityRealityCheck(report, {
    input: hasReportShape ? options.input : inputOrReport,
    generatedAt: options.generatedAt,
    packageVersion: options.packageVersion
  });
  const requiredLane = reality.lanes.find((lane) => lane.label === "required") || {};
  const usefulLane = reality.lanes.find((lane) => lane.label === "useful") || {};
  const pass = report.status === "compatible" || (reality.gaps.dangerMissing === 0 && report.status === "partial");
  const safety = report.status === "rejected" ? "rejected" : "read-only";

  return {
    schema: "perpscope.compatibility-doctor",
    version: 1,
    package: {
      name: "@perpscope/percolator-adapter",
      version: options.packageVersion || PERPSCOPE_ADAPTER_VERSION
    },
    generatedAt: options.generatedAt || new Date().toISOString(),
    pass,
    tone: report.status === "rejected" || reality.gaps.dangerMissing ? "danger" : report.summary.ignoredCount || report.summary.suggestionCount ? "warning" : "good",
    status: report.status,
    shape: report.shape,
    score: report.score,
    safety,
    source: report.source,
    required: {
      mapped: reality.mapped.requiredCount,
      total: reality.mapped.requiredTotal,
      label: requiredLane.value || `${reality.mapped.requiredCount}/${reality.mapped.requiredTotal}`
    },
    useful: {
      mapped: reality.mapped.optionalCount,
      total: reality.mapped.optionalTotal,
      label: usefulLane.value || `${reality.mapped.optionalCount}/${reality.mapped.optionalTotal}`
    },
    unknownFields: report.ignoredFields || [],
    aliasSuggestions: report.aliasSuggestions || [],
    missingFields: report.missingFields || [],
    nextActions: compatibilityDoctorActions(report, reality)
  };
}

export function buildCompatibilityBadge(inputOrReport, options = {}) {
  const doctor = inputOrReport?.schema === "perpscope.compatibility-doctor"
    ? inputOrReport
    : buildCompatibilityDoctor(inputOrReport, options);
  const label = options.label || "PerpScope compatible";
  const summary = `${doctor.status}, ${doctor.score}/100, ${doctor.aliasSuggestions.length} alias suggestions`;
  return {
    schema: "perpscope.compatibility-badge",
    version: 1,
    package: doctor.package,
    generatedAt: options.generatedAt || doctor.generatedAt || new Date().toISOString(),
    label,
    status: doctor.status,
    score: doctor.score,
    tone: doctor.tone,
    aliasSuggestionCount: doctor.aliasSuggestions.length,
    unknownFieldCount: doctor.unknownFields.length,
    required: doctor.required,
    useful: doctor.useful,
    markdown: `**${label}:** ${summary}`,
    text: `${label}: ${summary}`
  };
}

const COMPATIBILITY_SECTION_SPECS = [
  {
    id: "safety",
    label: "read-only safety",
    present: () => true,
    detail: () => "no secret-like fields found"
  },
  {
    id: "market",
    label: "market identity",
    present: ({ scope, snapshot }) =>
      marketListOf(scope).length > 0 ||
      nonEmptyObject(objectOf(scope, ["market", "marketInfo", "metadata", "instrument"], {})) ||
      snapshot.markets.some((market) => knownText(market.slab) && !/^unknown/i.test(market.slab)),
    detail: ({ snapshot }) => `${snapshot.markets.length} market${snapshot.markets.length === 1 ? "" : "s"} mapped`
  },
  {
    id: "price",
    label: "oracle price",
    present: hasPriceSignal,
    detail: ({ market }) => market.price?.mark ? `$${market.price.mark.toFixed(market.base === "WIF" ? 3 : 2)} mark` : "price signal mapped"
  },
  {
    id: "engine",
    label: "crank engine",
    present: hasEngineSignal,
    tone: hasCrankAgeSignal ? () => "good" : () => "warning",
    detail: ({ market }) => `${Number(market.crank?.ageSlots || 0).toFixed(0)} slot age`
  },
  {
    id: "funding",
    label: "carry rate",
    present: hasFundingSignal,
    detail: ({ market }) => `${Number(market.funding?.bpsPerHour || 0).toFixed(1)} bps/hr`
  },
  {
    id: "structure",
    label: "market structure",
    present: hasMarketStructureSignal,
    detail: ({ market }) => `${Number(market.marketStructure?.oiSkewPct || 0).toFixed(1)}% OI skew`
  },
  {
    id: "account",
    label: "account runway",
    present: hasAccountSignal,
    detail: ({ market }) => `${Number(market.account?.liquidationDistancePct || 0).toFixed(1)}% runway`
  },
  {
    id: "execution",
    label: "book quality",
    present: hasExecutionSignal,
    detail: ({ market }) => `${Number(market.execution?.spreadBps || 0).toFixed(1)} bps spread`
  },
  {
    id: "receipts",
    label: "fill receipts",
    present: hasReceiptSignal,
    detail: ({ scope, market }) => `${receiptCount(scope, market)} receipt${receiptCount(scope, market) === 1 ? "" : "s"}`
  },
  {
    id: "history",
    label: "carry history",
    present: hasHistorySignal,
    detail: ({ scope, market }) => `${historyCount(scope, market)} rows`
  },
  {
    id: "provenance",
    label: "provenance",
    present: hasProvenanceSignal,
    detail: ({ snapshot }) => snapshot.source?.label || snapshot.cluster || "source mapped"
  }
];

const COMPATIBILITY_FIELD_SPECS = [
  {
    field: "market.slab",
    label: "slab address",
    severity: "danger",
    detail: "Needed to anchor the terminal view to one Percolator market.",
    present: ({ market }) => knownText(market.slab) && !/^unknown/i.test(market.slab)
  },
  {
    field: "market.program",
    label: "program id",
    severity: "danger",
    detail: "Needed before a live terminal trusts decoded account ownership.",
    present: ({ market }) => knownText(market.program) && !/^unknown/i.test(market.program)
  },
  {
    field: "price.mark",
    label: "mark price",
    severity: "danger",
    detail: "Needed for runway, impact, and account notional math.",
    present: hasPriceSignal
  },
  {
    field: "price.publishAgeSec",
    label: "oracle age",
    severity: "warning",
    detail: "Keeps stale price reads visible instead of hidden in raw output.",
    present: hasOracleAgeSignal
  },
  {
    field: "crank.ageSlots",
    label: "crank age",
    severity: "warning",
    detail: "Shows whether risk and funding state are lagging the latest slot.",
    present: hasCrankAgeSignal
  },
  {
    field: "funding.bpsPerHour",
    label: "funding rate",
    severity: "warning",
    detail: "Makes carry pressure readable for traders watching positions.",
    present: hasFundingSignal
  },
  {
    field: "marketStructure.openInterestUsd",
    label: "open interest",
    severity: "warning",
    detail: "Needed for skew and stress pressure cards.",
    present: hasMarketStructureSignal
  },
  {
    field: "account.positionNotionalUsd",
    label: "position notional",
    severity: "warning",
    detail: "Needed for account-level buffer and liquidation runway.",
    present: hasPositionNotionalSignal
  },
  {
    field: "execution.bestBid/bestAsk",
    label: "best bid / ask",
    severity: "warning",
    detail: "Needed to separate real spread from adapter fallbacks.",
    present: hasExecutionSignal
  },
  {
    field: "execution.receipts",
    label: "fill receipts",
    severity: "warning",
    detail: "Adds latency, markout, and priority-fee context.",
    present: hasReceiptSignal
  },
  {
    field: "history.fundingSkew",
    label: "funding / skew history",
    severity: "warning",
    detail: "Adds trend context beyond a single decoded snapshot.",
    present: hasHistorySignal
  }
];

const COMPATIBILITY_MUTATING_KEYS = new Set([
  "instruction",
  "instructions",
  "order",
  "orders",
  "send",
  "sendtransaction",
  "sign",
  "signer",
  "signtransaction",
  "transaction",
  "transactions"
]);

const COMPATIBILITY_TOP_LEVEL_KEYS = new Set([
  "account",
  "accountInfo",
  "accounts",
  "bitmap",
  "cluster",
  "command",
  "commands",
  "config",
  "currentSlot",
  "current_slot",
  "data",
  "engine",
  "execution",
  "executionReceipts",
  "expectations",
  "fillReceipts",
  "fixture",
  "fixtureKind",
  "fundingHistory",
  "fundingSkewHistory",
  "header",
  "history",
  "items",
  "json",
  "label",
  "market",
  "marketConfig",
  "marketInfo",
  "markets",
  "metadata",
  "network",
  "oracle",
  "output",
  "outputs",
  "params",
  "price",
  "prices",
  "program",
  "programId",
  "receiptTimeline",
  "receipts",
  "result",
  "rows",
  "rpcRead",
  "slab",
  "slabAddress",
  "slabBitmap",
  "slabConfig",
  "slabEngine",
  "slabHeader",
  "slabParams",
  "source",
  "sourceLabel",
  "slot",
  "stdout",
  "stdoutText"
].map(normalizeKey));

const COMPATIBILITY_COMMAND_KEYS = new Set([
  "bestprice",
  "executionreceipt",
  "executionreceipts",
  "fillreceipts",
  "fills",
  "fundinghistory",
  "fundingrates",
  "fundingskewhistory",
  "listmarkets",
  "marketcarryhistory",
  "receiptlog",
  "receipts",
  "skewhistory",
  "slabaccount",
  "slabaccounts",
  "slabbitmap",
  "slabengine",
  "slabget",
  "slabparams"
]);

function ignoredCompatibilityFields(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return [];
  const ignored = [];
  for (const [key] of Object.entries(input)) {
    if (!COMPATIBILITY_TOP_LEVEL_KEYS.has(normalizeKey(key))) {
      ignored.push({
        path: key,
        label: key,
        reason: "top-level field is not part of the adapter map yet"
      });
    }
  }
  for (const command of commandNames(input)) {
    if (!COMPATIBILITY_COMMAND_KEYS.has(normalizeKey(command))) {
      ignored.push({
        path: `commands.${command}`,
        label: command,
        reason: "command is preserved as provenance but not mapped"
      });
    }
  }
  return ignored.slice(0, 8);
}

const COMPATIBILITY_ALIAS_HINTS = [
  {
    field: "market.slab",
    tokens: ["slab", "marketaddress", "marketpubkey", "pubkey", "address"],
    reason: "Use this as the market slab anchor."
  },
  {
    field: "market.program",
    tokens: ["program", "programid", "owner"],
    reason: "Use this as the decoded account owner/program id."
  },
  {
    field: "price.mark",
    tokens: ["mark", "markprice", "oracleprice", "oraclepriceusd", "priceusd", "mid", "midprice"],
    reason: "Map this into the mark/oracle price lane."
  },
  {
    field: "price.publishAgeSec",
    tokens: ["age", "agesec", "agesecs", "publishage", "publishagesec", "oracleage", "staleness"],
    reason: "Map this into oracle freshness."
  },
  {
    field: "crank.ageSlots",
    tokens: ["crank", "crankage", "ageslots", "lastcrank", "lastmarketslot"],
    reason: "Map this into crank freshness."
  },
  {
    field: "funding.bpsPerHour",
    tokens: ["funding", "fundingrate", "fundingbps", "premium", "carry"],
    reason: "Map this into the carry-rate card."
  },
  {
    field: "marketStructure.openInterestUsd",
    tokens: ["openinterest", "oi", "oiusd", "longoi", "shortoi"],
    reason: "Map this into OI, skew, and stress pressure."
  },
  {
    field: "account.positionNotionalUsd",
    tokens: ["notional", "positionnotional", "position", "basesize", "positionbase"],
    reason: "Map this into account runway."
  },
  {
    field: "execution.bestBid/bestAsk",
    tokens: ["bestbid", "bestask", "bid", "ask", "quote", "book", "orderbook"],
    reason: "Map this into spread and execution quality."
  },
  {
    field: "execution.receipts",
    tokens: ["receipt", "receipts", "fills", "fill", "execution"],
    reason: "Map this into the fill receipt timeline."
  },
  {
    field: "history.fundingSkew",
    tokens: ["history", "fundinghistory", "skewhistory", "fundingskew", "rows"],
    reason: "Map this into the carry-history sparklines."
  }
];

function buildCompatibilityAliasSuggestions(missingFields = [], ignoredFields = []) {
  const suggestions = [];
  for (const missing of missingFields || []) {
    const candidates = (ignoredFields || [])
      .map((ignored) => aliasSuggestionFor(missing, ignored))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
    if (candidates.length) {
      suggestions.push(...candidates);
    } else if (missing.severity === "danger") {
      suggestions.push({
        field: missing.field,
        candidatePath: "",
        confidence: "needs-input",
        score: 0,
        action: "add-field",
        reason: `${missing.label} is still required for a trusted terminal view.`
      });
    }
  }
  return dedupeAliasSuggestions(suggestions).slice(0, 8);
}

function aliasSuggestionFor(missing, ignored) {
  const hint = COMPATIBILITY_ALIAS_HINTS.find((entry) => entry.field === missing.field);
  if (!hint || !ignored) return null;
  const haystack = normalizeKey(`${ignored.path || ""} ${ignored.label || ""}`);
  const score = hint.tokens.reduce((best, token) => {
    const normalizedToken = normalizeKey(token);
    if (haystack === normalizedToken) return Math.max(best, 100);
    if (haystack.includes(normalizedToken) || normalizedToken.includes(haystack)) return Math.max(best, 86);
    return best;
  }, 0);
  if (!score) return null;
  return {
    field: missing.field,
    candidatePath: ignored.path,
    confidence: score >= 90 ? "high" : "medium",
    score,
    action: "map-alias",
    reason: hint.reason
  };
}

function dedupeAliasSuggestions(suggestions) {
  const seen = new Set();
  return suggestions.filter((suggestion) => {
    const key = `${suggestion.field}:${suggestion.candidatePath}:${suggestion.action}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeAliasSuggestions(...groups) {
  return dedupeAliasSuggestions(groups.flat().filter(Boolean))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 8);
}

function normalizeCompatibilityReport(report = {}) {
  return {
    shape: report.shape || "unknown",
    status: report.status || "unknown",
    compatible: Boolean(report.compatible),
    tone: report.tone || "neutral",
    score: Number(report.score || 0),
    recognizedSections: report.recognizedSections || [],
    missingFields: report.missingFields || [],
    ignoredFields: report.ignoredFields || [],
    aliasSuggestions: report.aliasSuggestions || [],
    source: report.source || {},
    summary: report.summary || {}
  };
}

function compatibilityDiffSummary(report) {
  return {
    shape: report.shape,
    status: report.status,
    compatible: report.compatible,
    score: report.score,
    source: {
      label: report.source?.label || "decoded capture",
      cluster: report.source?.cluster || "unknown",
      commandCount: Array.isArray(report.source?.commandSet) ? report.source.commandSet.length : 0,
      marketCount: report.source?.marketCount || report.summary?.marketCount || 0
    },
    summary: {
      recognizedCount: report.summary?.recognizedCount || report.recognizedSections.length,
      missingCount: report.summary?.missingCount || report.missingFields.length,
      ignoredCount: report.summary?.ignoredCount || report.ignoredFields.length,
      suggestionCount: report.summary?.suggestionCount || report.aliasSuggestions.length
    }
  };
}

function realityLane(label, value, tone = "neutral") {
  return { label, value, tone };
}

function realityProvenance(input, report) {
  const source = report.source || {};
  const inputSource = input && typeof input === "object" && !Array.isArray(input) ? input.source || {} : {};
  const kind = stringOf(input, ["fixtureKind", "sourceKind"], inputSource.kind || source.shape || report.shape || "decoded-capture");
  const candidate = /candidate|read-only-rpc|real/i.test(kind) || Boolean(inputSource.realBacked);
  const submitted = Boolean(inputSource.submittedBy) || Boolean(inputSource.externalSubmission);
  const status = submitted ? "submitted" : candidate ? "candidate" : "synthetic";
  return {
    status,
    kind,
    label: source.label || stringOf(input, ["label"], "decoded capture"),
    cluster: source.cluster || stringOf(input, ["cluster"], "unknown"),
    basis: inputSource.basis || inputSource.capture || "",
    fixture: stringOf(input, ["fixture"], ""),
    sanitized: inputSource.sanitized !== false,
    submittedBy: inputSource.submittedBy || "",
    note: inputSource.note || (status === "candidate" ? "real-backed candidate; still waiting on third-party decoded shape" : "")
  };
}

function compatibilityDoctorActions(report, reality) {
  const actions = [];
  if (report.status === "rejected") {
    actions.push("Remove wallet, signer, transaction, instruction, order, secret, private key, seed, mnemonic, or API key fields.");
    return actions;
  }
  const dangerMissing = (report.missingFields || []).filter((field) => field.severity === "danger");
  if (dangerMissing.length) {
    actions.push(`Map required fields: ${dangerMissing.map((field) => field.field).join(", ")}.`);
  }
  const warningMissing = (report.missingFields || []).filter((field) => field.severity !== "danger").slice(0, 3);
  if (warningMissing.length) {
    actions.push(`Add useful trader fields: ${warningMissing.map((field) => field.field).join(", ")}.`);
  }
  if ((report.aliasSuggestions || []).length) {
    actions.push(`Apply alias suggestions: ${(report.aliasSuggestions || []).slice(0, 3).map((suggestion) => `${suggestion.candidatePath || suggestion.action} -> ${suggestion.field}`).join(", ")}.`);
  }
  if ((report.ignoredFields || []).length) {
    actions.push(`${report.ignoredFields.length} unknown field${report.ignoredFields.length === 1 ? "" : "s"} can be mapped or intentionally ignored.`);
  }
  if (!actions.length && reality.gaps.dangerMissing === 0) {
    actions.push("Ready for read-only terminal display.");
  }
  return actions;
}

function differenceByField(left = [], right = []) {
  const rightFields = new Set((right || []).map((entry) => entry.field));
  return (left || []).filter((entry) => !rightFields.has(entry.field));
}

function differenceByPath(left = [], right = []) {
  const rightPaths = new Set((right || []).map((entry) => entry.path));
  return (left || []).filter((entry) => !rightPaths.has(entry.path));
}

function differenceById(left = [], right = []) {
  const rightIds = new Set((right || []).map((entry) => entry.id));
  return (left || []).filter((entry) => !rightIds.has(entry.id));
}

function assertReadOnlyCompatibilityCapture(value, path = "capture") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizeKey(key);
    if (COMPATIBILITY_MUTATING_KEYS.has(normalized)) {
      throw new Error(`Refusing mutating field in compatibility capture: ${path}.${key}`);
    }
    if (child && typeof child === "object") assertReadOnlyCompatibilityCapture(child, `${path}.${key}`);
  }
}

function compatibilityScope(input) {
  if (!input || typeof input !== "object") return { markets: [] };
  if (Array.isArray(input)) return { history: isFundingHistoryArray(input) ? input : [], markets: input };
  const scope = collectCliSections(input);
  if (!isReadOnlyRpcInput(input)) return scope;
  const account = objectOf(input, ["account", "accountInfo"], {});
  const decoded = objectOf(account, ["decoded"], {});
  const market = {
    ...objectOf(input, ["market"], {}),
    slab: stringOf(input, ["slab", "slabAddress", "pubkey"], ""),
    program: stringOf(input, ["programId", "program", "owner"], "")
  };
  return {
    ...scope,
    ...decoded,
    market,
    account: objectOf(decoded, ["accountUsd", "account", "position"], scope.account || {}),
    accounts: decoded.accounts || scope.accounts,
    bestPrice: decoded.bestPrice || scope.bestPrice,
    bitmap: decoded.bitmap || scope.bitmap,
    config: decoded.config || scope.config,
    engine: decoded.engine || scope.engine,
    header: decoded.header || scope.header,
    params: decoded.params || scope.params
  };
}

function compatibilityMarket(market, input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return market || {};
  const inputMarket = objectOf(input, ["market", "marketInfo", "metadata", "instrument"], {});
  return {
    ...(market || {}),
    slab: knownText(market?.slab) && !/^unknown/i.test(market.slab)
      ? market.slab
      : stringOf(inputMarket, ["slab", "slabAddress", "pubkey"], stringOf(input, ["slab", "slabAddress", "pubkey"], market?.slab || "")),
    program: knownText(market?.program) && !/^unknown/i.test(market.program)
      ? market.program
      : stringOf(inputMarket, ["programId", "program", "owner"], stringOf(input, ["programId", "program", "owner"], market?.program || ""))
  };
}

function hasPriceSignal({ scope, market }) {
  const oracle = objectOf(scope, ["oracle", "price", "prices", "oraclePrice"], {});
  const book = objectOf(scope, ["bestPrice", "best-price", "best_price", "book", "orderbook", "quote"], {});
  const firstReceipt = firstItem(receiptListOf(scope));
  return rawNumberPresent(oracle, ["markPrice", "mark", "priceUsd", "oraclePriceUsd", "price"]) ||
    rawNumberPresent(book, ["markPrice", "mark", "midPrice", "mid", "priceUsd"]) ||
    rawNumberPresent(firstReceipt, ["markPriceUsd", "markPrice", "mark"]) ||
    Number(market.price?.mark) > 0;
}

function hasOracleAgeSignal({ scope, market }) {
  const oracle = objectOf(scope, ["oracle", "price", "prices", "oraclePrice"], {});
  const firstReceipt = firstItem(receiptListOf(scope));
  const age = Number(market.price?.publishAgeSec);
  return rawNumberPresent(oracle, ["publishAgeSec", "ageSecs", "ageSec", "age"]) ||
    rawNumberPresent(firstReceipt, ["oracleAgeSec", "priceAgeSec", "ageSecs"]) ||
    (Number.isFinite(age) && age > 0);
}

function hasEngineSignal({ scope, market }) {
  return nonEmptyObject(objectOf(scope, ["engine", "state", "riskState", "slabEngine", "slab:engine"], {})) ||
    nonEmptyObject(objectOf(scope, ["bitmap", "slabBitmap", "slab:bitmap"], {})) ||
    Number(market.crank?.activeAccounts || 0) > 0 ||
    Number(market.crank?.ageSlots || 0) > 0;
}

function hasCrankAgeSignal({ scope, market }) {
  const engine = objectOf(scope, ["engine", "state", "riskState", "slabEngine", "slab:engine"], {});
  return rawNumberPresent(engine, ["crankAgeSlots", "crank_age_slots", "ageSlots", "lastCrankSlot", "last_crank_slot", "lastMarketSlot", "last_market_slot"]) ||
    Number(market.crank?.ageSlots) > 0;
}

function hasFundingSignal({ scope, market }) {
  const engine = objectOf(scope, ["engine", "state", "riskState", "slabEngine", "slab:engine"], {});
  const firstHistory = firstItem(historyListOf(scope));
  const funding = Number(market.funding?.bpsPerHour);
  return rawNumberPresent(engine, ["fundingRateBpsPerHour", "funding_bps_per_hour", "fundingRate"]) ||
    rawNumberPresent(firstHistory, ["fundingBpsPerHour", "fundingRateBpsPerHour"]) ||
    (Number.isFinite(funding) && funding !== 0);
}

function hasMarketStructureSignal({ scope, market }) {
  const engine = objectOf(scope, ["engine", "state", "riskState", "slabEngine", "slab:engine"], {});
  const marketInfo = objectOf(scope, ["market", "marketInfo", "metadata", "instrument"], {});
  const firstHistory = firstItem(historyListOf(scope));
  return rawNumberPresent(engine, ["openInterestUsd", "open_interest_usd", "oiUsd", "longOpenInterestUsd", "shortOpenInterestUsd"]) ||
    rawNumberPresent(marketInfo, ["openInterestUsd"]) ||
    rawNumberPresent(firstHistory, ["openInterestUsd", "oiUsd", "longOpenInterestUsd", "shortOpenInterestUsd", "oiSkewPct"]) ||
    Number(market.marketStructure?.openInterestUsd) > 0;
}

function hasAccountSignal({ scope, market }) {
  const account = objectOf(scope, ["account", "position", "traderAccount"], {});
  return nonEmptyObject(account) ||
    rowsOf(valueOf(scope, ["accounts", "positions"])).length > 0 ||
    Math.abs(Number(market.account?.positionSize || 0)) > 0 ||
    Number(market.account?.collateralUsd || 0) > 0;
}

function hasPositionNotionalSignal({ scope, market }) {
  const account = objectOf(scope, ["account", "position", "traderAccount"], {});
  return rawNumberPresent(account, ["positionNotionalUsd", "notionalUsd", "notional"]) ||
    (
      rawNumberPresent(account, ["positionSize", "basePosition", "positionSizeBase", "size", "position"]) &&
      Number(market.price?.mark) > 0
    ) ||
    Number(market.account?.positionNotionalUsd) > 0;
}

function hasExecutionSignal({ scope, market }) {
  const book = objectOf(scope, ["bestPrice", "best-price", "best_price", "book", "orderbook", "quote"], {});
  const execution = objectOf(scope, ["execution", "executionQuality"], {});
  const firstReceipt = firstItem(receiptListOf(scope));
  const sourceExecution = objectOf(sourceMarketOf(scope), ["execution", "executionQuality"], {});
  return rawNumberPresent(book, ["bestBid", "bid", "best_bid", "bestAsk", "ask", "best_ask"]) ||
    rawNumberPresent(execution, ["bestBid", "bestAsk"]) ||
    rawNumberPresent(sourceExecution, ["bestBid", "bestAsk"]) ||
    rawNumberPresent(firstReceipt, ["bestBid", "bestAsk", "bid", "ask"]) ||
    (Number(market.execution?.bestBid) > 0 && Number(market.execution?.bestAsk) > 0 && (receiptCount(scope, market) > 0 || nonEmptyObject(sourceExecution)));
}

function hasReceiptSignal({ scope, market }) {
  return receiptCount(scope, market) > 0;
}

function hasHistorySignal({ scope, market }) {
  return historyCount(scope, market) > 0;
}

function receiptCount(scope, market) {
  const sourceReceipts = objectOf(sourceMarketOf(scope), ["execution", "executionQuality"], {});
  return Math.max(
    receiptListOf(scope).length,
    receiptListOf(sourceReceipts).length,
    Array.isArray(market.execution?.receipts) ? market.execution.receipts.length : 0
  );
}

function historyCount(scope, market) {
  const sourceHistory = objectOf(sourceMarketOf(scope), ["history"], {});
  return Math.max(
    historyListOf(scope).length,
    historyListOf(sourceHistory).length,
    Array.isArray(market.history?.fundingSkew) ? market.history.fundingSkew.length : 0
  );
}

function sourceMarketOf(scope) {
  const [market] = marketListOf(scope);
  if (market && typeof market === "object") return market;
  return objectOf(scope, ["market", "marketInfo", "metadata", "instrument"], {});
}

function hasProvenanceSignal({ input, scope, snapshot }) {
  return Array.isArray(snapshot.source?.commandSet) && snapshot.source.commandSet.length > 0 ||
    knownText(valueOf(scope, ["label", "sourceLabel"])) ||
    (knownText(snapshot.cluster) && snapshot.cluster !== "unknown") ||
    rawNumberPresent(scope, ["currentSlot", "slot", "current_slot"]) ||
    commandNames(input).length > 0;
}

function rawNumberPresent(source, aliases) {
  if (!source || typeof source !== "object") return false;
  const value = valueOf(source, aliases);
  if (value === undefined || value === null || value === "") return false;
  const next = Number(typeof value === "string" ? value.replace(/[$,%_\s,]/g, "") : value);
  return Number.isFinite(next);
}

function knownText(value) {
  return Boolean(value && String(value).trim());
}

function nonEmptyObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length);
}

function coercePercolatorSnapshot(input) {
  if (!input || typeof input !== "object") {
    return { source: { label: "empty input", mode: "read-only" }, markets: [] };
  }

  if (Array.isArray(input)) {
    return {
      source: { label: "market array", mode: "read-only" },
      cluster: "unknown",
      currentSlot: 0,
      markets: input.map((market) => coercePercolatorMarket(market))
    };
  }

  const inputShape = detectPercolatorInputShape(input);
  if (inputShape === "percolator-cli-bundle" || inputShape === "funding-skew-history") {
    return coercePercolatorCliBundle(input);
  }

  if (Array.isArray(input.markets)) {
    return {
      ...input,
      markets: input.markets.map((market) => coercePercolatorMarket(market, input.currentSlot))
    };
  }

  return {
    source: { label: "single market import", mode: "read-only" },
    cluster: stringOf(input, ["cluster"], "unknown"),
    currentSlot: numberOf(input, ["currentSlot", "slot"], 0),
    markets: [coercePercolatorMarket(input, input.currentSlot)]
  };
}

function coercePercolatorMarket(market, currentSlot = 0) {
  if (!market || typeof market !== "object") return {};
  if (market.oracle && market.engine && market.account && market.execution) return market;
  const marketInfo = objectOf(market, ["market", "marketInfo", "metadata", "instrument"], market);
  return coercePercolatorCliBundle({
    ...market,
    cluster: market.cluster,
    currentSlot,
    market: marketInfo
  }).markets[0];
}

function coercePercolatorCliBundle(bundle) {
  const scope = collectCliSections(bundle);
  const engineScope = {
    ...objectOf(scope, ["engine", "state", "riskState"], {}),
    ...objectOf(scope, ["slabEngine", "slab:engine"], {})
  };
  const currentSlot = firstNumber(
    maybeNumberOf(scope, ["currentSlot", "slot", "current_slot"]),
    maybeNumberOf(engineScope, ["currentSlot", "current_slot"])
  );
  const markets = marketListOf(scope);
  return {
    source: {
      label: stringOf(scope, ["label", "sourceLabel"], "Percolator CLI bundle"),
      mode: "read-only",
      commandSet: commandNames(bundle)
    },
    cluster: stringOf(scope, ["cluster", "network"], "unknown"),
    currentSlot,
    markets: markets.length
      ? markets.map((market, index) => coerceCliMarket(scopedMarket(scope, market, index), currentSlot))
      : [coerceCliMarket(scope, currentSlot)]
  };
}

function coerceCliMarket(scope, currentSlot) {
  const marketInfo = objectOf(scope, ["market", "marketInfo", "metadata", "instrument"], scope);
  const header = objectOf(scope, ["slabHeader", "slab:header", "header"], {});
  const config = objectOf(scope, ["slabConfig", "slab:config", "config", "marketConfig"], {});
  const accountRows = valueOf(scope, ["accounts", "positions"]);
  const accountStats = summarizeAccounts(accountRows);
  const bitmapStats = summarizeBitmap(objectOf(scope, ["bitmap", "slabBitmap", "slab:bitmap"], {}));
  const engine = {
    ...objectOf(scope, ["engine", "state", "riskState"], {}),
    ...objectOf(scope, ["slabEngine", "slab:engine"], {}),
    ...accountStats,
    ...bitmapStats
  };
  const oracle = objectOf(scope, ["oracle", "price", "prices", "oraclePrice"], {});
  const book = objectOf(scope, ["bestPrice", "best-price", "best_price", "book", "orderbook", "quote"], {});
  const execution = objectOf(scope, ["execution", "executionQuality"], {});
  const historyRows = historyListOf(scope);
  const receiptRows = receiptListOf(scope, execution);
  const firstReceipt = firstItem(receiptRows);
  const account = {
    ...firstItem(accountRows),
    ...firstItem(valueOf(scope, ["account", "position", "traderAccount"]))
  };
  const bestBuy = objectOf(book, ["bestBuy", "best_buy"], objectOf(scope, ["bestBuy", "best_buy"], {}));
  const bestSell = objectOf(book, ["bestSell", "best_sell"], objectOf(scope, ["bestSell", "best_sell"], {}));
  const params = objectOf(scope, ["slabParams", "slab:params", "params", "riskParams"], {});
  const symbol = stringOf(marketInfo, ["symbol", "name", "market", "ticker"], "PERP");
  const parsed = parseSymbol(symbol);
  const base = stringOf(marketInfo, ["base", "baseSymbol", "baseAsset"], parsed.base);
  const quote = stringOf(marketInfo, ["quote", "quoteSymbol", "quoteAsset"], parsed.quote);
  const markPrice = firstNumber(
    priceNumberOf(oracle, ["markPrice", "mark", "priceUsd", "oraclePriceUsd"], ["price", "oraclePrice"]),
    priceNumberOf(book, ["markPrice", "mark", "midPrice", "mid", "priceUsd"], ["price"]),
    priceNumberOf(firstReceipt, ["markPriceUsd", "markPrice", "mark"], ["markPrice"]),
    priceNumberOf(engine, ["lastOraclePriceUsd", "resolvedPriceUsd"], ["lastOraclePrice", "resolvedPrice"]),
    priceNumberOf(marketInfo, ["markPrice", "priceUsd"], ["price"])
  );
  const indexPrice = firstNumber(
    priceNumberOf(oracle, ["indexPrice", "index", "oraclePriceUsd", "priceUsd"], ["oraclePrice", "price"]),
    priceNumberOf(book, ["indexPrice", "oraclePriceUsd"], ["oraclePrice", "price"]),
    markPrice
  );
  const bestBid = firstNumber(
    priceNumberOf(book, ["bestBid", "bid", "best_bid"], []),
    priceNumberOf(execution, ["bestBid"], []),
    priceNumberOf(firstReceipt, ["bestBid", "bid", "best_bid"], []),
    priceNumberOf(bestSell, ["priceUsd"], ["price"])
  );
  const bestAsk = firstNumber(
    priceNumberOf(book, ["bestAsk", "ask", "best_ask"], []),
    priceNumberOf(execution, ["bestAsk"], []),
    priceNumberOf(firstReceipt, ["bestAsk", "ask", "best_ask"], []),
    priceNumberOf(bestBuy, ["priceUsd"], ["price"])
  );
  const spreadFallback = markPrice ? markPrice * 0.0008 : 0;
  const normalizedBestBid = bestBid || Math.max(markPrice - spreadFallback, 0);
  const normalizedBestAsk = bestAsk || markPrice + spreadFallback;
  const positionSize = numberOf(account, ["positionSize", "basePosition", "positionSizeBase", "size", "position"], 0);
  const side = stringOf(account, ["side"], positionSize < 0 ? "short" : positionSize > 0 ? "long" : "flat");
  const positionNotionalUsd = firstNumber(
    maybeNumberOf(account, ["positionNotionalUsd", "notionalUsd", "notional"]),
    Math.abs(positionSize) * markPrice
  );
  const collateralUsd = numberOf(account, ["collateralUsd", "equityCollateralUsd"], 0);
  const unrealizedPnlUsd = numberOf(account, ["unrealizedPnlUsd", "unrealizedPnl", "uPnl"], 0);
  const fundingPnlUsd = numberOf(account, ["fundingPnlUsd", "fundingPnl"], 0);
  const maintenanceMarginUsd = firstNumber(
    maybeNumberOf(account, ["maintenanceMarginUsd", "maintenanceMargin"]),
    positionNotionalUsd * (firstNumber(
      maybeNumberOf(params, ["maintenanceMarginBps", "maintenance_margin_bps"]),
      maybeNumberOf(config, ["maintenanceMarginBps", "maintenance_margin_bps"]),
      500
    ) / 10000)
  );
  const liquidationPrice = firstNumber(
    maybeNumberOf(account, ["liquidationPrice", "liqPrice", "liquidation_price"]),
    markPrice * (side === "short" ? 1.18 : 0.82)
  );
  const lastCrankSlot = numberOf(engine, ["lastCrankSlot", "last_crank_slot"], currentSlot);
  const crankAgeSlots = firstNumber(
    maybeNumberOf(engine, ["crankAgeSlots", "crank_age_slots", "ageSlots"]),
    currentSlot && numberOf(engine, ["lastMarketSlot", "last_market_slot"]) ? currentSlot - numberOf(engine, ["lastMarketSlot", "last_market_slot"]) : undefined,
    Math.max(currentSlot - lastCrankSlot, 0)
  );
  const stressConsumedBps = firstNumber(
    maybeNumberOf(engine, ["stressConsumedBps", "stress_consumed_bps"]),
    maybeNumberOf(engine, ["stressConsumedBpsE9SinceEnvelope"]) / 1e9
  );
  const openInterestUsd = firstNumber(
    maybeNumberOf(engine, ["openInterestUsd", "open_interest_usd", "oiUsd"]),
    maybeNumberOf(marketInfo, ["openInterestUsd"])
  );
  const longOpenInterestUsd = firstNumber(
    maybeNumberOf(engine, ["longOpenInterestUsd", "long_oi_usd"]),
    maybeNumberOf(marketInfo, ["longOpenInterestUsd"])
  );
  const shortOpenInterestUsd = firstNumber(
    maybeNumberOf(engine, ["shortOpenInterestUsd", "short_oi_usd"]),
    maybeNumberOf(marketInfo, ["shortOpenInterestUsd"])
  );
  const insuranceUsd = firstNumber(
    maybeNumberOf(engine, ["insuranceUsd", "insurance_usd"]),
    maybeNumberOf(marketInfo, ["insuranceUsd"])
  );

  return {
    id: stringOf(marketInfo, ["id", "marketId"], `${base.toLowerCase()}-perp`),
    name: stringOf(marketInfo, ["name", "symbol"], `${base}-PERP`),
    base,
    quote,
    status: stringOf(marketInfo, ["status"], "read-only"),
    slab: stringOf(marketInfo, ["slab", "slabAddress", "address", "pubkey"], "unknown slab"),
    program: stringOf(marketInfo, ["program", "programId", "owner"], "unknown program"),
    header,
    config: {
      maxLeverage: numberOf(config, ["maxLeverage", "max_leverage"], 0),
      initialMarginBps: firstNumber(maybeNumberOf(params, ["initialMarginBps", "initial_margin_bps"]), maybeNumberOf(config, ["initialMarginBps", "initial_margin_bps"])),
      maintenanceMarginBps: firstNumber(maybeNumberOf(params, ["maintenanceMarginBps", "maintenance_margin_bps"]), maybeNumberOf(config, ["maintenanceMarginBps", "maintenance_margin_bps"])),
      liquidationFeeBps: firstNumber(maybeNumberOf(params, ["liquidationFeeBps", "liquidation_fee_bps"]), maybeNumberOf(config, ["liquidationFeeBps", "liquidation_fee_bps"])),
      fundingMaxPremiumBps: numberOf(config, ["fundingMaxPremiumBps", "funding_max_premium_bps"], 0),
      maxStalenessSecs: numberOf(config, ["maxStalenessSecs", "max_staleness_secs", "maxOracleAgeSec"], 8),
      confFilterBps: numberOf(config, ["confFilterBps", "confidenceFilterBps"], 0),
      permissionlessResolveStaleSlots: numberOf(config, ["permissionlessResolveStaleSlots"], 0),
      forceCloseDelaySlots: numberOf(config, ["forceCloseDelaySlots"], 0)
    },
    oracle: {
      indexPrice,
      markPrice,
      effectivePrice: firstNumber(priceNumberOf(oracle, ["effectivePrice", "effectivePriceUsd"], []), markPrice),
      confidenceBps: numberOf(oracle, ["confidenceBps", "confidence_bps", "confBps"], 0),
      publishAgeSec: numberOf(oracle, ["publishAgeSec", "ageSecs", "ageSec", "age"], 0),
      pricePath: arrayOf(oracle, ["pricePath", "path", "history"], [indexPrice, markPrice]),
      legs: arrayOf(oracle, ["legs", "sources"], [])
    },
    engine: {
      lastCrankSlot,
      crankAgeSlots,
      catchupRequired: Boolean(valueOf(engine, ["catchupRequired", "catchup_required"])),
      staleAccounts: numberOf(engine, ["staleAccounts", "stale_accounts", "staleAccountCount"], 0),
      activeAccounts: firstNumber(
        maybeNumberOf(engine, ["activeAccounts", "active_accounts", "materializedAccountCount"]),
        maybeNumberOf(engine, ["numUsedAccounts", "numUsed", "usedAccounts"])
      ),
      maxAccounts: firstNumber(
        maybeNumberOf(engine, ["maxAccounts", "max_accounts"]),
        maybeNumberOf(params, ["maxAccounts", "max_accounts"]),
        maybeNumberOf(config, ["maxAccounts", "max_accounts"])
      ),
      fundingRateBpsPerHour: numberOf(engine, ["fundingRateBpsPerHour", "funding_bps_per_hour", "fundingRate"], 0),
      fundingIndex: valueOf(engine, ["fundingIndex", "funding_index"]) || "0",
      openInterestUsd,
      longOpenInterestUsd,
      shortOpenInterestUsd,
      stressConsumedBps,
      stressLimitBps: numberOf(engine, ["stressLimitBps", "stress_limit_bps"], 500),
      insuranceUsd,
      vaultUsd: numberOf(engine, ["vaultUsd", "vault_usd"], 0),
      claimUsd: numberOf(engine, ["claimUsd", "claim_usd"], 0),
      socialLossUsd: numberOf(engine, ["socialLossUsd", "social_loss_usd"], 0),
      sideMode: stringOf(engine, ["sideMode", "side_mode"], "unknown")
    },
    account: {
      label: stringOf(account, ["label", "ownerLabel", "name"], "Read-only observer"),
      side,
      positionSize,
      positionNotionalUsd,
      collateralUsd,
      unrealizedPnlUsd,
      realizedPnlUsd: numberOf(account, ["realizedPnlUsd", "realizedPnl"], 0),
      fundingPnlUsd,
      maintenanceMarginUsd,
      initialMarginUsd: firstNumber(
        maybeNumberOf(account, ["initialMarginUsd", "initialMargin"]),
        positionNotionalUsd * (firstNumber(
          maybeNumberOf(params, ["initialMarginBps", "initial_margin_bps"]),
          maybeNumberOf(config, ["initialMarginBps", "initial_margin_bps"]),
          800
        ) / 10000)
      ),
      liquidationPrice,
      pnlPath: arrayOf(account, ["pnlPath", "pnlHistory"], [unrealizedPnlUsd])
    },
    execution: {
      bestBid: normalizedBestBid,
      bestAsk: normalizedBestAsk,
      impact10kBps: firstNumber(
        maybeNumberOf(execution, ["impact10kBps", "impact_10k_bps"]),
        maybeNumberOf(firstReceipt, ["impactBps", "priceImpactBps", "impact_bps"]),
        maybeNumberOf(book, ["effectiveSpreadBps"])
      ),
      impact50kBps: firstNumber(
        maybeNumberOf(execution, ["impact50kBps", "impact_50k_bps"]),
        maybeNumberOf(firstReceipt, ["impact50kBps", "impact_50k_bps"])
      ),
      markout1mBps: firstNumber(
        maybeNumberOf(execution, ["markout1mBps", "markout_1m_bps"]),
        maybeNumberOf(firstReceipt, ["markout1mBps", "markout_1m_bps", "markout60sBps"])
      ),
      markout5mBps: firstNumber(
        maybeNumberOf(execution, ["markout5mBps", "markout_5m_bps"]),
        maybeNumberOf(firstReceipt, ["markout5mBps", "markout_5m_bps", "markout300sBps"])
      ),
      fillQualityScore: firstNumber(
        maybeNumberOf(execution, ["fillQualityScore", "fill_quality_score"]),
        maybeNumberOf(firstReceipt, ["fillQualityScore", "qualityScore"]),
        72
      ),
      routeLatencyMs: firstNumber(
        maybeNumberOf(execution, ["routeLatencyMs", "latencyMs"]),
        maybeNumberOf(firstReceipt, ["routeLatencyMs", "latencyMs", "durationMs"])
      ),
      priorityFeeMicrolamports: firstNumber(
        maybeNumberOf(execution, ["priorityFeeMicrolamports", "priorityFee"]),
        maybeNumberOf(firstReceipt, ["priorityFeeMicrolamports", "priorityFee", "priorityFeeMicroLamports"])
      ),
      receipts: normalizeExecutionReceipts(receiptRows, {
        ...execution,
        bestBid: normalizedBestBid,
        bestAsk: normalizedBestAsk,
        spreadBps: bps(normalizedBestAsk - normalizedBestBid, midpoint(normalizedBestAsk, normalizedBestBid))
      })
    },
    history: {
      fundingSkew: historyRows
    }
  };
}

export function toTerminalMarketDto(market, currentSlot = 0) {
  const price = number(market.oracle?.markPrice);
  const indexPrice = number(market.oracle?.indexPrice);
  const effectivePrice = number(market.oracle?.effectivePrice || price);
  const account = market.account || {};
  const engine = market.engine || {};
  const config = market.config || {};
  const execution = market.execution || {};
  const executionReceipts = normalizeExecutionReceipts(execution.receipts || execution.receiptTimeline || [], execution);

  const spreadBps = bps(execution.bestAsk - execution.bestBid, midpoint(execution.bestAsk, execution.bestBid));
  const markDriftBps = bps(price - indexPrice, indexPrice);
  const oracleFreshness = freshnessScore(market.oracle?.publishAgeSec, config.maxStalenessSecs);
  const crankFreshness = freshnessScore(engine.crankAgeSlots, 220);
  const stressUsedPct = percent(engine.stressConsumedBps, engine.stressLimitBps);
  const insuranceCoveragePct = percent(engine.insuranceUsd, Math.max(engine.claimUsd || 1, 1));
  const oiSkewPct = percent(engine.longOpenInterestUsd - engine.shortOpenInterestUsd, engine.openInterestUsd);
  const equityUsd = number(account.collateralUsd) + number(account.unrealizedPnlUsd) + number(account.fundingPnlUsd);
  const marginBufferUsd = equityUsd - number(account.maintenanceMarginUsd);
  const marginBufferPct = percent(marginBufferUsd, Math.max(number(account.positionNotionalUsd), 1));
  const liquidationDistancePct = liquidationDistance({
    price,
    liquidationPrice: number(account.liquidationPrice),
    side: account.side
  });
  const dailyFundingUsd = number(account.positionNotionalUsd) * (number(engine.fundingRateBpsPerHour) / 10000) * 24;
  const signedDailyFundingUsd = account.side === "short" ? -dailyFundingUsd : dailyFundingUsd;
  const executionScore = clamp(number(execution.fillQualityScore), 0, 100);
  const rawFundingSkewHistory = rowsOf(market.history?.fundingSkew || market.history);
  const fundingSkewHistory = rawFundingSkewHistory.length
    ? normalizeFundingSkewHistory(rawFundingSkewHistory, {
      currentSlot,
      sourceStatus: market.status,
      funding: { bpsPerHour: number(engine.fundingRateBpsPerHour) },
      marketStructure: {
        openInterestUsd: number(engine.openInterestUsd),
        longOpenInterestUsd: number(engine.longOpenInterestUsd),
        shortOpenInterestUsd: number(engine.shortOpenInterestUsd),
        oiSkewPct,
        stressUsedPct
      },
      price: {
        publishAgeSec: number(market.oracle?.publishAgeSec)
      }
    })
    : [];

  const healthScore = weightedScore([
    [liquidationDistancePct * 6, 0.26],
    [marginBufferPct * 9, 0.18],
    [oracleFreshness, 0.16],
    [crankFreshness, 0.13],
    [100 - stressUsedPct, 0.13],
    [Math.min(insuranceCoveragePct, 120) * 0.82, 0.08],
    [executionScore, 0.06]
  ]);

  const flags = buildFlags({
    market,
    oracleFreshness,
    crankFreshness,
    stressUsedPct,
    insuranceCoveragePct,
    liquidationDistancePct,
    marginBufferUsd,
    spreadBps
  });

  return {
    id: market.id,
    name: market.name,
    base: market.base,
    quote: market.quote,
    status: labelFromScore(healthScore),
    sourceStatus: market.status,
    slab: market.slab,
    program: market.program,
    header: market.header,
    config,
    currentSlot,
    price: {
      index: indexPrice,
      mark: price,
      effective: effectivePrice,
      driftBps: markDriftBps,
      confidenceBps: number(market.oracle?.confidenceBps),
      publishAgeSec: number(market.oracle?.publishAgeSec),
      freshnessScore: oracleFreshness,
      path: market.oracle?.pricePath || [],
      legs: market.oracle?.legs || []
    },
    crank: {
      lastSlot: engine.lastCrankSlot,
      ageSlots: number(engine.crankAgeSlots),
      freshnessScore: crankFreshness,
      catchupRequired: Boolean(engine.catchupRequired),
      staleAccounts: number(engine.staleAccounts),
      activeAccounts: number(engine.activeAccounts),
      maxAccounts: number(engine.maxAccounts)
    },
    funding: {
      bpsPerHour: number(engine.fundingRateBpsPerHour),
      dailyUsd: signedDailyFundingUsd,
      index: engine.fundingIndex
    },
    marketStructure: {
      openInterestUsd: number(engine.openInterestUsd),
      longOpenInterestUsd: number(engine.longOpenInterestUsd),
      shortOpenInterestUsd: number(engine.shortOpenInterestUsd),
      oiSkewPct,
      stressUsedPct,
      sideMode: engine.sideMode
    },
    solvency: {
      insuranceUsd: number(engine.insuranceUsd),
      vaultUsd: number(engine.vaultUsd),
      claimUsd: number(engine.claimUsd),
      socialLossUsd: number(engine.socialLossUsd),
      coveragePct: insuranceCoveragePct
    },
    account: {
      label: account.label,
      side: account.side,
      positionSize: number(account.positionSize),
      positionNotionalUsd: number(account.positionNotionalUsd),
      collateralUsd: number(account.collateralUsd),
      equityUsd,
      unrealizedPnlUsd: number(account.unrealizedPnlUsd),
      realizedPnlUsd: number(account.realizedPnlUsd),
      fundingPnlUsd: number(account.fundingPnlUsd),
      maintenanceMarginUsd: number(account.maintenanceMarginUsd),
      initialMarginUsd: number(account.initialMarginUsd),
      liquidationPrice: number(account.liquidationPrice),
      liquidationDistancePct,
      marginBufferUsd,
      marginBufferPct,
      pnlPath: account.pnlPath || []
    },
    execution: {
      bestBid: number(execution.bestBid),
      bestAsk: number(execution.bestAsk),
      spreadBps,
      impact10kBps: number(execution.impact10kBps),
      impact50kBps: number(execution.impact50kBps),
      markout1mBps: number(execution.markout1mBps),
      markout5mBps: number(execution.markout5mBps),
      fillQualityScore: executionScore,
      routeLatencyMs: number(execution.routeLatencyMs),
      priorityFeeMicrolamports: number(execution.priorityFeeMicrolamports),
      receipts: executionReceipts
    },
    history: {
      fundingSkew: fundingSkewHistory
    },
    flags,
    healthScore
  };
}

export function simulatePriceShock(marketDto, shockPct) {
  const nextPrice = marketDto.price.mark * (1 + number(shockPct) / 100);
  const signedSize = Math.abs(marketDto.account.positionSize) * (marketDto.account.side === "short" ? -1 : 1);
  const priceMove = nextPrice - marketDto.price.mark;
  const projectedPnl = marketDto.account.unrealizedPnlUsd + signedSize * priceMove;
  const projectedEquity =
    marketDto.account.collateralUsd + projectedPnl + marketDto.account.fundingPnlUsd;
  const projectedBufferUsd = projectedEquity - marketDto.account.maintenanceMarginUsd;
  const projectedLiqDistancePct = liquidationDistance({
    price: nextPrice,
    liquidationPrice: marketDto.account.liquidationPrice,
    side: marketDto.account.side
  });
  const projectedScore = clamp(
    weightedScore([
      [projectedLiqDistancePct * 6, 0.48],
      [percent(projectedBufferUsd, Math.max(marketDto.account.positionNotionalUsd, 1)) * 9, 0.28],
      [marketDto.price.freshnessScore, 0.12],
      [100 - marketDto.marketStructure.stressUsedPct, 0.12]
    ]),
    0,
    100
  );

  return {
    shockPct: number(shockPct),
    nextPrice,
    projectedPnl,
    projectedEquity,
    projectedBufferUsd,
    projectedLiqDistancePct,
    projectedScore,
    projectedStatus: labelFromScore(projectedScore)
  };
}

function buildFlags(context) {
  const flags = [];
  if (context.liquidationDistancePct < 4) flags.push({ tone: "danger", label: "liq band tight" });
  if (context.marginBufferUsd < 0) flags.push({ tone: "danger", label: "below maintenance" });
  if (context.oracleFreshness < 55) flags.push({ tone: "danger", label: "oracle stale" });
  if (context.crankFreshness < 45) flags.push({ tone: "danger", label: "crank lag" });
  if (context.stressUsedPct > 75) flags.push({ tone: "danger", label: "stress cap hot" });
  if (context.insuranceCoveragePct < 100) flags.push({ tone: "warning", label: "insurance thin" });
  if (context.spreadBps > 35) flags.push({ tone: "warning", label: "wide spread" });
  if (context.market.engine?.catchupRequired) flags.push({ tone: "danger", label: "catchup required" });
  if (!flags.length) flags.push({ tone: "good", label: "read-only healthy" });
  return flags.slice(0, 4);
}

function liquidationDistance({ price, liquidationPrice, side }) {
  if (!price || !liquidationPrice) return 0;
  const raw = side === "short"
    ? (liquidationPrice - price) / price
    : (price - liquidationPrice) / price;
  return clamp(raw * 100, -100, 100);
}

function freshnessScore(age, maxAge) {
  const normalizedAge = number(age);
  const normalizedMax = Math.max(number(maxAge), 1);
  return clamp(100 - (normalizedAge / normalizedMax) * 100, 0, 100);
}

function weightedScore(parts) {
  const totalWeight = parts.reduce((sum, [, weight]) => sum + weight, 0);
  const total = parts.reduce((sum, [score, weight]) => sum + clamp(number(score), 0, 100) * weight, 0);
  return Math.round(total / totalWeight);
}

function labelFromScore(score) {
  if (score >= 72) return "stable";
  if (score >= 48) return "watch";
  return "risk";
}

function midpoint(a, b) {
  return (number(a) + number(b)) / 2;
}

function bps(delta, base) {
  return base ? (number(delta) / Math.abs(number(base))) * 10000 : 0;
}

function percent(value, base) {
  return base ? (number(value) / Math.abs(number(base))) * 100 : 0;
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function collectCliSections(input) {
  const sections = {
    market: input?.market,
    engine: input?.engine,
    account: input?.account,
    accounts: input?.accounts,
    bitmap: input?.bitmap,
    receipts: input?.receipts || input?.executionReceipts || input?.receiptTimeline,
    history: input?.history || input?.fundingHistory || input?.fundingSkewHistory
  };
  if (!input || typeof input !== "object") return sections;

  if (
    input.command &&
    (
      input.output !== undefined ||
      input.data !== undefined ||
      input.result !== undefined ||
      input.stdout !== undefined ||
      input.stdoutText !== undefined
    )
  ) {
    const output = cliOutputOf(input);
    sections[input.command] = output;
    mergeNamedCliOutput(sections, input.command, output);
    mergeCompositeCliOutput(sections, output);
  }

  for (const entry of input.commands || input.outputs || []) {
    if (!entry || typeof entry !== "object") continue;
    const name = entry.command || entry.name || entry.label || entry.kind;
    const output = cliOutputOf(entry);
    if (name) sections[name] = output;
    mergeNamedCliOutput(sections, name, output);
    mergeCompositeCliOutput(sections, output);
  }

  return {
    ...input,
    ...sections
  };
}

function mergeCompositeCliOutput(sections, output) {
  if (!output || typeof output !== "object" || Array.isArray(output)) return;
  for (const key of [
    "market",
    "header",
    "config",
    "params",
    "engine",
    "oracle",
    "accounts",
    "bitmap",
    "execution",
    "receipts",
    "executionReceipts",
    "receiptTimeline",
    "history",
    "fundingHistory",
    "fundingSkewHistory"
  ]) {
    if (output[key] && sections[key] === undefined) sections[key] = output[key];
  }
  if (output.slab && sections.market === undefined) sections.market = output;
  if (output.bestBuy || output.bestSell || output.effectiveSpreadBps !== undefined) {
    sections.bestPrice = output;
  }
}

function commandNames(input) {
  const names = [];
  if (input?.command) names.push(input.command);
  for (const entry of input?.commands || input?.outputs || []) {
    const name = entry?.command || entry?.name || entry?.label || entry?.kind;
    if (name) names.push(name);
  }
  return names;
}

function mergeNamedCliOutput(sections, name, output) {
  const key = normalizeKey(name || "");
  if (!key || !output || typeof output !== "object") return;
  if (key === "slabget") {
    mergeCompositeCliOutput(sections, output);
    if (!sections.market && !Array.isArray(output)) sections.market = output.market || output;
  }
  if (key === "slabparams") sections.params = output;
  if (key === "slabengine") sections.engine = { ...(sections.engine || {}), ...output };
  if (key === "slabaccount") sections.account = { ...(sections.account || {}), ...output };
  if (key === "slabaccounts") sections.accounts = output;
  if (key === "slabbitmap") sections.bitmap = output;
  if (key === "bestprice") sections.bestPrice = output;
  if (key === "listmarkets") sections.markets = output;
  if (["executionreceipts", "executionreceipt", "receipts", "receiptlog", "fillreceipts", "fills"].includes(key)) {
    sections.receipts = output;
  }
  if (isHistoryCommandName(key)) {
    sections.history = output;
  }
}

function hasCliSections(input) {
  return Object.keys(input || {}).some((key) =>
    [
      "slabHeader",
      "slabConfig",
      "slabEngine",
      "slabBitmap",
      "bestPrice",
      "best-price",
      "marketInfo",
      "receipts",
      "executionReceipts",
      "receiptTimeline",
      "fillReceipts",
      "fills",
      "history",
      "fundingHistory",
      "fundingSkewHistory"
    ].some(
      (alias) => normalizeKey(alias) === normalizeKey(key)
    )
  );
}

function marketListOf(scope) {
  const value = valueOf(scope, ["markets", "listMarkets", "list-markets"]);
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.markets)) return value.markets;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.accounts)) return value.accounts;
  return [];
}

function receiptListOf(...sources) {
  for (const source of sources) {
    if (!source) continue;
    const directRows = rowsOf(source);
    if (directRows.length && Array.isArray(source)) return directRows;
    const value = valueOf(source, ["receipts", "executionReceipts", "receiptTimeline", "fillReceipts", "fills"]);
    const rows = rowsOf(value);
    if (rows.length) return rows;
    const nested = valueOf(value, ["receipts", "executionReceipts", "receiptTimeline", "fillReceipts", "fills"]);
    const nestedRows = rowsOf(nested);
    if (nestedRows.length) return nestedRows;
  }
  return [];
}

function historyListOf(...sources) {
  for (const source of sources) {
    if (!source) continue;
    const directRows = rowsOf(source);
    if (directRows.length && Array.isArray(source)) return directRows;
    const value = valueOf(source, ["fundingSkew", "fundingHistory", "fundingSkewHistory", "history"]);
    const rows = rowsOf(value);
    if (rows.length) return rows;
    const nested = valueOf(value, ["fundingSkew", "fundingHistory", "fundingSkewHistory", "history"]);
    const nestedRows = rowsOf(nested);
    if (nestedRows.length) return nestedRows;
  }
  return [];
}

function isFundingHistoryInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const names = commandNames(input);
  if (names.length) return names.every(isHistoryCommandName);
  if (!historyListOf(input).length) return false;
  const nonHistoryAliases = [
    "markets",
    "market",
    "engine",
    "account",
    "accounts",
    "bitmap",
    "receipts",
    "executionReceipts",
    "receiptTimeline",
    "slabHeader",
    "slabConfig",
    "slabEngine",
    "slabBitmap",
    "bestPrice",
    "marketInfo"
  ];
  return !Object.keys(input).some((key) =>
    nonHistoryAliases.some((alias) => normalizeKey(alias) === normalizeKey(key))
  );
}

function isFundingHistoryArray(input) {
  if (!Array.isArray(input) || !input.length) return false;
  return input.every(isFundingHistoryRow);
}

function isFundingHistoryRow(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  return [
    "fundingBpsPerHour",
    "fundingRateBpsPerHour",
    "oiSkewPct",
    "openInterestUsd",
    "stressUsedPct",
    "oracleAgeSec",
    "sourceTimestamp"
  ].some((alias) => valueOf(row, [alias]) !== undefined);
}

function isReadOnlyRpcInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const account = objectOf(input, ["account", "accountInfo"], {});
  if (!nonEmptyObject(account)) return false;
  return knownText(valueOf(input, ["slab", "slabAddress", "pubkey"])) &&
    knownText(valueOf(input, ["programId", "program"])) &&
    (
      knownText(valueOf(account, ["owner", "programId"])) ||
      valueOf(account, ["decoded"]) !== undefined ||
      valueOf(account, ["dataLength", "dataLen", "space"]) !== undefined
    );
}

function isHistoryCommandName(value) {
  return HISTORY_COMMAND_KEYS.has(normalizeKey(value || ""));
}

function normalizeExecutionReceipts(rows, fallback = {}) {
  return rowsOf(rows).slice(0, 24).map((receipt, index) => {
    const bestBid = firstNumber(
      priceNumberOf(receipt, ["bestBid", "bid", "best_bid"], []),
      priceNumberOf(fallback, ["bestBid"], [])
    );
    const bestAsk = firstNumber(
      priceNumberOf(receipt, ["bestAsk", "ask", "best_ask"], []),
      priceNumberOf(fallback, ["bestAsk"], [])
    );
    const quotePrice = firstNumber(
      priceNumberOf(receipt, ["quotePriceUsd", "quotePrice", "quotedPriceUsd", "quotedPrice"], ["quotePrice"]),
      priceNumberOf(receipt, ["priceUsd"], ["price"])
    );
    const fillPrice = firstNumber(
      priceNumberOf(receipt, ["fillPriceUsd", "fillPrice", "executionPriceUsd", "executionPrice"], ["fillPrice"]),
      quotePrice
    );
    const markPrice = firstNumber(
      priceNumberOf(receipt, ["markPriceUsd", "markPrice", "mark"], ["markPrice"]),
      priceNumberOf(fallback, ["markPrice"], [])
    );
    const spreadBps = firstNumber(
      maybeNumberOf(receipt, ["spreadBps", "spread_bps", "effectiveSpreadBps"]),
      maybeNumberOf(fallback, ["spreadBps"]),
      bps(bestAsk - bestBid, midpoint(bestAsk, bestBid))
    );
    const impactBps = firstNumber(
      maybeNumberOf(receipt, ["impactBps", "priceImpactBps", "impact_bps"]),
      maybeNumberOf(fallback, ["impact10kBps", "impact_10k_bps"])
    );
    const markout1mBps = firstNumber(
      maybeNumberOf(receipt, ["markout1mBps", "markout_1m_bps", "markout60sBps"]),
      maybeNumberOf(fallback, ["markout1mBps", "markout_1m_bps"])
    );
    const markout5mBps = firstNumber(
      maybeNumberOf(receipt, ["markout5mBps", "markout_5m_bps", "markout300sBps"]),
      maybeNumberOf(fallback, ["markout5mBps", "markout_5m_bps"])
    );

    return {
      id: stringOf(receipt, ["id", "receiptId", "signature", "txid"], `receipt-${index + 1}`),
      label: stringOf(receipt, ["label", "kind", "venue", "route"], `fill ${index + 1}`),
      source: stringOf(receipt, ["source", "origin", "adapter"], "adapter"),
      sourceTimestamp: stringOf(receipt, ["sourceTimestamp", "timestamp", "observedAt", "filledAt", "ts"], ""),
      slot: numberOf(receipt, ["slot", "sourceSlot", "marketSlot"], 0),
      side: stringOf(receipt, ["side", "direction"], "fill"),
      notionalUsd: firstNumber(maybeNumberOf(receipt, ["notionalUsd", "sizeUsd", "quoteNotionalUsd"])),
      quotePrice,
      fillPrice,
      markPrice,
      bestBid,
      bestAsk,
      spreadBps,
      impactBps,
      markout1mBps,
      markout5mBps,
      routeLatencyMs: firstNumber(
        maybeNumberOf(receipt, ["routeLatencyMs", "latencyMs", "durationMs"]),
        maybeNumberOf(fallback, ["routeLatencyMs", "latencyMs"])
      ),
      priorityFeeMicrolamports: firstNumber(
        maybeNumberOf(receipt, ["priorityFeeMicrolamports", "priorityFee", "priorityFeeMicroLamports"]),
        maybeNumberOf(fallback, ["priorityFeeMicrolamports", "priorityFee"])
      ),
      oracleAgeSec: firstNumber(maybeNumberOf(receipt, ["oracleAgeSec", "priceAgeSec", "ageSecs"])),
      crankAgeSlots: firstNumber(maybeNumberOf(receipt, ["crankAgeSlots", "ageSlots"])),
      fundingBpsPerHour: firstNumber(maybeNumberOf(receipt, ["fundingBpsPerHour", "fundingRateBpsPerHour"])),
      fillQualityScore: clamp(
        firstNumber(maybeNumberOf(receipt, ["fillQualityScore", "qualityScore"]), maybeNumberOf(fallback, ["fillQualityScore"])),
        0,
        100
      )
    };
  });
}

function scopedMarket(scope, market, index) {
  const inheritedMarket = objectOf(scope, ["market", "marketInfo", "metadata", "instrument"], {});
  const perMarket = market && typeof market === "object" ? market : { symbol: String(market || `PERP-${index + 1}`) };
  return {
    ...scope,
    ...perMarket,
    market: {
      ...inheritedMarket,
      ...perMarket
    }
  };
}

function summarizeAccounts(value) {
  const rows = rowsOf(value);
  const output = {};
  if (rows.length) output.activeAccounts = rows.length;
  const staleCount = rows.filter((row) => Boolean(valueOf(row, ["stale", "isStale", "catchupRequired"]))).length;
  if (staleCount) output.staleAccounts = staleCount;
  return output;
}

function summarizeBitmap(bitmap) {
  if (!bitmap || typeof bitmap !== "object") return {};
  const output = {};
  const used = firstDefinedNumber(
    maybeNumberOf(bitmap, ["numUsed", "numUsedAccounts", "usedAccounts"]),
    Array.isArray(bitmap.usedIndices) ? bitmap.usedIndices.length : undefined,
    Array.isArray(bitmap.indices) ? bitmap.indices.length : undefined
  );
  const max = firstDefinedNumber(maybeNumberOf(bitmap, ["maxAccounts", "max_accounts", "capacity"]));
  if (used !== undefined) output.activeAccounts = used;
  if (max !== undefined) output.maxAccounts = max;
  return output;
}

function cliOutputOf(entry) {
  const value = entry.output ?? entry.data ?? entry.result ?? entry.stdout ?? entry.stdoutText ?? entry.json ?? entry;
  if (typeof value !== "string") {
    assertReadOnlySnapshot(value, "cli.output");
    return value;
  }
  let parsed;
  try {
    parsed = parsePercolatorJson(value);
  } catch {
    return value;
  }
  assertReadOnlySnapshot(parsed, "cli.stdout");
  return parsed;
}

function objectOf(source, aliases, fallback) {
  const value = valueOf(source, aliases);
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return fallback;
}

function arrayOf(source, aliases, fallback) {
  const value = valueOf(source, aliases);
  return Array.isArray(value) ? value : fallback;
}

function stringOf(source, aliases, fallback = "") {
  const value = valueOf(source, aliases);
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function numberOf(source, aliases, fallback = 0) {
  const value = valueOf(source, aliases);
  if (value === undefined || value === null || value === "") return fallback;
  return number(value);
}

function maybeNumberOf(source, aliases) {
  const value = valueOf(source, aliases);
  if (value === undefined || value === null || value === "") return undefined;
  return number(value);
}

function priceNumberOf(source, usdAliases, rawAliases = []) {
  for (const alias of usdAliases) {
    const value = maybeNumberOf(source, [alias]);
    if (value === undefined) continue;
    if (normalizeKey(alias).includes("usd")) return value;
    const decimals = firstDefinedNumber(maybeNumberOf(source, ["decimals", "priceDecimals", "price_decimals"]));
    if (decimals !== undefined && Math.abs(value) >= 10 ** Math.min(decimals, 4)) {
      return value / 10 ** decimals;
    }
    if (decimals === undefined && Math.abs(value) > 1000000) continue;
    return value;
  }

  const raw = firstDefinedNumber(maybeNumberOf(source, rawAliases));
  if (raw === undefined) return undefined;

  const decimals = firstDefinedNumber(maybeNumberOf(source, ["decimals", "priceDecimals", "price_decimals"]));
  if (decimals === undefined || decimals < 0 || decimals > 18) return undefined;
  return raw / 10 ** decimals;
}

function valueOf(source, aliases, fallback) {
  if (!source || typeof source !== "object") return fallback;
  const entries = Object.entries(source);
  for (const alias of aliases) {
    const wanted = normalizeKey(alias);
    const found = entries.find(([key]) => normalizeKey(key) === wanted);
    if (found && found[1] !== undefined && found[1] !== null) return found[1];
  }
  return fallback;
}

function firstItem(value) {
  if (Array.isArray(value)) return value[0] || {};
  if (value?.items && Array.isArray(value.items)) return value.items[0] || {};
  if (value?.rows && Array.isArray(value.rows)) return value.rows[0] || {};
  if (value?.accounts && Array.isArray(value.accounts)) return value.accounts[0] || {};
  if (value && typeof value === "object") return value;
  return {};
}

function rowsOf(value) {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object");
  if (Array.isArray(value?.items)) return rowsOf(value.items);
  if (Array.isArray(value?.rows)) return rowsOf(value.rows);
  if (Array.isArray(value?.accounts)) return rowsOf(value.accounts);
  return [];
}

function firstNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const next = number(value);
    if (Number.isFinite(next)) return next;
  }
  return 0;
}

function firstDefinedNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const next = number(value);
    if (Number.isFinite(next)) return next;
  }
  return undefined;
}

function parseSymbol(symbol) {
  const [base = "PERP", quote = "USDC"] = String(symbol)
    .replace(/-?PERP$/i, "")
    .split(/[-/]/)
    .filter(Boolean);
  return { base: base.toUpperCase(), quote: quote.toUpperCase() };
}

function extractJsonPayload(source) {
  const starts = [];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "{" || source[index] === "[") starts.push(index);
  }
  for (const start of starts) {
    const payload = balancedJsonPayload(source, start);
    if (!payload) continue;
    try {
      JSON.parse(payload);
      return payload;
    } catch {
      // Keep scanning; captured logs can contain bracketed prefixes before JSON.
    }
  }
  return "";
}

function balancedJsonPayload(source, start) {
  const opener = source[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === opener) depth += 1;
    if (char === closer) depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  return "";
}

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function number(value) {
  const next = Number(typeof value === "string" ? value.replace(/[$,%_\s,]/g, "") : value);
  return Number.isFinite(next) ? next : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
