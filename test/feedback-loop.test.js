import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const feedbackLoop = readFileSync(
  new URL("../docs/feedback-loop.md", import.meta.url),
  "utf8"
);
const issueTemplate = readFileSync(
  new URL("../.github/ISSUE_TEMPLATE/decoded-percolator-shape.yml", import.meta.url),
  "utf8"
);

test("feedback loop exposes a structured decoded-shape intake path", () => {
  assert.match(feedbackLoop, /issues\/new\?template=decoded-percolator-shape\.yml/);
  assert.match(issueTemplate, /name: Decoded Percolator shape/);
  assert.match(issueTemplate, /Sanitized read-only payload/);
  assert.match(issueTemplate, /Can this become a public fixture\?/);
});

test("feedback loop documents triage buckets and safety boundary", () => {
  for (const label of ["compatibility", "fixture", "risk-signal", "terminal-adapter", "docs"]) {
    assert.match(feedbackLoop, new RegExp(`\`${label}\``));
  }

  for (const unsafe of ["wallet paths", "private keys", "mnemonics", "signatures", "transactions", "instructions", "order payloads", "API keys"]) {
    assert.match(feedbackLoop, new RegExp(unsafe));
    assert.match(issueTemplate, new RegExp(unsafe));
  }
});
