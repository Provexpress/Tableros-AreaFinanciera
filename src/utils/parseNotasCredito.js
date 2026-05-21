import { dayjs, parseSpreadsheetDate } from "./dateUtils.js";
import { readDataCacheFromURL } from "./defaultDataCache.js";
import { parseFlexibleNumber } from "./numberUtils.js";
import { cleanText, normalizeText } from "./textUtils.js";
import { readWorkbookFromFile, readWorkbookFromURL, sheetToJson } from "./parseExcel.js";

const WEEKLY_URL = "/reporte%20semanal%20de%20facturacion.xlsx";
const NC_URL = "/NOTAS%20CREDITO%202026.xlsx";
export const DEFAULT_NOTAS_CACHE_URL = "/_cache/notas-credito.json";
const WEEKLY_SHEET = "Maestro_Semanal";
const NC_SHEET = "Maestro_NC";
const MAP_SHEET = "Mapa_NC_Semana";

const WEEKLY_COLS = {
  year: "A\u00f1o",
  week: "Semana",
  key: "Llave_Semana",
  start: "Fecha_Inicial",
  end: "Fecha_Final",
  invoices: "Numero_Facturas_Emitidas",
  notes: "Numero_NC_Emitidas",
  refact: "Numero_NC_Refacturadas",
  errAdmon: "Numero_Errores_Admon",
  errLogistica: "Numero_Errores_Logistica",
  errComercial: "Numero_Errores_Comerciales",
  errSistema: "Numero_Errores_Sistema",
  errCliente: "Numero_Errores_Cliente",
  devoluciones: "Total_Devoluciones_Semana",
  gross: "Valor_Facturado_Bruto",
  creditValue: "Valor_Notas_Credito",
  refactValue: "Valor_Refacturaciones",
  errAdmonValue: "Valor_Errores_Admon",
  errComercialValue: "Valor_Errores_Comerciales",
  devolTotalValue: "Valor_Devoluciones_Totales",
  devolPartialValue: "Valor_Devoluciones_Parcial",
  net: "Facturado_Neto",
  pct: "Porcentaje_NC",
  comment: "Comentario_Gerencial",
};

const NC_COLS = {
  year: "A\u00f1o_Hoja",
  monthNumber: "Mes_Numero",
  monthName: "Mes_Nombre",
  monthDate: "Fecha_Mes_Referencia",
  nc: "NC",
  invoice: "Factura_Relacionada",
  replacement: "Reemplazada_Por",
  client: "Cliente",
  advisor: "Asesor",
  origin: "Origen",
  concept: "Concepto",
  cause: "Causa_Gerencial",
  value: "Valor_NC",
  observations: "Observaciones",
  sourceSheet: "Hoja_Origen",
};

const MAP_COLS = {
  nc: "NC",
  year: "A\u00f1o",
  week: "Semana",
  key: "Llave_Semana",
  start: "Fecha_Inicial",
  end: "Fecha_Final",
};

const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
let defaultNotasPromise = null;
let defaultNotasCache = null;

function isParsedNotasPayload(payload) {
  return Boolean(payload && Array.isArray(payload.semanal) && Array.isArray(payload.ncDetail) && payload.meta);
}

function formatWeekLabel(monthNumber, weekOfMonth) {
  return `${MONTHS_SHORT[monthNumber - 1] || "Mes"} sem ${weekOfMonth}`;
}

function normalizeOrigin(value) {
  const normalized = normalizeText(value);

  if (normalized.includes("administr")) return "Administrativo";
  if (normalized.includes("comercial")) return "Comercial";
  if (normalized.includes("cliente")) return "Cliente";
  if (normalized.includes("logist")) return "Logistica";
  if (normalized.includes("sistema")) return "Sistema";
  if (normalized.includes("devol")) return "Devolucion";
  if (normalized.includes("servientrega")) return "Servientrega";
  return cleanText(value) || "Otros";
}

function normalizeCause(value) {
  const normalized = normalizeText(value);

  if (!normalized || normalized === "otros") return "Otros";
  if (normalized.includes("administr")) return "Administrativo";
  if (normalized.includes("comercial")) return "Comercial";
  if (normalized.includes("cliente")) return "Cliente";
  if (normalized.includes("devol")) return "Devolucion";
  if (normalized.includes("razon")) return "Razon social";
  if (normalized.includes("radic")) return "Radicacion";
  if (normalized.includes("correo")) return "Correo";
  if (normalized.includes("orden")) return "Orden de compra";
  return cleanText(value) || "Otros";
}

