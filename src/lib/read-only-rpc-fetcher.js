import { normalizePercolatorSnapshot } from "./percolator-adapter.js";

const PERP_SCOPE_MAGIC_HEX = "50455243";
const MIN_SLAB_DATA_LENGTH = 128;
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
  "wallet",
  "walletadapter",
  "walletpath"
]);

export function validateReadOnlyRpcRequest(request) {
  const checked = validateReadOnlyRpcTarget(request);
  const account = request.account || request.accountInfo || {};
  const owner = stringOf(account.owner || account.programId);
  const dataLength = numberOf(account.dataLength ?? account.dataLen ?? account.space);
  const magic = stringOf(account.magic || account.discriminator || account.decoded?.header?.magic);

  if (!owner) throw new Error("Read-only RPC request requires account owner.");
  if (!dataLength) throw new Error("Read-only RPC request requires account data length.");
  if (!magic) throw new Error("Read-only RPC request requires account magic.");
  if (owner && owner !== checked.programId) {
    throw new Error("RPC account owner does not match the requested program id.");
  }
  if (dataLength && dataLength < MIN_SLAB_DATA_LENGTH) {
    throw new Error("RPC account data length is too small for a Percolator slab.");
  }
  if (magic && normalizeHex(magic) !== PERP_SCOPE_MAGIC_HEX) {
    throw new Error("RPC account magic does not match a Percolator slab.");
  }

  return {
    ...checked,
    owner,
    dataLength,
    magic
  };
}

function validateReadOnlyRpcTarget(request) {
  if (!request || typeof request !== "object") {
    throw new Error("Read-only RPC request must be an object.");
  }

  assertNoMutatingFields(request);

  const slab = stringOf(request.slab || request.slabAddress || request.pubkey);
  const programId = stringOf(request.programId || request.program || request.owner);

  if (!slab) throw new Error("Read-only RPC request requires a slab address.");
  if (!programId) throw new Error("Read-only RPC request requires a program id.");

  return {
    slab,
    programId
  };
}

export function buildReadOnlyRpcSnapshot(request) {
  const checked = validateReadOnlyRpcRequest(request);
  const account = request.account || request.accountInfo || {};
  const decoded = account.decoded || {};
  if (!Object.keys(decoded).length) {
    throw new Error("Read-only RPC fixture requires decoded slab data.");
  }

  const market = {
    ...(request.market || decoded.market || {}),
    slab: checked.slab,
    program: checked.programId
  };
  const commands = [
    {
      command: "slab:get",
      output: {
        slab: checked.slab,
        dataLen: checked.dataLength,
        header: decoded.header || {},
        config: decoded.config || {},
        market
      }
    }
  ];

  if (decoded.params) commands.push({ command: "slab:params", output: decoded.params });
  if (decoded.engine) commands.push({ command: "slab:engine", output: decoded.engine });
  if (decoded.bestPrice) commands.push({ command: "best-price", output: decoded.bestPrice });
  if (decoded.accounts) commands.push({ command: "slab:accounts", output: decoded.accounts });
  if (decoded.bitmap) commands.push({ command: "slab:bitmap", output: decoded.bitmap });

  return normalizePercolatorSnapshot({
    label: request.label || "Read-only RPC slab fixture",
    cluster: request.cluster || "rpc fixture",
    currentSlot: request.currentSlot || decoded.currentSlot,
    market,
    account: decoded.accountUsd,
    commands
  });
}

export async function fetchReadOnlyRpcSnapshot(request, client) {
  if (!client || typeof client.getAccountInfo !== "function") {
    throw new Error("Read-only RPC fetcher requires a client with getAccountInfo().");
  }
  const checked = validateReadOnlyRpcTarget(request);
  const accountInfo = await client.getAccountInfo(checked.slab);
  return buildReadOnlyRpcSnapshot({
    ...request,
    slab: checked.slab,
    account: {
      ...(request.account || {}),
      ...accountInfo
    }
  });
}

function assertNoMutatingFields(value, path = "request") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizeKey(key);
    if (isMutatingKey(normalized)) {
      throw new Error(`Refusing mutating field in read-only RPC request: ${path}.${key}`);
    }
    if (child && typeof child === "object") assertNoMutatingFields(child, `${path}.${key}`);
  }
}

function isMutatingKey(key) {
  if (MUTATING_KEYS.has(key)) return true;
  return key.endsWith("secret") || key.endsWith("privatekey") || key.endsWith("keypair");
}

function stringOf(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function numberOf(value) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function normalizeHex(value) {
  return String(value).toLowerCase().replace(/^0x/, "");
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}
