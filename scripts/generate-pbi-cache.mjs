import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDataCacheEnvelope } from "../src/utils/defaultDataCache.js";
import { parseComprasPbiRows } from "../src/utils/parseComprasPbi.js";
import { parseVentasPbiRows } from "../src/utils/parseVentasPbi.js";
import { extractRows, loadEnvFile, requestPbiService, requestPbiToken } from "./pbi-api-client.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const cacheDir = path.join(rootDir, "Data", "_cache");
const COMPRAS_PBI_CACHE = path.join(cacheDir, "compras-pbi.json");
const VENTAS_PBI_CACHE = path.join(cacheDir, "ventas-pbi.json");

async function writeCacheFile(cachePath, payload) {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(createDataCacheEnvelope(payload)));
}

async function buildServiceCache({ token, serviceName, cachePath, parser }) {
  const minYear = Number(process.env.PBI_CACHE_MIN_YEAR || 2024);
  const payload = await requestPbiService(serviceName, token);
  const rows = extractRows(payload);
  const parsed = parser(rows, undefined, { minYear });
  await writeCacheFile(cachePath, parsed);
  console.log(
    `[pbi-cache] ${serviceName}: cache actualizada (${rows.length} lineas API => ${parsed.data.length} documentos, desde ${minYear})`
  );
}

async function buildPbiCaches() {
  loadEnvFile(rootDir);
  const token = await requestPbiToken();
  await buildServiceCache({
    token,
    serviceName: "compras",
    cachePath: COMPRAS_PBI_CACHE,
    parser: parseComprasPbiRows,
  });
  await buildServiceCache({
    token,
    serviceName: "ventas",
    cachePath: VENTAS_PBI_CACHE,
    parser: parseVentasPbiRows,
  });
}

buildPbiCaches().catch((error) => {
  console.error("[pbi-cache] error", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
