import { dayjs, parseSpreadsheetDate } from "./dateUtils.js";
import { readDataCacheFromURL } from "./defaultDataCache.js";
import { parseFlexibleNumber } from "./numberUtils.js";
import { cleanText, normalizeText } from "./textUtils.js";

export const VENTAS_PBI_CACHE_URL = "/_cache/ventas-pbi.json";

function getValidStart(options = {}) {
  const minYear = Number(options.minYear || 2024);
  return dayjs(`${Number.isFinite(minYear) ? minYear : 2024}-01-01`);
}

function normalizeCategory(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "Ventas";
  if (normalized.includes("tecnolog")) return "Tecnologia";
  if (normalized.includes("licenciamiento")) return "Licenciamiento";
  if (normalized.includes("suministro")) return "Suministros";
  if (normalized.includes("servicio") || normalized.includes("renta")) return "Servicios";
  return cleanText(value) || "Ventas";
}

function normalizeClient(value) {
  return cleanText(value)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\bS A S\b/g, "SAS")
    .replace(/\s+/g, " ")
    .trim();
}

function getDocumentKey(row, index) {
  const client = normalizeClient(row.Empresa || row.Identificacion || "Sin cliente");
  const prefix = cleanText(row.Prefijo) || "FV";
  const number = cleanText(row.Numero) || cleanText(row.Numero_Documento) || String(index + 1);
  const date = parseSpreadsheetDate(row.Fecha_Emision);
  const dateKey = date?.isValid?.() ? date.format("YYYY-MM-DD") : "sin-fecha";
  return [client, prefix, number, dateKey].join("|");
}

function createBucket(row, index) {
  const parsedDate = parseSpreadsheetDate(row.Fecha_Emision);
  const client = normalizeClient(row.Empresa || row.Identificacion || "Sin cliente");
  const prefix = cleanText(row.Prefijo) || "FV";
  const number = cleanText(row.Numero) || cleanText(row.Numero_Documento) || String(index + 1);

  return {
    key: getDocumentKey(row, index),
    parsedDate,
    client,
    prefix,
    number,
    nit: cleanText(row.Identificacion),
    employeeId: cleanText(row.Identificacion_Empleado),
    employeeName: cleanText(row.Nombre_Empleado),
    categoryTotals: new Map(),
    total: 0,
    cost: 0,
    units: 0,
    lineCount: 0,
    products: new Set(),
  };
}

function getDominantCategory(bucket) {
  return [...bucket.categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Ventas";
}

function bucketToInvoice(bucket, index, options = {}) {
  const parsedDate = bucket.parsedDate;
  const validStart = getValidStart(options);

  if (!parsedDate?.isValid()) {
    return { valid: false, reason: "invalid-date" };
  }

  if (parsedDate.isBefore(validStart)) {
    return { valid: false, reason: "outside-range" };
  }

  if (!bucket.total || bucket.total <= 0) {
    return { valid: false, reason: "invalid-total" };
  }

  if (!bucket.client) {
    return { valid: false, reason: "missing-client" };
  }

  const numeroDocumento = [bucket.prefix, bucket.number].filter(Boolean).join("-") || bucket.number || `FV-${index + 1}`;
  const productSample = [...bucket.products].slice(0, 4).join(" | ");

  return {
    valid: true,
    value: {
      id: `venta-pbi-${bucket.key}-${index}`,
      fecha: parsedDate.toDate(),
      fechaIso: parsedDate.format("YYYY-MM-DD"),
      fechaRecepcion: parsedDate.toDate(),
      fechaRecepcionIso: parsedDate.format("YYYY-MM-DD"),
      total: bucket.total,
      totalOriginal: bucket.total,
      totalAjustado: bucket.total,
      costoProducto: bucket.cost,
      margenBruto: bucket.total - bucket.cost,
      categoria: getDominantCategory(bucket),
      proveedor: bucket.client,
      cliente: bucket.client,
      clienteNormalizado: bucket.client,
      estado: "Aprobado",
      tipoDoc: "Factura de venta",
      tipoDocNormalizado: "Factura de venta",
      signoDocumento: 1,
      prefijo: bucket.prefix,
      folio: bucket.number,
      numeroDocumento,
      nit: bucket.nit,
      periodo: parsedDate.format("YYYY-MM"),
      anio: parsedDate.year(),
      mesNum: parsedDate.month() + 1,
      oc: "",
      obs1: bucket.employeeName,
      obs2: "",
      observacionContabilidad: "",
      observacionRechazos: "",
      conciliacion: "",
      validacion: bucket.employeeId,
      motivoRechazo: "",
      observacion: productSample || `${bucket.lineCount} lineas API contable`,
      fuente: "PBI Ventas",
      asesor: bucket.employeeName,
      lineCount: bucket.lineCount,
      units: bucket.units,
    },
  };
}

export function parseVentasPbiRows(rows = [], sourceName = "API contable ventas PBI", options = {}) {
  const buckets = new Map();

  rows.forEach((row, index) => {
    const amount = parseFlexibleNumber(row.Valor_Mercancia, null);
    if (amount == null) return;

    const key = getDocumentKey(row, index);
    const bucket = buckets.get(key) || createBucket(row, index);
    const category = normalizeCategory(row.Categoria);
    bucket.total += amount;
    bucket.cost += parseFlexibleNumber(row.Costo_Producto, 0) || 0;
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
    missingClient: 0,
  };

  [...buckets.values()].forEach((bucket, index) => {
    const result = bucketToInvoice(bucket, index, options);
    if (!result.valid) {
      if (result.reason === "invalid-date") stats.invalidDate += 1;
      if (result.reason === "outside-range") stats.outsideRange += 1;
      if (result.reason === "invalid-total") stats.invalidTotal += 1;
      if (result.reason === "missing-client") stats.missingClient += 1;
      return;
    }

    parsed.push(result.value);
  });

  parsed.sort((a, b) => a.periodo.localeCompare(b.periodo) || a.proveedor.localeCompare(b.proveedor));

  return {
    data: parsed,
    meta: {
      sourceName,
      sheetName: "consultaVentasDashboardPBI",
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

export async function loadDefaultVentasPbi() {
  const cachedPayload = await readDataCacheFromURL(VENTAS_PBI_CACHE_URL, (candidate) =>
    Boolean(candidate && Array.isArray(candidate.data) && candidate.meta)
  );

  if (!cachedPayload) {
    throw new Error("No se encontro cache PBI de ventas. Ejecuta npm run build:pbi-cache.");
  }

  return cachedPayload;
}
