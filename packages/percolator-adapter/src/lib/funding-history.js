const HISTORY_COMMANDS = new Set([
  "fundinghistory",
  "fundingskewhistory",
  "fundingrates",
  "skewhistory",
  "marketcarryhistory"
]);
const MUTATING_KEYS = new Set([
  "instruction",
  "instructions",
  "order",
  "orders",
  "send",
  "sendtransaction",
  "sign",
  "secretkey",
  "signature",
  "signer",
  "signtransaction",
  "transaction",
  "transactions",
  "privatekey",
  "keypair",
  "mnemonic",
  "seed",
  "wallet",
  "walletadapter",
  "walletpath"
]);

export function normalizeFundingSkewHistory(input, fallbackMarket = {}) {
  const source = typeof input === "string" ? parseHistoryJson(input) : input;
  assertReadOnlyHistory(source, "fundingHistory");
  assertReadOnlyHistory(fallbackMarket, "fundingHistory.fallbackMarket");
  const rows = fundingRowsOf(source);
  const fallbackRows = rows.length ? rows : fallbackRowsOf(fallbackMarket);
  return fallbackRows
    .map((row, index) => normalizeFundingRow(row, fallbackMarket, index))
    .sort(compareHistoryRows)
    .slice(-48);
}

export function summarizeFundingSkewHistory(input, fallbackMarket = {}) {
  const rows = (Array.isArray(input) ? input.slice() : normalizeFundingSkewHistory(input, fallbackMarket))
    .sort(compareHistoryRows);
  const latest = rows[rows.length - 1] || normalizeFundingRow({}, fallbackMarket, 0);
  return {
    latest,
    count: rows.length,
    fundingAvgBpsPerHour: mean(rows.map((row) => row.fundingBpsPerHour)),
    oiSkewAvgPct: mean(rows.map((row) => row.oiSkewPct)),
    stressMaxPct: Math.max(0, ...rows.map((row) => row.stressUsedPct)),
    oracleAgeMaxSec: Math.max(0, ...rows.map((row) => row.oracleAgeSec)),
    tone: historyTone(latest)
  };
}

function fundingRowsOf(value) {
  if (!value) return [];
  if (Array.isArray(value)) return rowsOf(value);
  if (typeof value !== "object") return [];

  if (value.command && isHistoryCommand(value.command)) {
    return rowsOf(value.output ?? value.data ?? value.result ?? value.stdout ?? value.stdoutText ?? value.rows ?? value.items);
  }

  for (const entry of value.commands || value.outputs || []) {
    const name = entry?.command || entry?.name || entry?.label || entry?.kind;
    if (!isHistoryCommand(name)) continue;
    const output = entry.output ?? entry.data ?? entry.result ?? entry.stdout ?? entry.stdoutText ?? entry.rows ?? entry.items;
    const parsed = typeof output === "string" ? parseHistoryJson(output) : output;
    assertReadOnlyHistory(parsed, `fundingHistory.${name || "command"}`);
    const rows = rowsOf(parsed);
    if (rows.length) return rows;
  }

  for (const key of ["fundingSkew", "fundingHistory", "fundingSkewHistory", "history", "rows", "items"]) {
    const rows = rowsOf(value[key]);
    if (rows.length) return rows;
  }

  return [];
}

function fallbackRowsOf(market) {
  const rows = rowsOf(market.history?.fundingSkew || market.history);
  if (rows.length) return rows;
  if (!market || typeof market !== "object") return [];
  return [market];
}

function normalizeFundingRow(row, market, index) {
  const longOi = firstNumber(row.longOpenInterestUsd, row.longOiUsd, row.long_oi_usd, row.marketStructure?.longOpenInterestUsd, market.marketStructure?.longOpenInterestUsd);
  const shortOi = firstNumber(row.shortOpenInterestUsd, row.shortOiUsd, row.short_oi_usd, row.marketStructure?.shortOpenInterestUsd, market.marketStructure?.shortOpenInterestUsd);
  const openInterest = firstNumber(row.openInterestUsd, row.oiUsd, row.open_interest_usd, row.marketStructure?.openInterestUsd, longOi + shortOi, market.marketStructure?.openInterestUsd);
  const stressUsedPct = firstNumber(
    row.stressUsedPct,
    row.stressPct,
    pctFromBps(row.stressConsumedBps, row.stressLimitBps),
    market.marketStructure?.stressUsedPct
  );
  const oracleAgeSec = firstNumber(row.oracleAgeSec, row.publishAgeSec, row.ageSecs, row.priceAgeSec, market.price?.publishAgeSec);

  return {
    id: stringOf(row.id, row.label, `history-${index + 1}`),
    label: stringOf(row.label, row.window, row.sourceTimestamp, `point ${index + 1}`),
    source: stringOf(row.source, row.origin, market.sourceStatus, "adapter"),
    sourceTimestamp: stringOf(row.sourceTimestamp, row.timestamp, row.observedAt, row.ts, ""),
    slot: firstNumber(row.slot, row.sourceSlot, row.marketSlot, market.currentSlot),
    fundingBpsPerHour: firstNumber(row.fundingBpsPerHour, row.fundingRateBpsPerHour, row.funding_bps_per_hour, market.funding?.bpsPerHour),
    longOpenInterestUsd: longOi,
    shortOpenInterestUsd: shortOi,
    openInterestUsd: openInterest,
    oiSkewPct: firstNumber(row.oiSkewPct, row.skewPct, pct(longOi - shortOi, openInterest), market.marketStructure?.oiSkewPct),
    stressUsedPct,
    oracleAgeSec
  };
}

