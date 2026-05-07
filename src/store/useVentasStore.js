import { create } from "zustand";
import { applyFacturasFilters, computeFacturasDerivedState } from "@/store/facturasDerived";
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

function mapAcuseStatus(row) {
  if (row.esRechazada) {
    return "Rechazado";
  }

  if (row.esPagaSistema || String(row.estadoDian || "").toLowerCase().includes("aprob")) {
    return "Aprobado";
  }

  return "En revision";
}

function mapVentasAcusesRows(rows = []) {
  return rows.map((row, index) => {
    const fechaIso = row.fechaEmision || "";
    const fecha = fechaIso ? new Date(`${fechaIso}T00:00:00`) : null;
    const cliente = row.nombreCliente || row.clienteNormalizado || "Sin cliente";
    const observacion = row.observaciones || row.estadoAcuse || "-";

    return {
      id: row.llaveDocumento || `venta-acuse-${row.numeroDocumento || index}`,
      fecha,
      fechaIso,
      fechaRecepcion: row.fechaRecepcion ? new Date(String(row.fechaRecepcion).replace(" ", "T")) : fecha,
      fechaRecepcionIso: row.fechaRecepcion || fechaIso,
      total: Number(row.total || 0),
      totalOriginal: Number(row.total || 0),
      totalAjustado: Number(row.total || 0),
      categoria: "Ventas",
      proveedor: cliente,
      cliente,
      clienteNormalizado: row.clienteNormalizado || cliente,
      estado: mapAcuseStatus(row),
      estadoAcuse: row.estadoAcuse,
      tipoDoc: row.tipoDocumento || "Factura de venta",
      tipoDocNormalizado: "Factura de venta",
      signoDocumento: 1,
      prefijo: row.prefijo || "FV",
      folio: row.folio || "",
      numeroDocumento: row.numeroDocumento || row.folio || "-",
      nit: row.nitCliente || "",
      periodo: row.periodo || "",
      anio: row.anio,
      mesNum: row.mesNum,
      oc: "",
      obs1: row.estadoAcuse || "",
      obs2: row.observaciones || "",
      observacionContabilidad: "",
      observacionRechazos: row.esRechazada ? observacion : "",
      conciliacion: "",
      validacion: row.estadoDian || "",
      motivoRechazo: row.esRechazada ? observacion : "",
      observacion,
      fuenteArchivo: row.fuenteArchivo,
      fuenteHoja: row.fuenteHoja,
    };
  });
}

