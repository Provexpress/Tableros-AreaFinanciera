import { create } from "zustand";
import { buildNotasDerivedState } from "@/utils/notasCreditoAggregations";
import { FILTER_BATCH_IDLE_STATE, scheduleBatchedFilterRecompute } from "@/store/filterBatcher";
import {
  applySharedCalendarFilters,
  getSharedCalendarFilters,
  hasCalendarFilterKeys,
  saveSharedCalendarFilters,
} from "@/store/useCalendarSyncStore";

const initialFilters = {
  year: "2026",
  month: "ALL",
  semester: "ALL",
  quarter: "ALL",
  impactKey: null,
  responsible: "",
  periodRange: [null, null],
  selectedPeriods: [],
};

function resolveDefaultYear(rawWeeks, meta) {
  const years = [...new Set(rawWeeks.map((row) => String(row.year)).filter(Boolean))];

  if (years.includes("2026")) {
    return "2026";
  }

  if (meta?.latestYear) {
    return String(meta.latestYear);
  }

  return years[years.length - 1] || "ALL";
}

function getNcPeriod(row) {
  const directPeriod = String(row.monthRef || row.monthKey || row.periodo || "").slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(directPeriod)) {
    return directPeriod;
  }

  const datePeriod = String(row.fechaInicialIso || row.fechaIso || row.fecha || "").slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(datePeriod)) {
    return datePeriod;
  }

  const year = Number(row.year || row.anio || 0);
  const month = Number(row.monthNumber || row.mesNum || 0);
  if (year > 0 && month >= 1 && month <= 12) {
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  return "";
}

function sameRange(left = [], right = []) {
  return (left?.[0] || null) === (right?.[0] || null) && (left?.[1] || null) === (right?.[1] || null);
}

function buildDefaultFilters(rawWeeks, rawNcRows, meta) {
  const year = resolveDefaultYear(rawWeeks, meta);
  const latestNcPeriod = [...new Set(rawNcRows.map(getNcPeriod).filter(Boolean))]
    .filter((period) => year === "ALL" || period.startsWith(`${year}-`))
    .sort((a, b) => a.localeCompare(b))
    .pop();

  if (!latestNcPeriod) {
    return {
      ...initialFilters,
      year,
      periodRange: [null, null],
    };
  }

  return {
    ...initialFilters,
    year,
    month: String(Number(latestNcPeriod.slice(5, 7))),
    periodRange: [latestNcPeriod, latestNcPeriod],
    selectedPeriods: [latestNcPeriod],
  };
}

