import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractDataCachePayload } from "../src/utils/defaultDataCache.js";
import { parseSpreadsheetDate } from "../src/utils/dateUtils.js";
import { parseFlexibleNumber } from "../src/utils/numberUtils.js";
import { cleanText, normalizeText } from "../src/utils/textUtils.js";
import { extractRows, loadEnvFile, requestPbiService, requestPbiToken } from "./pbi-api-client.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const facturasCachePath = path.join(rootDir, "Data", "_cache", "control-facturas.json");

function normalizeGroupKey(value) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b(SAS|SA|S A S|S A|LTDA|LTD|COLOMBIA|DE|DEL|LA|EL|LOS|LAS)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCategoryKey(value) {
  const key = normalizeGroupKey(value || "Sin categoria");
  if (key === "TECNOLOGIA") return "Tecnologia";
  if (key === "PAC TEC" || key === "PACTEC") return "PAC/Tecnologia";
  return cleanText(value) || "Sin categoria";
}

function getPeriodFromApiRow(row) {
  const parsed = parseSpreadsheetDate(row.Fecha_Emision);
  return parsed?.isValid?.() ? parsed.format("YYYY-MM") : "";
}

function getPeriodFromExcelRow(row) {
  const periodo = cleanText(row.periodo);
  if (/^\d{4}-\d{2}$/.test(periodo)) return periodo;
  const parsed = parseSpreadsheetDate(row.fechaIso || row.fecha);
  return parsed?.isValid?.() ? parsed.format("YYYY-MM") : "";
}

function isCreditNote(row) {
  return Number(row.signoDocumento || 1) < 0 || normalizeText(row.tipoDocNormalizado || row.tipoDoc).includes("nota");
}

function addMetric(map, key, amount, count = 1) {
  if (!key) return;
  const current = map.get(key) || { total: 0, count: 0 };
  current.total += amount;
  current.count += count;
  map.set(key, current);
}

function summarizeApiCompras(rows, allowedPeriods = null) {
  const byPeriod = new Map();
  const byProvider = new Map();
  const byCategory = new Map();
  let total = 0;
  let count = 0;
  let invalidRows = 0;

  for (const row of rows) {
    const amount = parseFlexibleNumber(row.Valor_Mercancia, null);
    const period = getPeriodFromApiRow(row);
    if (!period || amount == null) {
      invalidRows += 1;
      continue;
    }
    if (allowedPeriods && !allowedPeriods.has(period)) {
      continue;
    }

    const provider = normalizeGroupKey(row.Empresa || row.Identificacion || "Sin proveedor");
    const category = normalizeCategoryKey(row.Categoria);
    total += amount;
    count += 1;
    addMetric(byPeriod, period, amount);
    addMetric(byProvider, provider, amount);
    addMetric(byCategory, category, amount);
  }

  return { total, count, invalidRows, byPeriod, byProvider, byCategory };
}

function summarizeExcelCompras(rows) {
  const byPeriod = new Map();
  const byProvider = new Map();
  const byCategory = new Map();
  let grossTotal = 0;
  let netTotal = 0;
  let count = 0;
  let invalidRows = 0;

  for (const row of rows) {
    const amount = parseFlexibleNumber(row.totalOriginal ?? row.total, null);
    const adjusted = parseFlexibleNumber(row.totalAjustado ?? row.total, null);
    const period = getPeriodFromExcelRow(row);
    if (!period || amount == null) {
      invalidRows += 1;
      continue;
    }

    const provider = normalizeGroupKey(row.proveedor || row.Nombre_Emisor || row.nit || "Sin proveedor");
    const category = normalizeCategoryKey(row.categoria);
    const grossAmount = Math.abs(amount);
    const netAmount = adjusted ?? (isCreditNote(row) ? -grossAmount : grossAmount);
    grossTotal += isCreditNote(row) ? 0 : grossAmount;
    netTotal += netAmount;
    count += 1;
    addMetric(byPeriod, period, isCreditNote(row) ? 0 : grossAmount);
    addMetric(byProvider, provider, isCreditNote(row) ? 0 : grossAmount);
    addMetric(byCategory, category, isCreditNote(row) ? 0 : grossAmount);
  }

  return { total: grossTotal, netTotal, count, invalidRows, byPeriod, byProvider, byCategory };
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function compareMaps(label, apiMap, excelMap, limit = 12) {
  const keys = [...new Set([...apiMap.keys(), ...excelMap.keys()])];
  const rows = keys
    .map((key) => {
      const api = apiMap.get(key)?.total || 0;
      const excel = excelMap.get(key)?.total || 0;
      const diff = api - excel;
      const diffPct = excel ? diff / excel : null;
      return { key, api, excel, diff, diffPct };
    })
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, limit);

  console.log(`\n[compare] Diferencias por ${label}`);
  for (const row of rows) {
    const pct = row.diffPct == null ? "n/a" : `${(row.diffPct * 100).toFixed(1)}%`;
    console.log(
      `- ${row.key}: API ${formatMoney(row.api)} | Excel ${formatMoney(row.excel)} | Diff ${formatMoney(row.diff)} (${pct})`
    );
  }
}