function resolveBusinessWeekDate(startDate, endDate, yearValue) {
  const businessYear = Number(yearValue || startDate?.year() || endDate?.year() || 0);

  if (startDate?.year() === businessYear && endDate?.year() === businessYear) {
    if (startDate.format("YYYY-MM") !== endDate.format("YYYY-MM")) {
      return endDate;
    }
    return startDate;
  }

  if (startDate?.year() === businessYear) {
    return startDate;
  }

  if (endDate?.year() === businessYear) {
    return endDate;
  }

  if (businessYear > 0) {
    return dayjs(`${businessYear}-01-01`, "YYYY-MM-DD", true);
  }

  return endDate || startDate || null;
}

function parseThreadedComments(tcContent) {
  const comments = [];
  const re = /<threadedComment[^>]*ref="([^"]+)"[^>]*>([\s\S]*?)<\/threadedComment>/g;
  let match;
  while ((match = re.exec(tcContent)) !== null) {
    const ref = match[1];
    const block = match[2];
    const textMatch = block.match(/<text[^>]*>([\s\S]*?)<\/text>/);
    if (textMatch) {
      let text = cleanCommentText(textMatch[1]);
      if (text && text.length > 0 && text.length < 500) {
        comments.push({ ref, text });
      }
    }
  }
  return comments;
}

function parseLegacyComments(commentsContent) {
  const comments = [];
  const re = /<comment[^>]*ref="([^"]+)"[^>]*>([\s\S]*?)<\/comment>/g;
  let match;
  while ((match = re.exec(commentsContent)) !== null) {
    const ref = match[1];
    const block = match[2];
    const textParts = [...block.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((item) => item[1]);
    const text = cleanCommentText(textParts.join(" "));
    if (text && text.length > 0 && text.length < 500) {
      comments.push({ ref, text });
    }
  }
  return comments;
}

function cleanCommentText(value) {
  let text = String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\[Comentario encadenado\]/gi, " ")
    .replace(/Comentario:/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return "";
  }

  return cleanText(text);
}

function getWorkbookFileText(workbook, path) {
  const entry = workbook?.files?.[path];
  if (!entry) {
    return "";
  }

  if (typeof entry === "string") {
    return entry;
  }

  if (typeof entry.content === "string") {
    return entry.content;
  }

  if (typeof entry.asText === "function") {
    return entry.asText();
  }

  return "";
}

function resolveZipPath(basePath, relativePath) {
  const baseParts = basePath.split("/").slice(0, -1);
  const nextParts = relativePath.split("/");
  const resolved = [...baseParts];

  nextParts.forEach((part) => {
    if (!part || part === ".") {
      return;
    }
    if (part === "..") {
      resolved.pop();
      return;
    }
    resolved.push(part);
  });

  return resolved.join("/");
}

function parseSheetRelationshipTargets(xmlText, types) {
  const targets = [];
  const re = /<Relationship[^>]*Type="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g;
  let match;
  while ((match = re.exec(xmlText)) !== null) {
    const type = match[1];
    const target = match[2];
    if (types.some((expected) => type.includes(expected))) {
      targets.push(target);
    }
  }
  return targets;
}

function resolveSheetPath(workbook, sheetName) {
  const workbookXml = getWorkbookFileText(workbook, "xl/workbook.xml");
  const relsXml = getWorkbookFileText(workbook, "xl/_rels/workbook.xml.rels");

  if (!workbookXml || !relsXml) {
    return null;
  }

  const sheetMatch = [...workbookXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].find(
    (match) => match[1] === sheetName
  );

  if (!sheetMatch) {
    return null;
  }

  const relId = sheetMatch[2];
  const relMatch = [...relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].find(
    (match) => match[1] === relId
  );

  if (!relMatch) {
    return null;
  }

  return `xl/${relMatch[2].replace(/^\/+/, "")}`;
}