function sanitizeFilters(rawWeeks, filters, latestYear, meta) {
  const years = [...new Set(rawWeeks.map((row) => String(row.year)))];
  const next = { ...filters };

  if (next.year !== "ALL" && !years.includes(String(next.year))) {
    next.year = latestYear ? String(latestYear) : "ALL";
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

  const rangeScope =
    next.year === "ALL"
      ? rawWeeks
      : rawWeeks.filter((row) => String(row.year) === String(next.year));

  const monthKeys = [...new Set(rangeScope.map((row) => row.monthKey).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

  const defaultStart =
    next.year === "ALL"
      ? meta?.range?.start || monthKeys[0] || null
      : monthKeys[0] || null;
  const defaultEnd =
    next.year === "ALL"
      ? meta?.range?.end || monthKeys[monthKeys.length - 1] || null
      : monthKeys[monthKeys.length - 1] || null;

  next.selectedPeriods = [...new Set((next.selectedPeriods || []).filter((period) => monthKeys.includes(period)))].sort((a, b) =>
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

  if (!next.selectedPeriods.length && next.month !== "ALL" && next.year !== "ALL" && next.semester === "ALL" && next.quarter === "ALL") {
    const targetMonthKey = `${next.year}-${String(next.month).padStart(2, "0")}`;
    if (monthKeys.includes(targetMonthKey)) {
      next.periodRange = [targetMonthKey, targetMonthKey];
    } else {
      next.month = "ALL";
    }
  }

  const requestedStart = next.periodRange?.[0] || defaultStart;
  const requestedEnd = next.periodRange?.[1] || defaultEnd;

  if (!next.selectedPeriods.length) {
    next.periodRange = [
      monthKeys.includes(requestedStart) ? requestedStart : defaultStart,
      monthKeys.includes(requestedEnd) ? requestedEnd : defaultEnd,
    ];
  }

  if (
    next.periodRange[0] &&
    next.periodRange[1] &&
    next.periodRange[0].localeCompare(next.periodRange[1]) > 0
  ) {
    next.periodRange = [next.periodRange[1], next.periodRange[1]];
  }

  const monthScope =
    next.year === "ALL"
      ? rawWeeks
      : rawWeeks.filter((row) => String(row.year) === String(next.year));
  const months = [...new Set(monthScope.map((row) => Number(row.monthNumber)))];

  if (
    next.year !== "ALL" &&
    next.month === "ALL" &&
    next.semester === "ALL" &&
    next.quarter === "ALL" &&
    next.periodRange[0] &&
    next.periodRange[0] === next.periodRange[1]
  ) {
    const [, singleMonth] = String(next.periodRange[0]).split("-");
    if (singleMonth) {
      next.month = String(Number(singleMonth));
    }
  } else if (next.month === "ALL") {
    next.month = "ALL";
  }

  if (next.month !== "ALL" && !months.includes(Number(next.month))) {
    next.month = "ALL";
  }

  return next;
}

function recompute(rawWeeks, rawNcRows, filters, selectedWeek, meta) {
  const safeFilters = sanitizeFilters(rawWeeks, filters, meta?.latestYear, meta);
  const computed = buildNotasDerivedState(rawWeeks, rawNcRows, safeFilters, selectedWeek, meta);

  return {
    filters: safeFilters,
    ...computed,
  };
}

export const useNotasCreditoStore = create((set, get) => ({
  rawWeeks: [],
  rawNcRows: [],
  filters: { ...initialFilters },
  selectedWeek: null,
  isLoading: false,
  error: null,
  sourceMeta: null,
  sourceName: "reporte semanal + notas crédito",
  visibleWeeks: [],
  visibleNcRows: [],
  monthsAvailable: [],
  weekOptions: [],
  causeSummary: [],
  impactSummary: [],
  responsibleSummary: [],
  clientSummary: [],
  criticalWeeks: [],
  weeklySeries: [],
  activeInteractionLabel: null,
  headerRangeLabel: "Todo semanal",
  weekVariation: {
    currentWeek: null,
    previousWeek: null,
    ncDeltaCount: 0,
    ncDeltaValue: 0,
    worseningCauses: [],
    improvingCauses: [],
    worseningResponsibles: [],
    improvingResponsibles: [],
  },
  kpis: {
    totalBruto: 0,
    totalNc: 0,
    totalRefact: 0,
    totalNeto: 0,
    totalFacturas: 0,
    totalNcCount: 0,
    totalRefactCount: 0,
    pctNc: 0,
    lastWeek: null,
  },
  selectedWeekMeta: null,
  selectedWeekRows: [],
  selectedWeekComment: "",
  ...FILTER_BATCH_IDLE_STATE,

  loadDefaultNotasWorkbook: async () => {
    if ((get().rawWeeks.length && get().rawNcRows.length) || get().isLoading) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const { loadDefaultNotasExcel } = await import("@/utils/parseNotasCredito");
      const result = await loadDefaultNotasExcel();
      const filters = applySharedCalendarFilters(
        buildDefaultFilters(result.semanal, result.ncDetail, result.meta),
        getSharedCalendarFilters(),
        { includeDates: false }
      );
      const computed = recompute(result.semanal, result.ncDetail, filters, null, result.meta);

      set({
        rawWeeks: result.semanal,
        rawNcRows: result.ncDetail,
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
            : "No fue posible cargar la base semanal y de notas crédito.",
      });
    }
  },

  loadNotasFiles: async (files) => {
    if (!files?.length) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const { parseNotasCreditoFiles } = await import("@/utils/parseNotasCredito");
      const result = await parseNotasCreditoFiles(files);
      const filters = applySharedCalendarFilters(
        buildDefaultFilters(result.semanal, result.ncDetail, result.meta),
        getSharedCalendarFilters(),
        { includeDates: false }
      );
      const computed = recompute(result.semanal, result.ncDetail, filters, null, result.meta);

      set({
        rawWeeks: result.semanal,
        rawNcRows: result.ncDetail,
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
            : "No fue posible procesar los archivos de notas crédito.",
      });
    }
  },

  setFilters: (partial) => {
    const { _skipCalendarSync = false, ...partialFilters } = partial;
    const currentFilters = get().filters;
    const nextFilters = { ...currentFilters, ...partialFilters };

    if (
      nextFilters.year === currentFilters.year &&
      nextFilters.month === currentFilters.month &&
      nextFilters.semester === currentFilters.semester &&
      nextFilters.quarter === currentFilters.quarter &&
      nextFilters.impactKey === currentFilters.impactKey &&
      nextFilters.responsible === currentFilters.responsible &&
      sameRange(nextFilters.periodRange, currentFilters.periodRange) &&
      sameList(nextFilters.selectedPeriods || [], currentFilters.selectedPeriods || [])
    ) {
      return;
    }

    if (!_skipCalendarSync && hasCalendarFilterKeys(partialFilters)) {
      saveSharedCalendarFilters(nextFilters, "notas", { includeDates: false });
    }
    const shouldResetSelectedWeek =
      Object.prototype.hasOwnProperty.call(partialFilters, "year") ||
      Object.prototype.hasOwnProperty.call(partialFilters, "month") ||
      Object.prototype.hasOwnProperty.call(partialFilters, "semester") ||
      Object.prototype.hasOwnProperty.call(partialFilters, "quarter") ||
      Object.prototype.hasOwnProperty.call(partialFilters, "periodRange") ||
      Object.prototype.hasOwnProperty.call(partialFilters, "selectedPeriods");

    set({
      filters: nextFilters,
      ...(shouldResetSelectedWeek ? { selectedWeek: null } : {}),
    });

    scheduleBatchedFilterRecompute({
      get,
      set,
      compute: (state) =>
        recompute(state.rawWeeks, state.rawNcRows, state.filters, state.selectedWeek, state.sourceMeta),
    });
  },

  setSelectedWeek: (weekKey) => {
    const nextWeek = !weekKey || get().selectedWeek === weekKey ? null : weekKey;
    const { rawWeeks, rawNcRows, filters, sourceMeta } = get();
    const computed = recompute(rawWeeks, rawNcRows, filters, nextWeek, sourceMeta);

    set({
      ...FILTER_BATCH_IDLE_STATE,
      selectedWeek: nextWeek,
      ...computed,
    });
  },

  clearSelectedWeek: () => {
    const { rawWeeks, rawNcRows, filters, sourceMeta } = get();
    const computed = recompute(rawWeeks, rawNcRows, filters, null, sourceMeta);

    set({
      ...FILTER_BATCH_IDLE_STATE,
      selectedWeek: null,
      ...computed,
    });
  },

  clearFilters: () => {
    const { rawWeeks, rawNcRows, sourceMeta } = get();
    const filters = buildDefaultFilters(rawWeeks, rawNcRows, sourceMeta);
    saveSharedCalendarFilters(filters, "notas", { includeDates: false });
    const computed = recompute(rawWeeks, rawNcRows, filters, null, sourceMeta);

    set({
      filters,
      ...FILTER_BATCH_IDLE_STATE,
      selectedWeek: null,
      ...computed,
    });
  },
}));
