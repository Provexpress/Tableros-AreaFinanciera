import { dayjs, parseSpreadsheetDate } from "./dateUtils.js";
import { readDataCacheFromURL } from "./defaultDataCache.js";
import { parseFlexibleNumber } from "./numberUtils.js";
import { cleanText, normalizeText } from "./textUtils.js";

export const COMPRAS_PBI_CACHE_URL = "/_cache/compras-pbi.json";

function getValidStart(options = {}) {
  const minYear = Number(options.minYear || 2024);
  return dayjs(`${Number.isFinite(minYear) ? minYear : 2024}-01-01`);
}

function normalizeCategory(value) {
  const normalized = normalizeText(value);

  if (!normalized) return "Otros";
  if (normalized.includes("tecnolog")) return "Tecnología";
  if (normalized.includes("licenciamiento")) return "Tecnología";
  if (normalized.includes("suministro")) return "Tecnología";
  if (normalized.includes("pac") && normalized.includes("tec")) return "Pac/tec";
  if (normalized === "pac") return "PAC";
  if (normalized.includes("servicio") || normalized.includes("renta")) return "Servicios";
  if (normalized.includes("gasto")) return "Gasto";
  return cleanText(value) || "Otros";
}

function normalizeProvider(value) {
  return cleanText(value)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\bS A S\b/g, "SAS")
    .replace(/\s+/g, " ")
    .trim();
}

function getInvoiceKey(row, index) {
  const provider = normalizeProvider(row.Empresa || row.Identificacion || "Sin proveedor");
  const prefix = cleanText(row.Prefijo) || "FC";
  const number = cleanText(row.Numero) || cleanText(row.Numero_Documento) || String(index + 1);
  const date = parseSpreadsheetDate(row.Fecha_Emision);
  const dateKey = date?.isValid?.() ? date.format("YYYY-MM-DD") : "sin-fecha";
  return [provider, prefix, number, dateKey].join("|");
}

function createBucket(row, index) {
  const parsedDate = parseSpreadsheetDate(row.Fecha_Emision);
  const provider = normalizeProvider(row.Empresa || row.Identificacion || "Sin proveedor");
  const prefix = cleanText(row.Prefijo) || "FC";
  const number = cleanText(row.Numero) || cleanText(row.Numero_Documento) || String(index + 1);

  return {
    key: getInvoiceKey(row, index),
    parsedDate,
    provider,
    prefix,
    number,
    nit: cleanText(row.Identificacion),
    categoryTotals: new Map(),
    total: 0,
    units: 0,
    lineCount: 0,
    products: new Set(),
  };
}

function getDominantCategory(bucket) {
  return [...bucket.categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Otros";
}

function bucketToInvoice(bucket, index, options = {}) {
  const parsedDate = bucket.parsedDate;
  const total = bucket.total;
  const validStart = getValidStart(options);

  if (!parsedDate?.isValid()) {
    return { valid: false, reason: "invalid-date" };
  }

  if (parsedDate.isBefore(validStart)) {
    return { valid: false, reason: "outside-range" };
  }

  if (!total || total <= 0) {
    return { valid: false, reason: "invalid-total" };
  }

  if (!bucket.provider) {
    return { valid: false, reason: "missing-provider" };
  }

  const numeroDocumento = [bucket.prefix, bucket.number].filter(Boolean).join("-") || bucket.number || `FC-${index + 1}`;
  const productSample = [...bucket.products].slice(0, 4).join(" | ");

  return {
    valid: true,
    value: {
      id: `compra-pbi-${bucket.key}-${index}`,
      fecha: parsedDate.toDate(),
      fechaIso: parsedDate.format("YYYY-MM-DD"),
      fechaRecepcion: parsedDate.toDate(),
      fechaRecepcionIso: parsedDate.format("YYYY-MM-DD"),
      total,
      totalOriginal: total,
      totalAjustado: total,
      categoria: getDominantCategory(bucket),
      proveedor: bucket.provider,
      estado: "Aprobado",
      tipoDoc: "Factura de compra",
      tipoDocNormalizado: "Factura electronica",
      signoDocumento: 1,
      prefijo: bucket.prefix,
      folio: bucket.number,
      numeroDocumento,
      nit: bucket.nit,
      periodo: parsedDate.format("YYYY-MM"),
      anio: parsedDate.year(),
      mesNum: parsedDate.month() + 1,
      oc: "",
      obs1: "",
      obs2: "",
      observacionContabilidad: "",
      observacionRechazos: "",
      conciliacion: "",
      validacion: "",
      motivoRechazo: "",
      observacion: productSample || `${bucket.lineCount} líneas API`,
      fuente: "PBI Compras",
      lineCount: bucket.lineCount,
      units: bucket.units,
    },
  };
}

export function parseComprasPbiRows(rows = [], sourceName = "API de compras PBI", options = {}) {
  const buckets = new Map();

  rows.forEach((row, index) => {
    const amount = parseFlexibleNumber(row.Valor_Mercancia, null);
    if (amount == null) return;

    const key = getInvoiceKey(row, index);
    const bucket = buckets.get(key) || createBucket(row, index);
    const category = normalizeCategory(row.Categoria);
    bucket.total += amount;
    bucket.units += parseFlexibleNumber(row.Unidades, 0) || 0;
    bucket.lineCount += 1;
    bucket.categoryTotals.set(category, (bucket.categoryTotals.get(category) || 0) + amount);
    const product = cleanText(row.Producto);
    if (product) bucket.products.add(product);
    buckets.set(key, bucket);
  });

  const parsed = [];
  const stats = {
    apiRows: rows.length,
    groupedDocuments: buckets.size,
    invalidDate: 0,
    outsideRange: 0,
    invalidTotal: 0,
    missingProvider: 0,
  };

  [...buckets.values()].forEach((bucket, index) => {
    const result = bucketToInvoice(bucket, index, options);
    if (!result.valid) {
      if (result.reason === "invalid-date") stats.invalidDate += 1;
      if (result.reason === "outside-range") stats.outsideRange += 1;
      if (result.reason === "invalid-total") stats.invalidTotal += 1;
      if (result.reason === "missing-provider") stats.missingProvider += 1;
      return;
    }

    parsed.push(result.value);
  });

  parsed.sort((a, b) => a.periodo.localeCompare(b.periodo) || a.proveedor.localeCompare(b.proveedor));

  return {
    data: parsed,
    meta: {
      sourceName,
      sheetName: "consultaComprasDashboardPBI",
      totalRows: rows.length,
      validRows: parsed.length,
      skippedRows: buckets.size - parsed.length,
      range: {
        start: parsed[0]?.periodo || null,
        end: parsed[parsed.length - 1]?.periodo || null,
      },
      stats,
      cachePolicy: {
        minYear: Number(options.minYear || 2024),
      },
      columns: Object.keys(rows[0] || {}),
    },
  };
}

export async function loadDefaultComprasPbi() {
  const cachedPayload = await readDataCacheFromURL(COMPRAS_PBI_CACHE_URL, (candidate) =>
    Boolean(candidate && Array.isArray(candidate.data) && candidate.meta)
  );

  if (!cachedPayload) {
    throw new Error("No se encontro cache PBI de compras. Ejecuta npm run build:pbi-cache.");
  }

  return cachedPayload;
}
