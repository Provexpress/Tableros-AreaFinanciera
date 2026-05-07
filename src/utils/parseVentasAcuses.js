import { dayjs, parseSpreadsheetDate } from "./dateUtils.js";
import { readDataCacheFromURL } from "./defaultDataCache.js";
import { parseFlexibleNumber } from "./numberUtils.js";
import { cleanText, normalizeText } from "./textUtils.js";

export const DEFAULT_VENTAS_ACUSES_CACHE_URL = "/_cache/ventas-acuses.json";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const DATE_FORMATS = [
  "YYYY-MM-DD",
  "YYYY-MM-DD HH:mm:ss",
  "DD/MM/YYYY",
  "D/M/YYYY",
  "DD/MM/YYYY HH:mm:ss",
  "D/M/YYYY H:mm:ss",
  "DD-MM-YYYY",
  "D-M-YYYY",
  "DD-MM-YYYY HH:mm:ss",
  "D-M-YYYY H:mm:ss",
  "YYYY/MM/DD",
  "YYYY/MM/DD HH:mm:ss",
];

const HEADER_ALIASES = {
  tipodedocumento: "tipoDocumento",
  cufecude: "cufeCude",
  folio: "folio",
  columna1: "columna1",
  prefijo: "prefijo",
  fechaemision: "fechaEmision",
  fecharecepcion: "fechaRecepcion",
  nitemisor: "nitEmisor",
  nombreemisor: "nombreEmisor",
  nitreceptor: "nitCliente",
  nombrereceptor: "nombreCliente",
  iva: "iva",
  ica: "ica",
  ipc: "ipc",
  total: "total",
  estado: "estadoDian",
  grupo: "grupo",
  "1acuse": "acuse1",
  "2acuse": "acuse2",
  "3acuse": "acuse3",
  rechazada: "rechazada",
  sinacuse: "sinAcuse",
  yapagaensistema: "pagaSistema",
  observaciones: "observaciones",
};

let xlsxModulePromise = null;
let defaultVentasAcusesPromise = null;
let defaultVentasAcusesCache = null;

function isParsedVentasAcusesPayload(payload) {
  return Boolean(payload && Array.isArray(payload.data) && payload.meta);
}

async function getXlsx() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import("xlsx");
  }
  return xlsxModulePromise;
}

async function worksheetToRows(worksheet) {
  const XLSX = await getXlsx();
  return XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });
}

function normalizeHeader(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "");
}

function isMarked(value) {
  const normalized = normalizeText(value);
  return normalized === "x" || normalized === "si" || normalized === "sí" || normalized === "1" || value === 1 || value === true;
}

