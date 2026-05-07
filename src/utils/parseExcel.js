import { dayjs, parseSpreadsheetDate } from "./dateUtils.js";
import { readDataCacheFromURL } from "./defaultDataCache.js";
import { parseFlexibleNumber } from "./numberUtils.js";
import { cleanText, normalizeText } from "./textUtils.js";

export const DEFAULT_WORKBOOK_URL = "/Control%20Facturas.xlsx";
export const DEFAULT_WORKBOOK_CACHE_URL = "/_cache/control-facturas.json";

export const COLUMNAS = {
  fecha: "Fecha_Emision",
  total: "Total",
  total_ajustado: "Total_Ajustado",
  categoria: "Categoria_Final",
  proveedor: "Proveedor_Normalizado",
  estado: "Estado_Final",
  tipo_doc: "Tipo_Documento",
  folio: "Folio",
  prefijo: "Prefijo",
  fecha_recepcion: "Fecha_Recepcion",
  nit: "NIT_Emisor",
  periodo: "Periodo",
  anio: "A\u00f1o",
  mes_num: "Mes_Num",
  oc: "Orden_Compra",
  obs1: "Obs_1",
  obs2: "Obs_2",
  observacion_contabilidad: "Observacion_Contabilidad",
  observacion_rechazos: "Observacion_Rechazos",
  conciliacion: "Conciliacion",
  validacion: "Validacion",
};

const VALID_START = dayjs("2024-01-01");
const VALID_END = dayjs("2026-12-31");
const MASTER_SHEET = "Facturas_Maestra";
const SALES_SHEET_CANDIDATES = ["Ventas", "VENTAS", "FV", "Facturas Venta", "Facturas_Venta", "Facturas de Venta"];

let xlsxModulePromise = null;
let defaultExcelPromise = null;
let defaultExcelCache = null;

function isParsedWorkbookPayload(payload) {
  return Boolean(payload && Array.isArray(payload.data) && payload.meta);
}

async function getXlsx() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import("xlsx");
  }

  return xlsxModulePromise;
}

export async function sheetToJson(worksheet) {
  const XLSX = await getXlsx();
  return XLSX.utils.sheet_to_json(worksheet, {
    defval: null,
    raw: true,
    blankrows: false,
  });
}