function historyTone(row) {
  if (Math.abs(row.fundingBpsPerHour) >= 3.2 || Math.abs(row.oiSkewPct) >= 48 || row.stressUsedPct >= 78 || row.oracleAgeSec >= 8) {
    return "danger";
  }
  if (Math.abs(row.fundingBpsPerHour) >= 1.4 || Math.abs(row.oiSkewPct) >= 24 || row.stressUsedPct >= 54 || row.oracleAgeSec >= 5) {
    return "warning";
  }
  return "good";
}

function isHistoryCommand(value) {
  return HISTORY_COMMANDS.has(normalizeKey(value || ""));
}

function rowsOf(value) {
  if (typeof value === "string") {
    const parsed = parseHistoryJson(value);
    assertReadOnlyHistory(parsed, "fundingHistory.stdout");
    return rowsOf(parsed);
  }
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object");
  if (Array.isArray(value?.rows)) return rowsOf(value.rows);
  if (Array.isArray(value?.items)) return rowsOf(value.items);
  if (Array.isArray(value?.history)) return rowsOf(value.history);
  if (Array.isArray(value?.fundingSkew)) return rowsOf(value.fundingSkew);
  if (Array.isArray(value?.fundingHistory)) return rowsOf(value.fundingHistory);
  if (Array.isArray(value?.fundingSkewHistory)) return rowsOf(value.fundingSkewHistory);
  return [];
}

function pct(value, base) {
  const denominator = Math.abs(number(base));
  return denominator ? (number(value) / denominator) * 100 : 0;
}

function pctFromBps(value, limit) {
  const denominator = Math.abs(number(limit));
  if (!denominator) return undefined;
  return (number(value) / denominator) * 100;
}

function mean(values) {
  const clean = values.map(number).filter(Number.isFinite);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function firstNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const next = number(value);
    if (Number.isFinite(next)) return next;
  }
  return 0;
}

function stringOf(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return "";
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function number(value) {
  const next = Number(typeof value === "string" ? value.replace(/[$,%_\s,]/g, "") : value);
  return Number.isFinite(next) ? next : 0;
}

function compareHistoryRows(a, b) {
  const slotA = maybeNumber(a?.slot);
  const slotB = maybeNumber(b?.slot);
  if (slotA !== undefined && slotB !== undefined && (slotA || slotB)) return slotA - slotB;
  const timeA = maybeTime(a?.sourceTimestamp);
  const timeB = maybeTime(b?.sourceTimestamp);
  if (timeA !== undefined && timeB !== undefined) return timeA - timeB;
  return 0;
}

function maybeNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const next = number(value);
  return Number.isFinite(next) ? next : undefined;
}

function maybeTime(value) {
  if (!value) return undefined;
  const next = Date.parse(value);
  return Number.isFinite(next) ? next : undefined;
}

function assertReadOnlyHistory(value, path = "fundingHistory") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizeKey(key);
    const nextPath = `${path}.${key}`;
    if (isMutatingKey(normalized)) {
      throw new Error(`Refusing mutating field in funding history: ${nextPath}`);
    }
    if (child && typeof child === "object") assertReadOnlyHistory(child, nextPath);
  }
}

function isMutatingKey(key) {
  if (MUTATING_KEYS.has(key)) return true;
  return key.endsWith("secret") || key.endsWith("privatekey") || key.endsWith("keypair") || key.endsWith("mnemonic") || key.endsWith("seed");
}

function parseHistoryJson(text) {
  const source = String(text).trim();
  try {
    return JSON.parse(source);
  } catch {
    const extracted = extractJsonPayload(source);
    if (!extracted) throw new Error("No JSON payload found.");
    return JSON.parse(extracted);
  }
}

function extractJsonPayload(source) {
  const starts = ["{", "["]
    .map((char) => source.indexOf(char))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
  for (const start of starts) {
    const end = findJsonEnd(source, start);
    if (end > start) return source.slice(start, end + 1);
  }
  return "";
}

function findJsonEnd(source, start) {
  const open = source[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
    } else if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}