function detectHeaderRow(rows) {
  let bestIndex = -1;
  let bestScore = 0;
  const maxRows = Math.min(rows.length, 30);

  for (let index = 0; index < maxRows; index += 1) {
    const row = rows[index] || [];
    let score = 0;

    for (const cell of row) {
      if (HEADER_ALIASES[normalizeHeader(cell)]) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestScore >= 8 ? bestIndex : -1;
}

function buildHeaderMap(headerRow) {
  const map = {};

  headerRow.forEach((cell, index) => {
    const key = HEADER_ALIASES[normalizeHeader(cell)];
    if (key && map[key] === undefined) {
      map[key] = index;
    }
  });

  return map;
}

function parseAcusesDate(value) {
  const parsed = parseSpreadsheetDate(value, DATE_FORMATS);
  return parsed?.isValid() ? parsed : null;
}

function formatDateOnly(value) {
  const parsed = parseAcusesDate(value);
  return parsed ? parsed.format("YYYY-MM-DD") : "";
}

function formatDateTime(value) {
  const parsed = parseAcusesDate(value);
  return parsed ? parsed.format("YYYY-MM-DD HH:mm:ss") : "";
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

function resolveAcuseState(row, getValue) {
  const pagaSistema = isMarked(getValue("pagaSistema"));
  const rechazada = isMarked(getValue("rechazada"));
  const acuse3 = isMarked(getValue("acuse3"));
  const acuse2 = isMarked(getValue("acuse2"));
  const acuse1 = isMarked(getValue("acuse1"));
  const sinAcuse = isMarked(getValue("sinAcuse"));

  if (pagaSistema) {
    return { estadoAcuse: "Paga en sistema", tieneAcuse: true, numeroAcuses: 3, esRechazada: false, esPagaSistema: true };
  }

  if (rechazada) {
    return { estadoAcuse: "Rechazada", tieneAcuse: false, numeroAcuses: 0, esRechazada: true, esPagaSistema: false };
  }

  if (acuse3) {
    return { estadoAcuse: "3 acuses", tieneAcuse: true, numeroAcuses: 3, esRechazada: false, esPagaSistema: false };
  }

  if (acuse2) {
    return { estadoAcuse: "2 acuses", tieneAcuse: true, numeroAcuses: 2, esRechazada: false, esPagaSistema: false };
  }

  if (acuse1) {
    return { estadoAcuse: "1 acuse", tieneAcuse: true, numeroAcuses: 1, esRechazada: false, esPagaSistema: false };
  }

  if (sinAcuse) {
    return { estadoAcuse: "Sin acuse", tieneAcuse: false, numeroAcuses: 0, esRechazada: false, esPagaSistema: false };
  }

  return { estadoAcuse: "Sin clasificar", tieneAcuse: false, numeroAcuses: 0, esRechazada: false, esPagaSistema: false };
}

function resolvePeriod(sheetName, fechaEmision) {
  if (fechaEmision) {
    const parsed = dayjs(fechaEmision, "YYYY-MM-DD", true);
    if (parsed.isValid()) {
      const monthNumber = parsed.month() + 1;
      return {
        anio: parsed.year(),
        mesNum: monthNumber,
        mes: MONTH_NAMES[monthNumber - 1],
        periodo: parsed.format("YYYY-MM"),
      };
    }
  }

  const normalized = normalizeText(sheetName).toUpperCase();
  const monthIndex = MONTH_NAMES.findIndex((month) => normalized.includes(normalizeText(month).toUpperCase()));
  const yearMatch = normalized.match(/20\d{2}/);
  if (monthIndex >= 0 && yearMatch) {
    const monthNumber = monthIndex + 1;
    const year = Number(yearMatch[0]);
    return {
      anio: year,
      mesNum: monthNumber,
      mes: MONTH_NAMES[monthIndex],
      periodo: `${year}-${String(monthNumber).padStart(2, "0")}`,
    };
  }

  return { anio: null, mesNum: null, mes: "", periodo: "" };
}

function getDocumentKey(record) {
  if (record.cufeCude) {
    return `CUFE:${record.cufeCude.toUpperCase()}`;
  }

  const parts = [record.prefijo, record.folio, record.fechaEmision, record.total]
    .map((value) => cleanText(value).toUpperCase())
    .filter(Boolean);
  return parts.length >= 2 ? `DOC:${parts.join("|")}` : "";
}

function parseRow(row, headerMap, context) {
  const getValue = (name) => {
    const index = headerMap[name];
    return index === undefined || index >= row.length ? "" : row[index];
  };

  const folio = cleanText(getValue("folio"));
  const total = parseFlexibleNumber(getValue("total"), null);
  const fechaEmision = formatDateOnly(getValue("fechaEmision"));
  const nombreCliente = cleanText(getValue("nombreCliente"));

  if (!folio && !nombreCliente && !fechaEmision) {
    return { valid: false, reason: "emptyRow" };
  }

  if (!fechaEmision) {
    return { valid: false, reason: "invalidDate" };
  }

  if (!Number.isFinite(total) || total <= 0) {
    return { valid: false, reason: "invalidTotal" };
  }

  if (!nombreCliente) {
    return { valid: false, reason: "missingClient" };
  }

  const prefijo = cleanText(getValue("prefijo"));
  const acuseState = resolveAcuseState(row, getValue);
  const periodInfo = resolvePeriod(context.sheetName, fechaEmision);
  const record = {
    fuenteArchivo: context.sourceName,
    fuenteHoja: context.sheetName,
    anio: periodInfo.anio,
    mesNum: periodInfo.mesNum,
    mes: periodInfo.mes,
    periodo: periodInfo.periodo,
    tipoDocumento: cleanText(getValue("tipoDocumento")),
    cufeCude: cleanText(getValue("cufeCude")),
    folio,
    prefijo,
    numeroDocumento: [prefijo, folio].filter(Boolean).join("-") || folio,
    fechaEmision,
    fechaRecepcion: formatDateTime(getValue("fechaRecepcion")),
    nitEmisor: cleanText(getValue("nitEmisor")),
    nombreEmisor: cleanText(getValue("nombreEmisor")),
    nitCliente: cleanText(getValue("nitCliente")),
    nombreCliente,
    clienteNormalizado: normalizeClient(nombreCliente),
    iva: parseFlexibleNumber(getValue("iva"), 0),
    ica: parseFlexibleNumber(getValue("ica"), 0),
    ipc: parseFlexibleNumber(getValue("ipc"), 0),
    total,
    estadoDian: cleanText(getValue("estadoDian")),
    grupo: cleanText(getValue("grupo")),
    estadoAcuse: acuseState.estadoAcuse,
    tieneAcuse: acuseState.tieneAcuse,
    numeroAcuses: acuseState.numeroAcuses,
    esRechazada: acuseState.esRechazada,
    esPagaSistema: acuseState.esPagaSistema,
    observaciones: cleanText(getValue("observaciones")),
  };

  return {
    valid: true,
    value: {
      ...record,
      llaveDocumento: getDocumentKey(record),
    },
  };
}

function buildStats() {
  return {
    totalRows: 0,
    validRows: 0,
    duplicatedRows: 0,
    emptyRow: 0,
    invalidDate: 0,
    invalidTotal: 0,
    missingClient: 0,
    sheets: [],
  };
}

export async function parseVentasAcusesWorkbook(workbook, sourceName = "Acuses.xlsx") {
  const data = [];
  const seenKeys = new Set();
  const stats = buildStats();

  for (const sheetName of workbook.SheetNames || []) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = await worksheetToRows(worksheet);
    const headerIndex = detectHeaderRow(rows);
    if (headerIndex < 0) {
      stats.sheets.push({ sheetName, status: "sin encabezado", rows: rows.length, added: 0 });
      continue;
    }

    const headerMap = buildHeaderMap(rows[headerIndex]);
    let added = 0;

    for (let index = headerIndex + 1; index < rows.length; index += 1) {
      const result = parseRow(rows[index], headerMap, { sourceName, sheetName });
      stats.totalRows += 1;

      if (!result.valid) {
        stats[result.reason] = Number(stats[result.reason] || 0) + 1;
        continue;
      }

      const key = result.value.llaveDocumento;
      if (key && seenKeys.has(key)) {
        stats.duplicatedRows += 1;
        continue;
      }

      if (key) {
        seenKeys.add(key);
      }

      data.push(result.value);
      stats.validRows += 1;
      added += 1;
    }

    stats.sheets.push({ sheetName, status: "procesada", rows: Math.max(0, rows.length - headerIndex - 1), added });
  }

  data.sort((a, b) =>
    String(a.periodo || "").localeCompare(String(b.periodo || "")) ||
    String(a.clienteNormalizado || "").localeCompare(String(b.clienteNormalizado || "")) ||
    String(a.numeroDocumento || "").localeCompare(String(b.numeroDocumento || ""))
  );

  return {
    data,
    meta: {
      sourceName,
      totalRows: stats.totalRows,
      validRows: data.length,
      skippedRows: Math.max(0, stats.totalRows - data.length),
      range: {
        start: data.length ? data[0].periodo : null,
        end: data.length ? data[data.length - 1].periodo : null,
      },
      stats,
      columns: [
        "fuenteArchivo",
        "fuenteHoja",
        "anio",
        "mesNum",
        "mes",
        "periodo",
        "tipoDocumento",
        "cufeCude",
        "folio",
        "prefijo",
        "numeroDocumento",
        "fechaEmision",
        "fechaRecepcion",
        "nitEmisor",
        "nombreEmisor",
        "nitCliente",
        "nombreCliente",
        "clienteNormalizado",
        "iva",
        "ica",
        "ipc",
        "total",
        "estadoDian",
        "grupo",
        "estadoAcuse",
        "tieneAcuse",
        "numeroAcuses",
        "esRechazada",
        "esPagaSistema",
        "observaciones",
        "llaveDocumento",
      ],
    },
  };
}

export async function parseVentasAcusesWorkbooks(workbooks) {
  const merged = [];
  const seenKeys = new Set();
  const sources = [];
  const stats = buildStats();

  for (const item of workbooks) {
    const parsed = await parseVentasAcusesWorkbook(item.workbook, item.sourceName);
    sources.push({ sourceName: item.sourceName, ...parsed.meta });

    for (const row of parsed.data) {
      if (row.llaveDocumento && seenKeys.has(row.llaveDocumento)) {
        stats.duplicatedRows += 1;
        continue;
      }
      if (row.llaveDocumento) {
        seenKeys.add(row.llaveDocumento);
      }
      merged.push(row);
    }

    stats.totalRows += parsed.meta.stats.totalRows;
    stats.validRows += parsed.meta.stats.validRows;
    stats.emptyRow += parsed.meta.stats.emptyRow;
    stats.invalidDate += parsed.meta.stats.invalidDate;
    stats.invalidTotal += parsed.meta.stats.invalidTotal;
    stats.missingClient += parsed.meta.stats.missingClient;
    stats.duplicatedRows += parsed.meta.stats.duplicatedRows;
    stats.sheets.push(...parsed.meta.stats.sheets.map((sheet) => ({ sourceName: item.sourceName, ...sheet })));
  }

  merged.sort((a, b) =>
    String(a.periodo || "").localeCompare(String(b.periodo || "")) ||
    String(a.clienteNormalizado || "").localeCompare(String(b.clienteNormalizado || "")) ||
    String(a.numeroDocumento || "").localeCompare(String(b.numeroDocumento || ""))
  );

  return {
    data: merged,
    meta: {
      sourceName: sources.map((item) => item.sourceName).join(" + "),
      totalRows: stats.totalRows,
      validRows: merged.length,
      skippedRows: Math.max(0, stats.totalRows - merged.length),
      range: {
        start: merged.length ? merged[0].periodo : null,
        end: merged.length ? merged[merged.length - 1].periodo : null,
      },
      stats,
      sources,
    },
  };
}

export async function loadDefaultVentasAcuses() {
  if (defaultVentasAcusesCache) {
    return defaultVentasAcusesCache;
  }

  if (!defaultVentasAcusesPromise) {
    defaultVentasAcusesPromise = readDataCacheFromURL(DEFAULT_VENTAS_ACUSES_CACHE_URL, isParsedVentasAcusesPayload).then(
      (payload) => {
        defaultVentasAcusesCache = payload;
        return payload;
      }
    );
  }

  return defaultVentasAcusesPromise;
}
