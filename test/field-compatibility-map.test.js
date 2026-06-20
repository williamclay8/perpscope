import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const fieldMap = JSON.parse(
  readFileSync(new URL("../examples/field-compatibility-map.json", import.meta.url), "utf8")
);
const fieldMapDoc = readFileSync(
  new URL("../docs/field-compatibility-map.md", import.meta.url),
  "utf8"
);

test("documents required compatibility fields as danger severity", () => {
  const required = new Map(fieldMap.requiredFields.map((entry) => [entry.field, entry]));

  for (const field of ["market.slab", "market.program", "price.mark"]) {
    assert.equal(required.get(field)?.severity, "danger");
    assert.ok(required.get(field)?.aliases.length >= 3);
    assert.match(fieldMapDoc, new RegExp(field.replace(".", "\\.")));
  }
});

test("documents optional fields that make the cockpit trader-grade", () => {
  const optional = new Map(fieldMap.optionalFields.map((entry) => [entry.field, entry]));

  for (const field of [
    "price.publishAgeSec",
    "crank.ageSlots",
    "funding.bpsPerHour",
    "marketStructure.openInterestUsd",
    "account.positionNotionalUsd",
    "execution.bestBid/bestAsk",
    "execution.receipts",
    "history.fundingSkew"
  ]) {
    assert.equal(optional.get(field)?.severity, "warning");
    assert.match(fieldMapDoc, new RegExp(field.replace(".", "\\.").replace("/", "\\/")));
  }
});

test("keeps Watchtower and carry-history dependencies machine-readable", () => {
  assert.deepEqual(
    fieldMap.watchtowerSignals.map((signal) => signal.id),
    ["runway", "freshness", "execution", "impact", "carry", "solvency"]
  );
  assert.ok(fieldMap.watchtowerSignals.find((signal) => signal.id === "carry").fields.includes("funding.bpsPerHour"));
  assert.ok(fieldMap.carryHistoryRows.commands.includes("funding-skew-history"));
  assert.ok(fieldMap.carryHistoryRows.requiredForTrend.includes("fundingBpsPerHour"));
});

test("keeps safety boundaries and fixture references explicit", () => {
  for (const key of ["walletPath", "privateKey", "signer", "transaction", "order"]) {
    assert.ok(fieldMap.rejectedFieldKeys.some((field) => field.includes(key)));
    assert.match(fieldMapDoc, new RegExp(key));
  }

  for (const fixture of fieldMap.safeFixtures) {
    assert.ok(existsSync(new URL(`../${fixture}`, import.meta.url)), `${fixture} should exist`);
  }
});
