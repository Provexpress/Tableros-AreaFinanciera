import { create } from "zustand";
import { applyFacturasFilters, computeFacturasDerivedState } from "@/store/facturasDerived";
import { FILTER_BATCH_IDLE_STATE, scheduleBatchedFilterRecompute } from "@/store/filterBatcher";
import {
  getFacturasDatesForPeriod,
  getFacturasPeriodDefaults,
  getFacturasPeriods,
  getFacturasYears,
  isSingleValueRange,
  sameRange,
} from "@/utils/facturasTime";

const initialFilters = {
  year: "ALL",
  month: "ALL",
  semester: "ALL",
  quarter: "ALL",
  category: "ALL",
  provider: "",
  status: "ALL",
  periodRange: [null, null],
  dateRange: [null, null],
  selectedPeriods: [],
  selectedDates: [],
};

function sameList(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sanitizeFilters(rawData, filters, meta) {
  const next = { ...filters };
  const years = getFacturasYears(rawData);

  if (next.year !== "ALL" && !years.includes(String(next.year))) {
    next.year = "ALL";
  }

  const monthValue = Number(next.month);
  if (next.month !== "ALL" && (!Number.isFinite(monthValue) || monthValue < 1 || monthValue > 12)) {
    next.month = "ALL";
  }

  const semesterValue = Number(next.semester);
  if (next.semester !== "ALL" && (!Number.isFinite(semesterValue) || semesterValue < 1 || semesterValue > 2)) {
    next.semester = "ALL";
  }

  const quarterValue = Number(next.quarter);
  if (next.quarter !== "ALL" && (!Number.isFinite(quarterValue) || quarterValue < 1 || quarterValue > 4)) {
    next.quarter = "ALL";
  }

  if (next.month !== "ALL") {
    next.semester = "ALL";
    next.quarter = "ALL";
  } else if (next.quarter !== "ALL") {
    next.semester = "ALL";
  }

  const periods = getFacturasPeriods(rawData, next.year);
  const [defaultStart, defaultEnd] = getFacturasPeriodDefaults(periods, next.year, meta?.range);
  next.selectedPeriods = [...new Set((next.selectedPeriods || []).filter((period) => periods.includes(period)))].sort((a, b) =>
    a.localeCompare(b)
  );

  if (next.selectedPeriods.length) {
    next.periodRange = [
      next.selectedPeriods[0],
      next.selectedPeriods[next.selectedPeriods.length - 1],
    ];
    next.month = next.selectedPeriods.length === 1 ? String(Number(next.selectedPeriods[0].split("-")[1])) : "ALL";
    next.semester = "ALL";
    next.quarter = "ALL";
  }

  const requestedStart = next.periodRange?.[0] || defaultStart;
  const requestedEnd = next.periodRange?.[1] || defaultEnd;

  if (!next.selectedPeriods.length) {
    next.periodRange = [
      periods.includes(requestedStart) ? requestedStart : defaultStart,
      periods.includes(requestedEnd) ? requestedEnd : defaultEnd,
    ];
  }

  if (
    next.periodRange[0] &&
    next.periodRange[1] &&
    next.periodRange[0].localeCompare(next.periodRange[1]) > 0
  ) {
    next.periodRange = [next.periodRange[1], next.periodRange[1]];
  }

  if (!isSingleValueRange(next.periodRange)) {
    next.dateRange = [null, null];
    next.selectedDates = [];
    return next;
  }

  const selectedPeriod = next.periodRange[0];
  const availableDates = getFacturasDatesForPeriod(rawData, selectedPeriod);
  const defaultDateRange = [availableDates[0] || null, availableDates[availableDates.length - 1] || null];
  next.selectedDates = [...new Set((next.selectedDates || []).filter((date) => availableDates.includes(date)))].sort((a, b) =>
    a.localeCompare(b)
  );

  if (next.selectedDates.length) {
    next.dateRange = [
      next.selectedDates[0],
      next.selectedDates[next.selectedDates.length - 1],
    ];
    return next;
  }

  const requestedDateStart = next.dateRange?.[0] || defaultDateRange[0];
  const requestedDateEnd = next.dateRange?.[1] || defaultDateRange[1];

  next.dateRange = [
    availableDates.includes(requestedDateStart) ? requestedDateStart : defaultDateRange[0],
    availableDates.includes(requestedDateEnd) ? requestedDateEnd : defaultDateRange[1],
  ];

  if (next.dateRange[0] && next.dateRange[1] && next.dateRange[0].localeCompare(next.dateRange[1]) > 0) {
    next.dateRange = [next.dateRange[1], next.dateRange[1]];
  }

  return next;
}

function recompute(rawData, filters, focusPeriod, meta) {
  const safeFilters = sanitizeFilters(rawData, filters, meta);
  const filteredData = applyFacturasFilters(rawData, safeFilters);

  return {
    filters: safeFilters,
    ...computeFacturasDerivedState(filteredData, safeFilters, focusPeriod),
  };
}

function isCreditNote(row) {
  return (
    Number(row.signoDocumento || 1) < 0 ||
    String(row.tipoDocNormalizado || row.tipoDoc || "").toLowerCase().includes("nota de cr")
  );
}

function getDocumentValue(row) {
  return Math.abs(Number(row.totalOriginal ?? row.total ?? 0));
}

function getNetValue(row) {
  return Number(row.total || 0);
}

function normalizeCategoryLabel(value) {
  const text = String(value || "").trim();
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized.includes("tecnolog")) {
    return "Tecnología";
  }

  if (normalized.includes("pac") && normalized.includes("tec")) {
    return "Pac/tec";
  }

  return text || "Otros";
}