function buildWeeklyRows(rows, cellComments) {
  const commentsByRow = new Map();
  if (cellComments) {
    cellComments.forEach(({ ref, text }) => {
      const refRow = parseInt(ref.replace(/[A-Z]+/, ""), 10);
      if (!Number.isFinite(refRow)) {
        return;
      }

      if (!commentsByRow.has(refRow)) {
        commentsByRow.set(refRow, []);
      }

      commentsByRow.get(refRow).push(text);
    });
  }

  const sorted = [...rows]
    .map((row) => {
      const startDate = parseSpreadsheetDate(row[WEEKLY_COLS.start]);
      const endDate = parseSpreadsheetDate(row[WEEKLY_COLS.end]) || startDate;
      const year = Number(row[WEEKLY_COLS.year] || endDate?.year() || startDate?.year() || 0);
      const businessDate = resolveBusinessWeekDate(startDate, endDate, year);
      const monthNumber = businessDate?.month() != null ? businessDate.month() + 1 : 1;

      return {
        year,
        week: Number(row[WEEKLY_COLS.week] || 0),
        llave: cleanText(row[WEEKLY_COLS.key]),
        fechaInicial: startDate?.toDate() || null,
        fechaFinal: endDate?.toDate() || null,
        fechaInicialIso: startDate?.format("YYYY-MM-DD") || null,
        fechaFinalIso: endDate?.format("YYYY-MM-DD") || null,
        monthNumber,
        monthKey: businessDate?.format("YYYY-MM") || null,
        numFacturas: parseFlexibleNumber(row[WEEKLY_COLS.invoices], 0),
        numNc: parseFlexibleNumber(row[WEEKLY_COLS.notes], 0),
        numNcRefact: parseFlexibleNumber(row[WEEKLY_COLS.refact], 0),
        errAdmon: parseFlexibleNumber(row[WEEKLY_COLS.errAdmon], 0),
        errLogistica: parseFlexibleNumber(row[WEEKLY_COLS.errLogistica], 0),
        errComercial: parseFlexibleNumber(row[WEEKLY_COLS.errComercial], 0),
        errSistema: parseFlexibleNumber(row[WEEKLY_COLS.errSistema], 0),
        errCliente: parseFlexibleNumber(row[WEEKLY_COLS.errCliente], 0),
        devoluciones: parseFlexibleNumber(row[WEEKLY_COLS.devoluciones], 0),
        valorBruto: parseFlexibleNumber(row[WEEKLY_COLS.gross], 0),
        valorNc: parseFlexibleNumber(row[WEEKLY_COLS.creditValue], 0),
        valorRefact: parseFlexibleNumber(row[WEEKLY_COLS.refactValue], 0),
        valorErrAdmon: parseFlexibleNumber(row[WEEKLY_COLS.errAdmonValue], 0),
        valorErrComercial: parseFlexibleNumber(row[WEEKLY_COLS.errComercialValue], 0),
        valorDevTotales: parseFlexibleNumber(row[WEEKLY_COLS.devolTotalValue], 0),
        valorDevParcial: parseFlexibleNumber(row[WEEKLY_COLS.devolPartialValue], 0),
        facturadoNeto: parseFlexibleNumber(row[WEEKLY_COLS.net], 0),
        pctNc: Number(row[WEEKLY_COLS.pct] || 0),
        comentario: cleanText(row[WEEKLY_COLS.comment]),
        notaCelda: null, // populated below
      };
    })
    .filter((row) => row.llave && row.fechaInicialIso)
    .sort((a, b) => a.fechaInicialIso.localeCompare(b.fechaInicialIso));

  const monthCounters = new Map();
  return sorted.map((row, index) => {
    const excelRow = index + 2; // Row 1 is header, data starts at row 2
    const rowComments = commentsByRow.get(excelRow) || [];

    const counterKey = `${row.year}-${String(row.monthNumber).padStart(2, "0")}`;
    const nextCount = (monthCounters.get(counterKey) || 0) + 1;
    monthCounters.set(counterKey, nextCount);

    return {
      ...row,
      notaCelda: rowComments.length > 0 ? [...new Set(rowComments)].join(" | ") : null,
      weekOfMonth: nextCount,
      monthLabel: MONTHS_SHORT[row.monthNumber - 1] || "Mes",
      label: formatWeekLabel(row.monthNumber, nextCount),
    };
  });
}

function buildWeekMap(rows) {
  const map = new Map();
  rows.forEach((row) => {
    map.set(row.llave, row);
  });
  return map;
}

