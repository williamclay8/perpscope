import { createServer } from "node:http";
import { createDecoderHttpHandler } from "../src/lib/percolator-decoder-worker.js";

const port = Number(process.env.PORT || 8787);
const cluster = process.env.PERPSCOPE_DECODER_CLUSTER || "devnet";
const rpcUrl = process.env.PERPSCOPE_DECODER_RPC_URL || undefined;
const marketDirectoryUrl = process.env.PERPSCOPE_MARKET_DIRECTORY_URL || undefined;
const allowedOrigin = process.env.PERPSCOPE_ALLOWED_ORIGIN || undefined;
const cacheTtlMs = Number(process.env.PERPSCOPE_DECODER_CACHE_TTL_MS || 12000);
const decodeTimeoutMs = Number(process.env.PERPSCOPE_DECODER_TIMEOUT_MS || 10000);

const server = createServer(createDecoderHttpHandler({
  allowedOrigin,
  cacheTtlMs,
  cluster,
  decodeTimeoutMs,
  marketDirectoryUrl,
  rpcUrl
}));

server.listen(port, "0.0.0.0", () => {
  console.log(`PerpScope decoder worker listening on 0.0.0.0:${port}`);
});