function normalizeClientMatchKey(value) {
  return String(value || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b(SAS|SA|S A S|S A|LTDA|LTD|SUCURSAL|COLOMBIA|DE|DEL|LA|EL|LOS|LAS)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenScore(sourceTokens, targetTokens) {
  if (!sourceTokens.length || !targetTokens.length) return 0;
  const targetSet = new Set(targetTokens);
  const matches = sourceTokens.filter((token) => targetSet.has(token)).length;
  return matches / sourceTokens.length;
}

function buildClientResolver(rows = []) {
  const candidates = new Map();

  rows.forEach((row) => {
    const label = row.cliente || row.proveedor || "Sin cliente";
    const key = normalizeClientMatchKey(label);
    if (!key || candidates.has(label)) return;
    candidates.set(label, { label, key, tokens: key.split(" ").filter(Boolean) });
  });

  const candidateRows = [...candidates.values()];
  const exact = new Map(candidateRows.map((row) => [row.key, row.label]));

  return (value) => {
    const rawLabel = value || "Sin cliente";
    const key = normalizeClientMatchKey(rawLabel);
    if (!key) return rawLabel;
    if (exact.has(key)) return exact.get(key);

    const direct = candidateRows.find((row) => row.key.includes(key) || key.includes(row.key));
    if (direct) return direct.label;

    const sourceTokens = key.split(" ").filter(Boolean);
    const scored = candidateRows
      .map((row) => ({ row, score: tokenScore(sourceTokens, row.tokens) }))
      .filter((item) => item.score >= 0.65)
      .sort((a, b) => b.score - a.score || b.row.key.length - a.row.key.length);

    return scored[0]?.row.label || rawLabel;
  };
}

function getNcPeriod(row) {
  const rawPeriod = String(row.monthRef || row.fechaInicialIso || "").trim();
  return /^\d{4}-\d{2}/.test(rawPeriod) ? rawPeriod.slice(0, 7) : "";
}

function mapVentasCreditRows(rows = [], resolveClient = (value) => value || "Sin cliente") {
  return rows.map((row, index) => {
    const value = Math.abs(Number(row.valor || 0));
    const cliente = resolveClient(row.cliente);
    const periodo = getNcPeriod(row);
    const fechaIso = row.fechaInicialIso || row.monthRef || "";
    const monthNumber = Number(row.monthNumber || periodo.slice(5, 7) || 0);

    return {
      id: row.id || `venta-nc-${row.nc || index}`,
      fecha: fechaIso ? new Date(`${fechaIso}T00:00:00`) : null,
      fechaIso,
      fechaRecepcion: fechaIso ? new Date(`${fechaIso}T00:00:00`) : null,
      fechaRecepcionIso: fechaIso,
      total: -value,
      totalOriginal: value,
      totalAjustado: -value,
      categoria: "Ventas",
      proveedor: cliente,
      cliente,
      clienteNormalizado: cliente,
      estado: "Aprobado",
      tipoDoc: "Nota credito de venta",
      tipoDocNormalizado: "Nota de credito de venta",
      signoDocumento: -1,
      prefijo: "NC",
      folio: row.nc || "",
      numeroDocumento: row.nc || "-",
      nit: "",
      periodo,
      anio: Number(row.year || periodo.slice(0, 4) || 0),
      mesNum: monthNumber,
      oc: "",
      obs1: row.causa || "",
      obs2: row.observacion || "",
      observacionContabilidad: "",
      observacionRechazos: "",
      conciliacion: "",
      validacion: row.factura || "",
      motivoRechazo: "",
      observacion: row.observacion || row.concepto || row.causa || "-",
      fuenteArchivo: "NOTAS CREDITO 2026.xlsx",
      fuenteHoja: row.hojaOrigen || "Maestro_NC",
    };
  });
}

function sameList(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sanitizeFilters(rawData, filters, meta) {
  const next = { ...filters, category: "ALL", status: "ALL" };
  const years = getFacturasYears(rawData);

  if (next.year !== "ALL" && !years.includes(String(next.year))) {
    next.year = "ALL";
  }

  const monthValue = Number(next.month);
  if (next.month !== "ALL" && (!Number.isFinite(monthValue) || monthValue < 1 || monthValue > 12)) {
    next.month = "ALL";
  }

  const periods = getFacturasPeriods(rawData, next.year);
  const [defaultStart, defaultEnd] = getFacturasPeriodDefaults(periods, next.year, meta?.range);
  next.selectedPeriods = [...new Set((next.selectedPeriods || []).filter((period) => periods.includes(period)))].sort((a, b) =>
    a.localeCompare(b)
  );

  if (next.selectedPeriods.length) {
    next.periodRange = [next.selectedPeriods[0], next.selectedPeriods[next.selectedPeriods.length - 1]];
    next.month = next.selectedPeriods.length === 1 ? String(Number(next.selectedPeriods[0].split("-")[1])) : "ALL";
  } else {
    const requestedStart = next.periodRange?.[0] || defaultStart;
    const requestedEnd = next.periodRange?.[1] || defaultEnd;
    next.periodRange = [
      periods.includes(requestedStart) ? requestedStart : defaultStart,
      periods.includes(requestedEnd) ? requestedEnd : defaultEnd,
    ];
  }

  if (next.periodRange[0] && next.periodRange[1] && next.periodRange[0].localeCompare(next.periodRange[1]) > 0) {
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
    next.dateRange = [next.selectedDates[0], next.selectedDates[next.selectedDates.length - 1]];
    return next;
  }

  const requestedDateStart = next.dateRange?.[0] || defaultDateRange[0];
  const requestedDateEnd = next.dateRange?.[1] || defaultDateRange[1];
  next.dateRange = [
    availableDates.includes(requestedDateStart) ? requestedDateStart : defaultDateRange[0],
    availableDates.includes(requestedDateEnd) ? requestedDateEnd : defaultDateRange[1],
  ];

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

export const useVentasStore = create((set, get) => ({
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
  detailSummary: { total: 0, count: 0, approvalRate: 0 },
  documentSummary: {
    purchaseInvoiceCount: 0,
    purchaseInvoiceTotal: 0,
    creditNoteCount: 0,
    creditNoteTotal: 0,
    grossTotal: 0,
    netTotal: 0,
    documentCount: 0,
    avgTicket: 0,
    creditNoteShare: 0,
    totalBruto: 0,
    totalNC: 0,
    totalNeto: 0,
    cantidadFC: 0,
    cantidadNC: 0,
    cantidadNeta: 0,
  },
  documentStatus: [],
  documentRowsByStatus: { Rechazado: [], "En revision": [], Aprobado: [] },
  purchaseInvoiceRows: [],
  creditNoteRows: [],
  statusTrend: [],
  supplierAccountingRanking: [],
  supplierRankingByCategory: {},
  supplierIncidentRanking: [],
  rejectionReasons: [],
  yearAccumulated: { year: null, total: 0, count: 0 },
  activeMonthDailySpend: [],
  topExpenseDay: null,
  monthlyTotals: [],

  loadDefaultVentas: async () => {
    const hasIntegratedCreditNotes =
      get().sourceMeta?.stats?.ventasNcRows !== undefined ||
      get().rawData.some((row) => Number(row.signoDocumento || 1) < 0);
    if (get().isLoading || ((get().rawData.length || get().sourceMeta) && hasIntegratedCreditNotes)) return;
    set({ isLoading: true, error: null });
    try {
      const { loadDefaultVentasPbi } = await import("@/utils/parseVentasPbi");
      const { loadDefaultVentasAcuses } = await import("@/utils/parseVentasAcuses");
      const { loadDefaultNotasExcel } = await import("@/utils/parseNotasCredito");
      const [pbiResult, acusesResult, notasResult] = await Promise.all([
        loadDefaultVentasPbi().catch(() => null),
        loadDefaultVentasAcuses().catch(() => null),
        loadDefaultNotasExcel().catch(() => ({ ncDetail: [] })),
      ]);
      const result = pbiResult || acusesResult;
      if (!result) {
        throw new Error("No se encontro cache de ventas PBI ni acuses de respaldo.");
      }
      const facturasVenta = pbiResult ? pbiResult.data : mapVentasAcusesRows(result.data);
      const resolveClient = buildClientResolver(facturasVenta);
      const notasCreditoVenta = mapVentasCreditRows(notasResult.ncDetail, resolveClient);
      const data = [...facturasVenta, ...notasCreditoVenta].sort(
        (a, b) =>
          String(a.periodo || "").localeCompare(String(b.periodo || "")) ||
          String(a.proveedor || "").localeCompare(String(b.proveedor || ""))
      );
      const rangeStart = data[0]?.periodo || result.meta.range.start;
      const rangeEnd = data[data.length - 1]?.periodo || result.meta.range.end;
      const filters = { ...initialFilters, periodRange: [rangeStart, rangeEnd] };
      const sourceMeta = {
        ...result.meta,
        sourceName: `${result.meta.sourceName}${pbiResult ? " + NC venta Excel" : ""}`,
        range: { start: rangeStart, end: rangeEnd },
        validRows: data.length,
        stats: {
          ...(result.meta.stats || {}),
          ventasFvSource: pbiResult ? "API contable ventas PBI" : "Acuses Excel",
          ventasNcSource: "NOTAS CREDITO 2026.xlsx",
          ventasFvRows: facturasVenta.length,
          ventasNcRows: notasCreditoVenta.length,
        },
      };
      const computed = recompute(data, filters, "ALL", sourceMeta);
      set({
        rawData: data,
        sourceMeta,
        sourceName: sourceMeta.sourceName,
        isLoading: false,
        error: null,
        ...computed,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "No fue posible cargar ventas desde los acuses.",
      });
    }
  },

  loadWorkbookFile: async (file) => {
    if (!file) return;
    set({ isLoading: true, error: null });
    try {
      const { parseVentasExcelFile } = await import("@/utils/parseExcel");
      const result = await parseVentasExcelFile(file);
      const filters = { ...initialFilters, periodRange: [result.meta.range.start, result.meta.range.end] };
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
        error: error instanceof Error ? error.message : "No fue posible procesar ventas del Excel cargado.",
      });
    }
  },

  setFilters: (partial) => {
    const current = get().filters;
    const nextFilters = { ...current, ...partial };
    if (
      nextFilters.year === current.year &&
      nextFilters.month === current.month &&
      nextFilters.provider === current.provider &&
      sameRange(nextFilters.periodRange, current.periodRange) &&
      sameRange(nextFilters.dateRange, current.dateRange) &&
      sameList(nextFilters.selectedPeriods || [], current.selectedPeriods || []) &&
      sameList(nextFilters.selectedDates || [], current.selectedDates || [])
    ) {
      return;
    }
    const computed = recompute(get().rawData, nextFilters, get().focusPeriod, get().sourceMeta);
    set(computed);
  },

  clearFilters: () => {
    const range = get().sourceMeta?.range || { start: null, end: null };
    const filters = { ...initialFilters, periodRange: [range.start, range.end] };
    set(recompute(get().rawData, filters, "ALL", get().sourceMeta));
  },
}));

export const ventasCalendarSelectors = {
  getYears: getFacturasYears,
  getPeriods: getFacturasPeriods,
  getDatesForPeriod: getFacturasDatesForPeriod,
};