function normalizeMergedRow(row) {
  return {
    ...row,
    categoria: normalizeCategoryLabel(row.categoria),
  };
}

function normalizeDocumentMatchKey(value) {
  return String(value || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "");
}

function normalizeProviderMatchKey(value) {
  return String(value || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b(SAS|SA|S A S|S A|LTDA|LTD|SUCURSAL|COLOMBIA|DE|DEL|LA|EL|LOS|LAS)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDocumentMatchKeys(row) {
  return [
    row.numeroDocumento,
    row.folio,
    [row.prefijo, row.folio].filter(Boolean).join("-"),
  ]
    .map(normalizeDocumentMatchKey)
    .filter(Boolean);
}

function buildPurchaseDocumentResolver(excelRows = []) {
  const byProviderDocument = new Map();
  const byDocument = new Map();

  excelRows.forEach((row) => {
    if (isCreditNote(row)) {
      return;
    }

    const providerKey = normalizeProviderMatchKey(row.proveedor);
    getDocumentMatchKeys(row).forEach((documentKey) => {
      const compoundKey = `${providerKey}|${documentKey}`;
      if (providerKey && !byProviderDocument.has(compoundKey)) {
        byProviderDocument.set(compoundKey, row);
      }
      if (!byDocument.has(documentKey)) {
        byDocument.set(documentKey, row);
      }
    });
  });

  return (invoice) => {
    const providerKey = normalizeProviderMatchKey(invoice.proveedor);
    const documentKeys = getDocumentMatchKeys(invoice);

    for (const documentKey of documentKeys) {
      const compoundKey = `${providerKey}|${documentKey}`;
      if (byProviderDocument.has(compoundKey)) {
        return byProviderDocument.get(compoundKey);
      }
    }

    for (const documentKey of documentKeys) {
      if (byDocument.has(documentKey)) {
        return byDocument.get(documentKey);
      }
    }

    return null;
  };
}

function enrichApiPurchasesWithExcelStatus(apiRows = [], excelRows = []) {
  if (!excelRows.length) {
    return apiRows;
  }

  const resolveDocument = buildPurchaseDocumentResolver(excelRows);

  return apiRows.map((invoice) => {
    const excelDocument = resolveDocument(invoice);
    if (!excelDocument) {
      return invoice;
    }

    return {
      ...invoice,
      estado: excelDocument.estado || invoice.estado,
      fechaRecepcion: excelDocument.fechaRecepcion || invoice.fechaRecepcion,
      fechaRecepcionIso: excelDocument.fechaRecepcionIso || invoice.fechaRecepcionIso,
      oc: excelDocument.oc || invoice.oc,
      obs1: excelDocument.obs1 || invoice.obs1,
      obs2: excelDocument.obs2 || invoice.obs2,
      observacionContabilidad: excelDocument.observacionContabilidad || invoice.observacionContabilidad,
      observacionRechazos: excelDocument.observacionRechazos || invoice.observacionRechazos,
      conciliacion: excelDocument.conciliacion || invoice.conciliacion,
      validacion: excelDocument.validacion || invoice.validacion,
      motivoRechazo: excelDocument.motivoRechazo || invoice.motivoRechazo,
      observacion: excelDocument.observacion || invoice.observacion,
      fuenteEstadoDocumental: excelDocument.fuenteArchivo || "Control Facturas.xlsx",
    };
  });
}

function getReconciliationKey(row) {
  const period = String(row.periodo || "");
  const provider = String(row.proveedor || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  return `${period}|${provider}`;
}

function groupCreditNotesForReconciliation(apiRows, creditNoteRows) {
  const apiGrossByKey = new Map();
  const creditNotesByKey = new Map();

  apiRows.forEach((row) => {
    const key = getReconciliationKey(row);
    apiGrossByKey.set(key, (apiGrossByKey.get(key) || 0) + Math.abs(getNetValue(row)));
  });

  creditNoteRows.forEach((row) => {
    const key = getReconciliationKey(row);
    const bucket = creditNotesByKey.get(key) || {
      key,
      period: row.periodo || "",
      provider: row.proveedor || "",
      rows: [],
      total: 0,
    };

    bucket.rows.push(row);
    bucket.total += getDocumentValue(row);
    creditNotesByKey.set(key, bucket);
  });

  return [...creditNotesByKey.values()].map((bucket) => ({
    ...bucket,
    apiGross: apiGrossByKey.get(bucket.key) || 0,
  }));
}

function reconcileExcelCreditNotesWithApi(apiRows, creditNoteRows) {
  const tolerance = 1.01;
  const matched = [];
  const unmatched = [];
  const unmatchedGroups = [];

  const groups = groupCreditNotesForReconciliation(apiRows, creditNoteRows);
  groups.forEach((group) => {
    const hasVisibleBase = group.apiGross > 0 && group.total <= group.apiGross * tolerance;

    if (hasVisibleBase) {
      matched.push(...group.rows);
      return;
    }

    unmatched.push(...group.rows);
    unmatchedGroups.push({
      period: group.period,
      provider: group.provider,
      apiGross: group.apiGross,
      creditNoteTotal: group.total,
      rows: group.rows.length,
    });
  });

  return {
    matched,
    unmatched,
    unmatchedGroups: unmatchedGroups
      .sort((a, b) => b.creditNoteTotal - a.creditNoteTotal)
      .slice(0, 20),
  };
}

function mergeApiPurchasesWithExcelCreditNotes(apiResult, excelResult) {
  if (!apiResult?.data?.length) {
    return excelResult;
  }

  const creditNoteRows = (excelResult?.data || []).filter(isCreditNote);
  const reconciledCreditNotes = reconcileExcelCreditNotesWithApi(apiResult.data, creditNoteRows);
  const enrichedApiRows = enrichApiPurchasesWithExcelStatus(apiResult.data, excelResult?.data || []);
  const matchedDocumentStates = enrichedApiRows.filter((row) => row.fuenteEstadoDocumental).length;
  const data = [...enrichedApiRows, ...reconciledCreditNotes.matched].map(normalizeMergedRow).sort(
    (a, b) =>
      String(a.periodo || "").localeCompare(String(b.periodo || "")) ||
      String(a.proveedor || "").localeCompare(String(b.proveedor || ""))
  );

  return {
    data,
    meta: {
      ...apiResult.meta,
      sourceName: `${apiResult.meta?.sourceName || "API contable compras PBI"} + NC compra Excel`,
      validRows: data.length,
      skippedRows: apiResult.meta?.skippedRows || 0,
      range: {
        start: data[0]?.periodo || apiResult.meta?.range?.start || null,
        end: data[data.length - 1]?.periodo || apiResult.meta?.range?.end || null,
      },
      stats: {
        ...(apiResult.meta?.stats || {}),
        purchaseInvoicesSource: "API contable compras PBI",
        purchaseCreditNotesSource: excelResult?.meta?.sourceName || "Control Facturas.xlsx",
        purchaseCreditNotesRows: creditNoteRows.length,
        purchaseCreditNotesMatchedRows: reconciledCreditNotes.matched.length,
        purchaseCreditNotesUnmatchedRows: reconciledCreditNotes.unmatched.length,
        purchaseCreditNotesMatchedTotal: reconciledCreditNotes.matched.reduce((sum, row) => sum + getDocumentValue(row), 0),
        purchaseCreditNotesUnmatchedTotal: reconciledCreditNotes.unmatched.reduce((sum, row) => sum + getDocumentValue(row), 0),
        purchaseCreditNotesUnmatchedGroups: reconciledCreditNotes.unmatchedGroups,
        purchaseDocumentStatusSource: excelResult?.meta?.sourceName || "Control Facturas.xlsx",
        purchaseDocumentStatusMatchedRows: matchedDocumentStates,
      },
    },
  };
}

export const useFacturasStore = create((set, get) => ({
  rawData: [],
  filteredData: [],
  analysisData: [],
  filters: { ...initialFilters },
  focusPeriod: "ALL",
  isLoading: false,
  error: null,
  sourceMeta: null,
  sourceName: "Control Facturas.xlsx",
  totalGasto: 0,
  countFacturas: 0,
  byPeriod: [],
  byCategory: [],
  byProvider: [],
  topProviders: [],
  momChanges: [],
  topInsights: [],
  approvalRate: 0,
  rejectedCount: 0,
  latestPeriod: null,
  latestPct: 0,
  averageMonthly: 0,
  categoryTrendSeries: [],
  stackedSeries: [],
  providerTrendSeries: [],
  providerComparisonRows: [],
  activePeriod: null,
  activePrevious: null,
  activePct: 0,
  activeDriver: "-",
  periodContext: null,
  periods: [],
  detailSummary: {
    total: 0,
    count: 0,
    approvalRate: 0,
  },
  documentSummary: {
    purchaseInvoiceCount: 0,
    purchaseInvoiceTotal: 0,
    creditNoteCount: 0,
    creditNoteTotal: 0,
    debitNoteCount: 0,
    debitNoteTotal: 0,
    grossTotal: 0,
    netTotal: 0,
    documentCount: 0,
    avgTicket: 0,
    creditNoteShare: 0,
  },
  documentStatus: [],
  documentRowsByStatus: {
    Rechazado: [],
    "En revision": [],
    Aprobado: [],
  },
  purchaseInvoiceRows: [],
  creditNoteRows: [],
  statusTrend: [],
  supplierAccountingRanking: [],
  supplierRankingByCategory: {},
  supplierIncidentRanking: [],
  rejectionReasons: [],
  yearAccumulated: {
    year: null,
    total: 0,
    count: 0,
  },
  activeMonthDailySpend: [],
  topExpenseDay: null,
  monthlyTotals: [],
  ...FILTER_BATCH_IDLE_STATE,

  loadDefaultWorkbook: async () => {
    if (get().rawData.length || get().isLoading) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const { loadDefaultComprasPbi } = await import("@/utils/parseComprasPbi");
      const { loadDefaultExcel } = await import("@/utils/parseExcel");
      const excelResult = await loadDefaultExcel();
      const apiResult = await loadDefaultComprasPbi().catch(() => null);
      const result = apiResult ? mergeApiPurchasesWithExcelCreditNotes(apiResult, excelResult) : excelResult;
      const periodRange = [result.meta.range.start, result.meta.range.end];
      const filters = { ...initialFilters, periodRange };
      const computed = recompute(result.data, filters, "ALL", result.meta);

      set({
        rawData: result.data,
        sourceMeta: result.meta,
        sourceName: result.meta.sourceName,
        isLoading: false,
        error: null,
        ...computed,
      });
    } catch (error) {
      set({
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible cargar la tabla maestra de facturas.",
      });
    }
  },

  loadWorkbookFile: async (file) => {
    if (!file) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const { parseExcelFile } = await import("@/utils/parseExcel");
      const result = await parseExcelFile(file);
      const periodRange = [result.meta.range.start, result.meta.range.end];
      const filters = { ...initialFilters, periodRange };
      const computed = recompute(result.data, filters, "ALL", result.meta);

      set({
        rawData: result.data,
        sourceMeta: result.meta,
        sourceName: file.name,
        isLoading: false,
        error: null,
        ...computed,
      });
    } catch (error) {
      set({
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible procesar el archivo Excel cargado.",
      });
    }
  },

  setFilters: (partial) => {
    const current = get().filters;
    const nextFilters = { ...current, ...partial };

    if (
      nextFilters.year === current.year &&
      nextFilters.month === current.month &&
      nextFilters.semester === current.semester &&
      nextFilters.quarter === current.quarter &&
      nextFilters.category === current.category &&
      nextFilters.provider === current.provider &&
      nextFilters.status === current.status &&
      sameRange(nextFilters.periodRange, current.periodRange) &&
      sameRange(nextFilters.dateRange, current.dateRange) &&
      sameList(nextFilters.selectedPeriods || [], current.selectedPeriods || []) &&
      sameList(nextFilters.selectedDates || [], current.selectedDates || [])
    ) {
      return;
    }

    set({ filters: nextFilters });

    scheduleBatchedFilterRecompute({
      get,
      set,
      compute: (state) => recompute(state.rawData, state.filters, state.focusPeriod, state.sourceMeta),
    });
  },

  setFocusPeriod: (period) => {
    const nextFocus = !period || get().focusPeriod === period ? "ALL" : period;
    const computed = recompute(get().rawData, get().filters, nextFocus, get().sourceMeta);
    set({
      ...FILTER_BATCH_IDLE_STATE,
      ...computed,
    });
  },

  clearFilters: () => {
    const range = get().sourceMeta?.range || { start: null, end: null };
    const filters = {
      ...initialFilters,
      periodRange: [range.start, range.end],
    };
    const computed = recompute(get().rawData, filters, "ALL", get().sourceMeta);

    set({
      ...FILTER_BATCH_IDLE_STATE,
      ...computed,
    });
  },
}));
