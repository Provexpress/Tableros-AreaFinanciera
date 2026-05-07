import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { createDataCacheEnvelope } from "../src/utils/defaultDataCache.js";
import { parseWorkbook } from "../src/utils/parseExcel.js";
import { parseNotasWorkbooks } from "../src/utils/parseNotasCredito.js";
import { parseVentasAcusesWorkbooks } from "../src/utils/parseVentasAcuses.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "Data");
const cacheDir = path.join(dataDir, "_cache");

const FACTURAS_SOURCE = path.join(dataDir, "Control Facturas.xlsx");
const FACTURAS_CACHE = path.join(cacheDir, "control-facturas.json");
const WEEKLY_SOURCE = path.join(dataDir, "reporte semanal de facturacion.xlsx");
const NC_SOURCE = path.join(dataDir, "NOTAS CREDITO 2026.xlsx");
const NOTAS_CACHE = path.join(cacheDir, "notas-credito.json");
const VENTAS_ACUSES_CACHE = path.join(cacheDir, "ventas-acuses.json");
const SHARED_PARSER_DEPS = [
  path.join(rootDir, "scripts", "generate-data-cache.mjs"),
  path.join(rootDir, "src", "utils", "dateUtils.js"),
  path.join(rootDir, "src", "utils", "defaultDataCache.js"),
  path.join(rootDir, "src", "utils", "numberUtils.js"),
  path.join(rootDir, "src", "utils", "textUtils.js"),
];
const FACTURAS_DEPS = [
  FACTURAS_SOURCE,
  path.join(rootDir, "src", "utils", "parseExcel.js"),
  ...SHARED_PARSER_DEPS,
];
const NOTAS_DEPS = [
  WEEKLY_SOURCE,
  NC_SOURCE,
  path.join(rootDir, "src", "utils", "parseExcel.js"),
  path.join(rootDir, "src", "utils", "parseNotasCredito.js"),
  ...SHARED_PARSER_DEPS,
];
const VENTAS_ACUSES_STATIC_DEPS = [
  path.join(rootDir, "src", "utils", "parseVentasAcuses.js"),
  ...SHARED_PARSER_DEPS,
];

async function getStats(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

async function isCacheFresh(cachePath, sourcePaths) {
  const cacheStats = await getStats(cachePath);
  if (!cacheStats) {
    return false;
  }

  const sourceStats = await Promise.all(sourcePaths.map((filePath) => getStats(filePath)));
  return sourceStats.every((stats) => stats && stats.mtimeMs <= cacheStats.mtimeMs);
}

async function writeCacheFile(cachePath, payload) {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(createDataCacheEnvelope(payload)));
}

async function findVentasAcusesSources() {
  const entries = await fs.readdir(dataDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /acuse/i.test(name) && /\.xlsx$/i.test(name) && !/^~\$/.test(name))
    .map((name) => path.join(dataDir, name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b), "es"));
}

async function buildFacturasCache() {
  if (await isCacheFresh(FACTURAS_CACHE, FACTURAS_DEPS)) {
    console.log("[data-cache] facturas: cache vigente");
    return;
  }

  const workbook = XLSX.readFile(FACTURAS_SOURCE, { cellDates: true });
  const parsed = await parseWorkbook(workbook, path.basename(FACTURAS_SOURCE));
  await writeCacheFile(FACTURAS_CACHE, parsed);
  console.log("[data-cache] facturas: cache actualizada");
}

async function buildNotasCache() {
  if (await isCacheFresh(NOTAS_CACHE, NOTAS_DEPS)) {
    console.log("[data-cache] notas: cache vigente");
    return;
  }

  const weeklyWorkbook = XLSX.readFile(WEEKLY_SOURCE, { cellDates: true, bookFiles: true });
  const ncWorkbook = XLSX.readFile(NC_SOURCE, { cellDates: true });
  const parsed = await parseNotasWorkbooks(
    weeklyWorkbook,
    ncWorkbook,
    `${path.basename(WEEKLY_SOURCE)} + ${path.basename(NC_SOURCE)}`
  );
  await writeCacheFile(NOTAS_CACHE, parsed);
  console.log("[data-cache] notas: cache actualizada");
}

async function buildVentasAcusesCache() {
  const sources = await findVentasAcusesSources();
  if (!sources.length) {
    console.log("[data-cache] ventas acuses: no hay archivos *ACUSES*.xlsx");
    return;
  }

  if (await isCacheFresh(VENTAS_ACUSES_CACHE, [...sources, ...VENTAS_ACUSES_STATIC_DEPS])) {
    console.log("[data-cache] ventas acuses: cache vigente");
    return;
  }

  const workbooks = sources.map((sourcePath) => ({
    sourceName: path.basename(sourcePath),
    workbook: XLSX.readFile(sourcePath, { cellDates: true }),
  }));
  const parsed = await parseVentasAcusesWorkbooks(workbooks);
  await writeCacheFile(VENTAS_ACUSES_CACHE, parsed);
  console.log(`[data-cache] ventas acuses: cache actualizada (${parsed.data.length} filas)`);
}

async function main() {
  await buildFacturasCache();
  await buildNotasCache();
  await buildVentasAcusesCache();
}

main().catch((error) => {
  console.error("[data-cache] error", error);
  process.exitCode = 1;
});