export async function readWorkbookFromURL(url, options = {}) {
  const { includeWorkbookFiles = false, cacheMode = "default" } = options;
  const response = await fetch(url, { cache: cacheMode });
  if (!response.ok) {
    throw new Error(`No fue posible cargar el archivo ${decodeURIComponent(url)}.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const XLSX = await getXlsx();
  return XLSX.read(arrayBuffer, {
    type: "array",
    cellDates: true,
    bookFiles: includeWorkbookFiles,
  });
}

export async function readWorkbookFromFile(file, options = {}) {
  const { includeWorkbookFiles = false } = options;
  const arrayBuffer = await file.arrayBuffer();
  const XLSX = await getXlsx();
  return XLSX.read(arrayBuffer, {
    type: "array",
    cellDates: true,
    bookFiles: includeWorkbookFiles,
  });
}

function normalizeCategory(value) {
  const normalized = normalizeText(value);

  if (
    !normalized ||
    normalized === "nd" ||
    normalized === "#n/d" ||
    normalized === "null" ||
    normalized.includes("sin coincidencia")
  ) {
    return "Otros";
  }

  if (normalized.includes("oscar") || normalized.includes("servicio")) {
    return "Servicios";
  }

  if (
    normalized.includes("pac/tec") ||
    normalized.includes("pactec") ||
    (normalized.includes("pac") && normalized.includes("tec"))
  ) {
    return "Pac/tec";
  }

  if (normalized.includes("tecnolog")) {
    return "Tecnología";
  }

  if (normalized === "pac") {
    return "PAC";
  }

  if (normalized.includes("gasto")) {
    return "Gasto";
  }

  return "Otros";
}

function normalizeStatus(value) {
  const normalized = normalizeText(value);

  if (normalized.includes("rechaz") || normalized.includes("devuelt")) {
    return "Rechazado";
  }

  if (normalized.includes("pend")) {
    return "Pendiente";
  }

  if (
    normalized.includes("aprob") ||
    normalized.includes("ingresad") ||
    normalized.includes("recibid") ||
    normalized.includes("ok")
  ) {
    return "Aprobado";
  }

  return "En revisi\u00f3n";
}

function normalizeDocumentType(value) {
  const normalized = normalizeText(value);
  const compact = normalized.replace(/[^a-z0-9]+/g, "");

  if (compact.includes("notadecredito")) {
    return "Nota de crédito";
  }

  if (compact.includes("notadedebito")) {
    return "Nota de débito";
  }

  if (compact.includes("facturaelectronica")) {
    return "Factura electrónica";
  }

  if (normalized.includes("contingencia")) {
    return "Factura contingencia";
  }

  if (compact.includes("documentosoporte") && normalized.includes("ajuste")) {
    return "Nota de ajuste documento soporte";
  }

  return cleanText(value) || "Sin clasificar";
}

function getDocumentSign(normalizedDocumentType) {
  const compact = normalizeText(normalizedDocumentType).replace(/[^a-z0-9]+/g, "");
  return compact.includes("notadecredito") ? -1 : 1;
}

function normalizePeriodKey(rawPeriod) {
  if (rawPeriod == null || rawPeriod === "") {
    return null;
  }

  const text = String(rawPeriod).trim().replace(/[/.]/g, "-");
  const match = text.match(/^(\d{4})-(\d{1,2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}`;
}

function resolveYearMonth(row, parsedDate) {
  const periodKey = normalizePeriodKey(row[COLUMNAS.periodo]);
  const rawYear = Number(row[COLUMNAS.anio]);
  const rawMonth = Number(row[COLUMNAS.mes_num]);

  let year = null;
  let month = null;

  if (periodKey) {
    const [periodYear, periodMonth] = periodKey.split("-").map(Number);
    year = periodYear;
    month = periodMonth;
  } else if (Number.isFinite(rawYear) && rawYear > 0 && Number.isFinite(rawMonth) && rawMonth >= 1 && rawMonth <= 12) {
    year = rawYear;
    month = rawMonth;
  } else if (parsedDate?.isValid()) {
    year = parsedDate.year();
    month = parsedDate.month() + 1;
  }

  const normalizedPeriod =
    year && month ? `${year}-${String(month).padStart(2, "0")}` : null;

  return {
    year,
    month,
    periodKey: normalizedPeriod,
  };
}

function resolveInvoiceDate(row) {
  const parsedDate = parseSpreadsheetDate(row[COLUMNAS.fecha]);
  const fallback = resolveYearMonth(row, parsedDate);
  const parsedPeriod = parsedDate?.isValid() ? parsedDate.format("YYYY-MM") : null;

  if (parsedDate?.isValid() && fallback.periodKey && parsedPeriod !== fallback.periodKey) {
    return {
      parsedDate: dayjs(`${fallback.periodKey}-01`, "YYYY-MM-DD", true),
      period: fallback.periodKey,
      year: fallback.year,
      month: fallback.month,
      usedPeriodFallback: true,
      hadPeriodMismatch: true,
    };
  }

  if (!parsedDate?.isValid() && fallback.periodKey) {
    return {
      parsedDate: dayjs(`${fallback.periodKey}-01`, "YYYY-MM-DD", true),
      period: fallback.periodKey,
      year: fallback.year,
      month: fallback.month,
      usedPeriodFallback: true,
      hadPeriodMismatch: false,
    };
  }

  if (parsedDate?.isValid()) {
    return {
      parsedDate,
      period: fallback.periodKey || parsedDate.format("YYYY-MM"),
      year: fallback.year || parsedDate.year(),
      month: fallback.month || parsedDate.month() + 1,
      usedPeriodFallback: false,
      hadPeriodMismatch: false,
    };
  }

  return null;
}

function createInvoice(row, index) {
  const resolvedDate = resolveInvoiceDate(row);
  const parsedDate = resolvedDate?.parsedDate || null;
  const parsedReceptionDate = parseSpreadsheetDate(row[COLUMNAS.fecha_recepcion]);
  const totalOriginal = parseFlexibleNumber(row[COLUMNAS.total], null);
  const tipoDoc = cleanText(row[COLUMNAS.tipo_doc]);
  const tipoDocNormalizado = normalizeDocumentType(tipoDoc);
  const signoDocumento = getDocumentSign(tipoDocNormalizado);
  const totalAjustadoArchivo = parseFlexibleNumber(row[COLUMNAS.total_ajustado], null);
  const totalAjustado =
    totalAjustadoArchivo != null
      ? totalAjustadoArchivo
      : totalOriginal != null
        ? totalOriginal * signoDocumento
        : null;

  if (!parsedDate?.isValid()) {
    return { valid: false, reason: "invalid-date" };
  }

  if (parsedDate.isBefore(VALID_START) || parsedDate.isAfter(VALID_END)) {
    return { valid: false, reason: "outside-range" };
  }

  if (!totalOriginal || totalOriginal <= 0) {
    return { valid: false, reason: "invalid-total" };
  }

  const provider = cleanText(row[COLUMNAS.proveedor] || row.Nombre_Emisor);
  if (!provider) {
    return { valid: false, reason: "missing-provider" };
  }

  const year = Number(resolvedDate?.year || parsedDate.year());
  if (year < 2024) {
    return { valid: false, reason: "invalid-year" };
  }

  const obs1 = cleanText(row[COLUMNAS.obs1]);
  const obs2 = cleanText(row[COLUMNAS.obs2]);
  const observacionContabilidad = cleanText(row[COLUMNAS.observacion_contabilidad]);
  const observacionRechazos = cleanText(row[COLUMNAS.observacion_rechazos]);
  const conciliacion = cleanText(row[COLUMNAS.conciliacion]);
  const validacion = cleanText(row[COLUMNAS.validacion]);
  const prefijo = cleanText(row[COLUMNAS.prefijo]);
  const folio = cleanText(row[COLUMNAS.folio]);
  const numeroDocumento = [prefijo, folio].filter(Boolean).join("-") || folio || "-";
  const motivoRechazo = observacionRechazos || obs2 || obs1 || validacion || conciliacion || "";

  return {
    valid: true,
    diagnostics: {
      usedPeriodFallback: Boolean(resolvedDate?.usedPeriodFallback),
      hadPeriodMismatch: Boolean(resolvedDate?.hadPeriodMismatch),
    },
    value: {
      id: `${provider}-${resolvedDate?.period}-${index}`,
      fecha: parsedDate.toDate(),
      fechaIso: parsedDate.format("YYYY-MM-DD"),
      fechaRecepcion: parsedReceptionDate?.isValid() ? parsedReceptionDate.toDate() : null,
      fechaRecepcionIso: parsedReceptionDate?.isValid() ? parsedReceptionDate.format("YYYY-MM-DD") : "",
      total: totalAjustado,
      totalOriginal,
      totalAjustado,
      categoria: normalizeCategory(row[COLUMNAS.categoria]),
      proveedor: provider,
      estado: normalizeStatus(row[COLUMNAS.estado]),
      tipoDoc,
      tipoDocNormalizado,
      signoDocumento,
      prefijo,
      folio,
      numeroDocumento,
      nit: cleanText(row[COLUMNAS.nit]),
      periodo: resolvedDate?.period,
      anio: year,
      mesNum: Number(resolvedDate?.month || parsedDate.month() + 1),
      oc: cleanText(row[COLUMNAS.oc]),
      obs1,
      obs2,
      observacionContabilidad,
      observacionRechazos,
      conciliacion,
      validacion,
      motivoRechazo,
      observacion: [obs1, obs2, observacionContabilidad, observacionRechazos, conciliacion, validacion].filter(Boolean).join(" \u00b7 ") || "-",
    },
  };
}

function getFirstValue(row, names) {
  for (const name of names) {
    if (row[name] != null && row[name] !== "") {
      return row[name];
    }
  }

  const normalizedMap = new Map(
    Object.keys(row).map((key) => [normalizeText(key), key])
  );

  for (const name of names) {
    const key = normalizedMap.get(normalizeText(name));
    if (key && row[key] != null && row[key] !== "") {
      return row[key];
    }
  }

  return null;
}

function createSalesInvoice(row, index) {
  const rawDate = getFirstValue(row, ["fecha", "Fecha", "Fecha_Emision", "Fecha emision", "fecha_emision"]);
  const parsedDate = parseSpreadsheetDate(rawDate);
  const gross = parseFlexibleNumber(getFirstValue(row, ["monto bruto", "Monto bruto", "Total", "Valor bruto", "total"]), null);
  const creditNotes = parseFlexibleNumber(getFirstValue(row, ["notas credito asociadas", "Notas credito asociadas", "NC", "Notas_Credito", "total nc"]), 0) || 0;
  const documentNumber = cleanText(getFirstValue(row, ["numero factura venta", "Número factura venta", "Numero factura venta", "Factura", "Folio", "Numero"]));
  const client = cleanText(getFirstValue(row, ["cliente", "Cliente", "Cliente (NIT + razon social)", "Cliente (NIT + razón social)", "Razon social", "Nombre cliente"]));
  const category = cleanText(getFirstValue(row, ["categoria", "Categoría", "Categoria_Final"])) || "Otros";

  if (!parsedDate?.isValid()) {
    return { valid: false, reason: "invalid-date" };
  }

  if (!gross || gross <= 0 || !client) {
    return { valid: false, reason: !client ? "missing-client" : "invalid-total" };
  }

  const common = {
    fecha: parsedDate.toDate(),
    fechaIso: parsedDate.format("YYYY-MM-DD"),
    fechaRecepcion: parsedDate.toDate(),
    fechaRecepcionIso: parsedDate.format("YYYY-MM-DD"),
    categoria: normalizeCategory(category),
    proveedor: client,
    cliente: client,
    estado: normalizeStatus(getFirstValue(row, ["estado", "Estado", "Estado_Final"])),
    prefijo: "FV",
    folio: documentNumber,
    numeroDocumento: documentNumber || `FV-${index + 1}`,
    nit: cleanText(getFirstValue(row, ["nit", "NIT", "NIT cliente", "NIT_Cliente"])),
    periodo: parsedDate.format("YYYY-MM"),
    anio: parsedDate.year(),
    mesNum: parsedDate.month() + 1,
    oc: "",
    obs1: "",
    obs2: "",
    observacionContabilidad: "",
    observacionRechazos: cleanText(getFirstValue(row, ["motivo rechazo", "Motivo rechazo", "Motivo_Rechazo"])),
    conciliacion: "",
    validacion: "",
  };
  const motivoRechazo = common.observacionRechazos;
  const invoice = {
    ...common,
    id: `venta-${common.numeroDocumento}-${common.fechaIso}-${index}`,
    total: gross,
    totalOriginal: gross,
    totalAjustado: gross,
    tipoDoc: "Factura de venta",
    tipoDocNormalizado: "Factura de venta",
    signoDocumento: 1,
    motivoRechazo,
    observacion: motivoRechazo || "-",
  };

  if (creditNotes > 0) {
    const credit = {
      ...common,
      id: `venta-nc-${common.numeroDocumento}-${common.fechaIso}-${index}`,
      total: -Math.abs(creditNotes),
      totalOriginal: Math.abs(creditNotes),
      totalAjustado: -Math.abs(creditNotes),
      tipoDoc: "Nota de credito de venta",
      tipoDocNormalizado: "Nota de credito",
      signoDocumento: -1,
      numeroDocumento: `${common.numeroDocumento || `FV-${index + 1}`}-NC`,
      motivoRechazo,
      observacion: "NC asociada a factura de venta",
    };
    return { valid: true, values: [invoice, credit] };
  }

  return { valid: true, values: [invoice] };
}

export async function parseWorkbook(workbook, sourceName = "Control Facturas.xlsx") {
  const worksheet = workbook.Sheets[MASTER_SHEET];
  if (!worksheet) {
    throw new Error(`No se encontr\u00f3 la hoja ${MASTER_SHEET} en ${sourceName}.`);
  }

  const rows = await sheetToJson(worksheet);
  const parsed = [];
  const stats = {
    totalRows: rows.length,
    invalidDate: 0,
    outsideRange: 0,
    invalidTotal: 0,
    missingProvider: 0,
    invalidYear: 0,
    usedPeriodFallback: 0,
    periodMismatch: 0,
  };

  rows.forEach((row, index) => {
    const result = createInvoice(row, index);
    if (!result.valid) {
      if (result.reason === "invalid-date") stats.invalidDate += 1;
      if (result.reason === "outside-range") stats.outsideRange += 1;
      if (result.reason === "invalid-total") stats.invalidTotal += 1;
      if (result.reason === "missing-provider") stats.missingProvider += 1;
      if (result.reason === "invalid-year") stats.invalidYear += 1;
      return;
    }

    if (result.diagnostics?.usedPeriodFallback) stats.usedPeriodFallback += 1;
    if (result.diagnostics?.hadPeriodMismatch) stats.periodMismatch += 1;
    parsed.push(result.value);
  });

  parsed.sort((a, b) => a.periodo.localeCompare(b.periodo) || a.proveedor.localeCompare(b.proveedor));

  return {
    data: parsed,
    meta: {
      sourceName,
      sheetName: MASTER_SHEET,
      totalRows: rows.length,
      validRows: parsed.length,
      skippedRows: rows.length - parsed.length,
      range: {
        start: parsed[0]?.periodo || null,
        end: parsed[parsed.length - 1]?.periodo || null,
      },
      stats,
      columns: Object.keys(rows[0] || {}),
    },
  };
}

export async function parseVentasWorkbook(workbook, sourceName = "Control Facturas.xlsx") {
  const sheetName = SALES_SHEET_CANDIDATES.find((name) => workbook.Sheets[name]);
  if (!sheetName) {
    return {
      data: [],
      meta: {
        sourceName,
        sheetName: null,
        totalRows: 0,
        validRows: 0,
        skippedRows: 0,
        range: { start: null, end: null },
        stats: { missingSheet: true },
        columns: [],
      },
    };
  }

  const rows = await sheetToJson(workbook.Sheets[sheetName]);
  const parsed = [];
  const stats = {
    totalRows: rows.length,
    invalidDate: 0,
    invalidTotal: 0,
    missingClient: 0,
  };

  rows.forEach((row, index) => {
    const result = createSalesInvoice(row, index);
    if (!result.valid) {
      if (result.reason === "invalid-date") stats.invalidDate += 1;
      if (result.reason === "invalid-total") stats.invalidTotal += 1;
      if (result.reason === "missing-client") stats.missingClient += 1;
      return;
    }
    parsed.push(...result.values);
  });

  parsed.sort((a, b) => a.periodo.localeCompare(b.periodo) || a.proveedor.localeCompare(b.proveedor));

  return {
    data: parsed,
    meta: {
      sourceName,
      sheetName,
      totalRows: rows.length,
      validRows: parsed.length,
      skippedRows: rows.length - parsed.length,
      range: {
        start: parsed[0]?.periodo || null,
        end: parsed[parsed.length - 1]?.periodo || null,
      },
      stats,
      columns: Object.keys(rows[0] || {}),
    },
  };
}

export async function parseExcelFile(file) {
  const workbook = await readWorkbookFromFile(file);
  return parseWorkbook(workbook, file.name);
}

export async function parseVentasExcelFile(file) {
  const workbook = await readWorkbookFromFile(file);
  return parseVentasWorkbook(workbook, file.name);
}

export async function loadDefaultExcel() {
  if (defaultExcelCache) {
    return defaultExcelCache;
  }

  if (!defaultExcelPromise) {
    defaultExcelPromise = (async () => {
      const cachedPayload = await readDataCacheFromURL(
        DEFAULT_WORKBOOK_CACHE_URL,
        isParsedWorkbookPayload
      );

      if (cachedPayload) {
        defaultExcelCache = cachedPayload;
        return cachedPayload;
      }

      const workbook = await readWorkbookFromURL(DEFAULT_WORKBOOK_URL);
      const parsedWorkbook = await parseWorkbook(workbook, "Control Facturas.xlsx");
      defaultExcelCache = parsedWorkbook;
      return parsedWorkbook;
    })().catch((error) => {
      defaultExcelPromise = null;
      throw error;
    });
  }

  return defaultExcelPromise;
}

export async function loadDefaultVentasExcel() {
  const workbook = await readWorkbookFromURL(DEFAULT_WORKBOOK_URL);
  return parseVentasWorkbook(workbook, "Control Facturas.xlsx");
}