function buildNcWeekMap(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const ncKey = String(parseFlexibleNumber(row[MAP_COLS.nc], 0));
    if (!ncKey || ncKey === "0") {
      return;
    }

    map.set(ncKey, {
      year: Number(row[MAP_COLS.year] || 0),
      week: Number(row[MAP_COLS.week] || 0),
      llave: cleanText(row[MAP_COLS.key]),
      fechaInicialIso: parseSpreadsheetDate(row[MAP_COLS.start])?.format("YYYY-MM-DD") || null,
      fechaFinalIso: parseSpreadsheetDate(row[MAP_COLS.end])?.format("YYYY-MM-DD") || null,
    });
  });
  return map;
}

function buildNcRows(rows, ncWeekMap, weekMap) {
  let unmappedCount = 0;

  const parsed = rows
    .map((row, index) => {
      const ncNumber = parseFlexibleNumber(row[NC_COLS.nc], 0);
      const ncKey = String(ncNumber || "");
      const mappedWeek = ncWeekMap.get(ncKey) || null;
      const weekMeta = mappedWeek?.llave ? weekMap.get(mappedWeek.llave) || null : null;
      if (!mappedWeek) {
        unmappedCount += 1;
      }

      const monthDate = parseSpreadsheetDate(row[NC_COLS.monthDate]);
      const monthNumber = Number(row[NC_COLS.monthNumber] || monthDate?.month() + 1 || 0);

      return {
        id: `${ncKey || "nc"}-${index}`,
        nc: ncNumber || null,
        factura: cleanText(row[NC_COLS.invoice]),
        reemplazadaPor: cleanText(row[NC_COLS.replacement]),
        cliente: cleanText(row[NC_COLS.client]),
        asesor: cleanText(row[NC_COLS.advisor]) || "Sin responsable",
        origen: normalizeOrigin(row[NC_COLS.origin]),
        concepto: cleanText(row[NC_COLS.concept]),
        causa: normalizeCause(row[NC_COLS.cause]),
        valor: parseFlexibleNumber(row[NC_COLS.value], 0),
        observacion: cleanText(row[NC_COLS.observations]),
        hojaOrigen: cleanText(row[NC_COLS.sourceSheet]),
        year: Number(row[NC_COLS.year] || monthDate?.year() || weekMeta?.year || 0),
        monthNumber,
        monthLabel: MONTHS_SHORT[monthNumber - 1] || cleanText(row[NC_COLS.monthName]),
        monthRef: monthDate?.format("YYYY-MM-DD") || null,
        llaveSemana: mappedWeek?.llave || null,
        weekLabel: weekMeta?.label || null,
        fechaInicialIso: weekMeta?.fechaInicialIso || mappedWeek?.fechaInicialIso || null,
        fechaFinalIso: weekMeta?.fechaFinalIso || mappedWeek?.fechaFinalIso || null,
      };
    })
    .filter((row) => row.nc);

  return { parsed, unmappedCount };
}

function buildRangeLabel(weeks) {
  if (!weeks.length) {
    return "Sin rango";
  }

  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  return `${first.label} ${first.year} - ${last.label} ${last.year}`;
}

function extractSheetCommentsFromWorkbook(workbook, sheetName) {
  try {
    const sheetPath = resolveSheetPath(workbook, sheetName);
    if (!sheetPath) {
      return [];
    }

    const relsPath = `xl/worksheets/_rels/${sheetPath.split("/").pop()}.rels`;
    const relsXml = getWorkbookFileText(workbook, relsPath);
    if (!relsXml) {
      return [];
    }

    const threadedTargets = parseSheetRelationshipTargets(relsXml, ["threadedComment"]);
    const legacyTargets = parseSheetRelationshipTargets(relsXml, ["/comments"]);

    const collected = [
      ...threadedTargets.flatMap((target) =>
        parseThreadedComments(getWorkbookFileText(workbook, resolveZipPath(sheetPath, target)))
      ),
      ...legacyTargets.flatMap((target) =>
        parseLegacyComments(getWorkbookFileText(workbook, resolveZipPath(sheetPath, target)))
      ),
    ];

    if (!collected.length) {
      return [];
    }

    const deduped = new Map();
    collected.forEach((item) => {
      const key = `${item.ref}::${item.text}`;
      if (!deduped.has(key)) {
        deduped.set(key, item);
      }
    });

    return [...deduped.values()];
  } catch {
    // Comments not available
  }
  return [];
}