async function readExcelCacheRows() {
  const raw = JSON.parse(await fs.readFile(facturasCachePath, "utf8"));
  const payload = extractDataCachePayload(raw, (candidate) => Array.isArray(candidate?.data));
  if (!payload) {
    throw new Error("No se pudo leer Data/_cache/control-facturas.json. Ejecuta npm run build:data-cache.");
  }
  return payload.data;
}

async function main() {
  loadEnvFile(rootDir);

  console.log("[compare] leyendo compras desde API...");
  const token = await requestPbiToken();
  const apiPayload = await requestPbiService("compras", token);
  const apiRows = extractRows(apiPayload);

  console.log("[compare] leyendo compras desde cache Excel...");
  const excelRows = await readExcelCacheRows();

  const excelSummary = summarizeExcelCompras(excelRows);
  const excelPeriods = new Set(excelSummary.byPeriod.keys());
  const apiSummary = summarizeApiCompras(apiRows);
  const apiComparableSummary = summarizeApiCompras(apiRows, excelPeriods);
  const diff = apiSummary.total - excelSummary.total;
  const diffPct = excelSummary.total ? diff / excelSummary.total : null;
  const comparableDiff = apiComparableSummary.total - excelSummary.total;
  const comparableDiffPct = excelSummary.total ? comparableDiff / excelSummary.total : null;

  console.log("\n[compare] Resumen general bruto");
  console.log(`- API:   ${apiSummary.count} filas validas, ${formatMoney(apiSummary.total)}`);
  console.log(`- Excel: ${excelSummary.count} filas validas, ${formatMoney(excelSummary.total)}`);
  console.log(`- Diff:  ${formatMoney(diff)}${diffPct == null ? "" : ` (${(diffPct * 100).toFixed(1)}%)`}`);
  console.log("\n[compare] Resumen comparable bruto (solo periodos existentes en Excel)");
  console.log(`- API comparable: ${apiComparableSummary.count} filas validas, ${formatMoney(apiComparableSummary.total)}`);
  console.log(`- Excel:          ${excelSummary.count} filas validas, ${formatMoney(excelSummary.total)}`);
  console.log(
    `- Diff:           ${formatMoney(comparableDiff)}${
      comparableDiffPct == null ? "" : ` (${(comparableDiffPct * 100).toFixed(1)}%)`
    }`
  );
  console.log(`- Invalidas API/Excel: ${apiSummary.invalidRows}/${excelSummary.invalidRows}`);
  console.log(`- Neto Excel con NC: ${formatMoney(excelSummary.netTotal)}`);

  compareMaps("periodo comparable", apiComparableSummary.byPeriod, excelSummary.byPeriod);
  compareMaps("proveedor comparable", apiComparableSummary.byProvider, excelSummary.byProvider);
  compareMaps("categoria comparable", apiComparableSummary.byCategory, excelSummary.byCategory);
}

main().catch((error) => {
  console.error("[compare] error:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
