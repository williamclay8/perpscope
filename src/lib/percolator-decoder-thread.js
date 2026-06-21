import { parentPort, workerData } from "node:worker_threads";
import { buildPerpScopeDecodedSnapshot } from "./percolator-decoder-worker.js";

try {
  const payload = await buildPerpScopeDecodedSnapshot(workerData || {});
  parentPort.postMessage({ ok: true, payload });
} catch (error) {
  parentPort.postMessage({
    ok: false,
    message: error?.message || "Decoded source worker failed."
  });
}