export async function parseNotasWorkbooks(weeklyWorkbook, ncWorkbook, sourceName) {
  const weeklySheet = weeklyWorkbook.Sheets[WEEKLY_SHEET];
  const mapSheet = weeklyWorkbook.Sheets[MAP_SHEET];
  const ncSheet = ncWorkbook.Sheets[NC_SHEET];

  if (!weeklySheet) {
    throw new Error(`No se encontr\u00f3 la hoja ${WEEKLY_SHEET} en reporte semanal de facturacion.xlsx.`);
  }

  if (!mapSheet) {
    throw new Error(`No se encontr\u00f3 la hoja ${MAP_SHEET} en reporte semanal de facturacion.xlsx.`);
  }

  if (!ncSheet) {
    throw new Error(`No se encontr\u00f3 la hoja ${NC_SHEET} en NOTAS CREDITO 2026.xlsx.`);
  }

  const cellComments = extractSheetCommentsFromWorkbook(weeklyWorkbook, WEEKLY_SHEET);
  const [weeklySheetRows, mapSheetRows, ncSheetRows] = await Promise.all([
    sheetToJson(weeklySheet),
    sheetToJson(mapSheet),
    sheetToJson(ncSheet),
  ]);
  const weeklyRows = buildWeeklyRows(weeklySheetRows, cellComments);
  const weekMap = buildWeekMap(weeklyRows);
  const ncWeekMap = buildNcWeekMap(mapSheetRows);
  const { parsed: ncRows, unmappedCount } = buildNcRows(ncSheetRows, ncWeekMap, weekMap);

  const years = [...new Set(weeklyRows.map((row) => row.year))].sort((a, b) => a - b);
  const latestYear = years[years.length - 1] || null;

  return {
    semanal: weeklyRows,
    ncDetail: ncRows,
    meta: {
      sourceName,
      weeklySheet: WEEKLY_SHEET,
      ncSheet: NC_SHEET,
      mapSheet: MAP_SHEET,
      validRows: weeklyRows.length + ncRows.length,
      skippedRows: 0,
      range: {
        start: weeklyRows[0]?.monthKey || null,
        end: weeklyRows[weeklyRows.length - 1]?.monthKey || null,
      },
      rangeLabel: buildRangeLabel(weeklyRows),
      years,
      latestYear,
      stats: {
        weeklyRows: weeklyRows.length,
        ncRows: ncRows.length,
        mappedNc: ncRows.length - unmappedCount,
        unmappedNc: unmappedCount,
      },
    },
  };
}

export async function loadDefaultNotasExcel() {
  if (defaultNotasCache) {
    return defaultNotasCache;
  }

  if (!defaultNotasPromise) {
    defaultNotasPromise = (async () => {
      const cachedPayload = await readDataCacheFromURL(DEFAULT_NOTAS_CACHE_URL, isParsedNotasPayload);

      if (cachedPayload) {
        defaultNotasCache = cachedPayload;
        return cachedPayload;
      }

      const [weeklyWorkbook, ncWorkbook] = await Promise.all([
        readWorkbookFromURL(WEEKLY_URL, { includeWorkbookFiles: true }),
        readWorkbookFromURL(NC_URL),
      ]);

      const parsedWorkbooks = await parseNotasWorkbooks(
        weeklyWorkbook,
        ncWorkbook,
        "reporte semanal + notas credito"
      );
      defaultNotasCache = parsedWorkbooks;
      return parsedWorkbooks;
    })().catch((error) => {
      defaultNotasPromise = null;
      throw error;
    });
  }

  return defaultNotasPromise;
}

export async function parseNotasCreditoFiles(files) {
  if (!files || files.length < 2) {
    return loadDefaultNotasExcel();
  }

  const weeklyFile =
    files.find((file) => normalizeText(file.name).includes("reporte semanal")) ||
    files.find((file) => normalizeText(file.name).includes("semanal")) ||
    files[0];
  const ncFile =
    files.find((file) => normalizeText(file.name).includes("notas credito")) ||
    files.find((file) => normalizeText(file.name).includes("credito 2026")) ||
    files[1];

  const [weeklyWorkbook, ncWorkbook] = await Promise.all([
    readWorkbookFromFile(weeklyFile, { includeWorkbookFiles: true }),
    readWorkbookFromFile(ncFile),
  ]);

  return parseNotasWorkbooks(weeklyWorkbook, ncWorkbook, `${weeklyFile.name} + ${ncFile.name}`);
}
