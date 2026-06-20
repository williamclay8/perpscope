import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createImportedSnapshotState,
  DEMO_CLI_PATH,
  fetchCliDemoSnapshot
} from "../src/app.js";

const cliBundleText = readFileSync(
  new URL("../examples/percolator-cli.bundle.json", import.meta.url),
  "utf8"
);

test("loads Try CLI demo through the same import state path", async () => {
  let requestedUrl = "";
  const imported = await fetchCliDemoSnapshot(async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      text: async () => cliBundleText
    };
  });
  const nextState = createImportedSnapshotState(imported, {
    label: "demo cli loaded",
    detailPrefix: DEMO_CLI_PATH.replace(/^\.\//, "")
  });

  assert.equal(requestedUrl, DEMO_CLI_PATH);
  assert.equal(nextState.selectedMarketId, "sol-perp");
  assert.equal(nextState.importStatus.label, "demo cli loaded");
  assert.equal(nextState.importStatus.detail, "examples/percolator-cli.bundle.json: 1 market import, 7 commands");
  assert.equal(nextState.snapshot.source.commandSet.length, 7);
});

test("surfaces Try CLI demo fetch failures", async () => {
  await assert.rejects(
    () => fetchCliDemoSnapshot(async () => ({ ok: false, text: async () => "" })),
    /CLI demo fixture unavailable/
  );
});
