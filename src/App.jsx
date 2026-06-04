import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import FilterSidebar from "@/components/layout/FilterSidebar";
import Navbar from "@/components/layout/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { pickCalendarFilters, useCalendarSyncStore } from "@/store/useCalendarSyncStore";
import { useFacturasStore } from "@/store/useFacturasStore";
import { useNotasCreditoStore } from "@/store/useNotasCreditoStore";
import { useVentasStore } from "@/store/useVentasStore";
import { formatPeriod, formatRangeLabel } from "@/utils/formatters";
import { getFacturasDatesForPeriod, isSingleValueRange } from "@/utils/facturasTime";

const Dashboard = lazy(() => import("@/views/Dashboard"));
const Ventas = lazy(() => import("@/views/Ventas"));
const NotasCredito = lazy(() => import("@/views/NotasCredito"));
const Comparativo = lazy(() => import("@/views/Comparativo"));

const routes = [
  { to: "/comparativo", label: "Consolidado" },
  { to: "/", label: "Compras" },
  { to: "/ventas", label: "Ventas" },
  { to: "/notas-credito", label: "Notas crédito" },
];

const MONTH_LABELS = {
  "1": "Enero",
  "2": "Febrero",
  "3": "Marzo",
  "4": "Abril",
  "5": "Mayo",
  "6": "Junio",
  "7": "Julio",
  "8": "Agosto",
  "9": "Septiembre",
  "10": "Octubre",
  "11": "Noviembre",
  "12": "Diciembre",
};

function sameList(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameRange(left = [], right = []) {
  return (left?.[0] || null) === (right?.[0] || null) && (left?.[1] || null) === (right?.[1] || null);
}

function sameCalendarFilters(current = {}, next = {}, { includeDates = true } = {}) {
  return (
    current.year === next.year &&
    current.month === next.month &&
    current.semester === next.semester &&
    current.quarter === next.quarter &&
    sameRange(current.periodRange, next.periodRange) &&
    sameList(current.selectedPeriods || [], next.selectedPeriods || []) &&
    (!includeDates ||
      (sameRange(current.dateRange, next.dateRange) &&
        sameList(current.selectedDates || [], next.selectedDates || [])))
  );
}

function LoadingShell({ sourceName }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="text-lg font-medium text-[var(--txt)]">Cargando datos</div>
        <p className="text-sm text-[var(--txt2)]">
          Se está leyendo <span className="font-medium text-[var(--txt)]">{sourceName}</span> desde la carpeta Data.
        </p>
        <div className="space-y-3 pt-2">
          <div className="skeleton h-3 w-40 rounded-full" />
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`shell-skeleton-card-${index}`}
                className="rounded-[8px] border border-[rgba(26,43,107,0.1)] bg-white p-3"
              >
                <div className="skeleton mb-2 h-3 w-24 rounded-full" />
                <div className="skeleton mb-2 h-7 w-2/3 rounded-[8px]" />
                <div className="skeleton h-3 w-16 rounded-full" />
              </div>
            ))}
          </div>
          <div className="rounded-[8px] border border-[rgba(26,43,107,0.1)] bg-white p-3">
            <div className="skeleton mb-4 h-4 w-48 rounded-full" />
            <div className="skeleton h-[240px] w-full rounded-[10px]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function App() {
  const location = useLocation();
  const isNotesRoute = location.pathname.startsWith("/notas-credito");
  const isVentasRoute = location.pathname.startsWith("/ventas");
  const isComparisonRoute = location.pathname.startsWith("/comparativo");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shellOffset, setShellOffset] = useState(88);
  const navbarRef = useRef(null);
  const lastAppliedCalendarRevisionRef = useRef({
    facturas: 0,
    ventas: 0,
    notas: 0,
  });
  const {
    filters: sharedCalendarFilters,
    source: sharedCalendarSource,
    revision: sharedCalendarRevision,
  } = useCalendarSyncStore(
    useShallow((s) => ({
      filters: s.filters,
      source: s.source,
      revision: s.revision,
    }))
  );

  const {
    rawData: facturasRawData,
    sourceMeta: facturasSourceMeta,
    sourceName: facturasSourceName,
    filters: facturasFilters,
    focusPeriod: facturasFocusPeriod,
    isLoading: facturasIsLoading,
    _filterDirty: facturasFilterDirty,
    _filterPending: facturasFilterPending,
    error: facturasError,
    loadDefaultWorkbook,
    clearFilters: clearFacturasFilters,
    setFilters: setFacturasFilters,
    setFocusPeriod: setFacturasFocusPeriod,
  } = useFacturasStore(
    useShallow((s) => ({
      rawData: s.rawData,
      sourceMeta: s.sourceMeta,
      sourceName: s.sourceName,
      filters: s.filters,
      focusPeriod: s.focusPeriod,
      isLoading: s.isLoading,
      _filterDirty: s._filterDirty,
      _filterPending: s._filterPending,
      error: s.error,
      loadDefaultWorkbook: s.loadDefaultWorkbook,
      clearFilters: s.clearFilters,
      setFilters: s.setFilters,
      setFocusPeriod: s.setFocusPeriod,
    }))
  );

  const {
    rawWeeks: notasRawWeeks,
    rawNcRows: notasRawNcRows,
    sourceMeta: notasSourceMeta,
    sourceName: notasSourceName,
    filters: notasFilters,
    selectedWeekMeta: notasSelectedWeekMeta,
    headerRangeLabel: notasHeaderRangeLabel,
    isLoading: notasIsLoading,
    _filterDirty: notasFilterDirty,
    _filterPending: notasFilterPending,
    error: notasError,
    loadDefaultNotasWorkbook,
    clearFilters: clearNotasFilters,
    clearSelectedWeek: clearNotasSelectedWeek,
    setFilters: setNotasFilters,
  } = useNotasCreditoStore(
    useShallow((s) => ({
      rawWeeks: s.rawWeeks,
      rawNcRows: s.rawNcRows,
      sourceMeta: s.sourceMeta,
      sourceName: s.sourceName,
      filters: s.filters,
      selectedWeekMeta: s.selectedWeekMeta,
      headerRangeLabel: s.headerRangeLabel,
      isLoading: s.isLoading,
      _filterDirty: s._filterDirty,
      _filterPending: s._filterPending,
      error: s.error,
      loadDefaultNotasWorkbook: s.loadDefaultNotasWorkbook,
      clearFilters: s.clearFilters,
      clearSelectedWeek: s.clearSelectedWeek,
      setFilters: s.setFilters,
    }))
  );

  const {
    rawData: ventasRawData,
    sourceMeta: ventasSourceMeta,
    sourceName: ventasSourceName,
    filters: ventasFilters,
    isLoading: ventasIsLoading,
    error: ventasError,
    loadDefaultVentas,
    clearFilters: clearVentasFilters,
    setFilters: setVentasFilters,
  } = useVentasStore(
    useShallow((s) => ({
      rawData: s.rawData,
      sourceMeta: s.sourceMeta,
      sourceName: s.sourceName,
      filters: s.filters,
      isLoading: s.isLoading,
      error: s.error,
      loadDefaultVentas: s.loadDefaultVentas,
      clearFilters: s.clearFilters,
      setFilters: s.setFilters,
    }))
  );

  const facturasSelectedPeriod = useMemo(
    () => (isSingleValueRange(facturasFilters.periodRange) ? facturasFilters.periodRange[0] : null),
    [facturasFilters.periodRange]
  );

  const facturasDefaultDateRange = useMemo(() => {
    if (!facturasSelectedPeriod) {
      return [null, null];
    }

    const dates = getFacturasDatesForPeriod(facturasRawData, facturasSelectedPeriod);
    return [dates[0] || null, dates[dates.length - 1] || null];
  }, [facturasRawData, facturasSelectedPeriod]);

  const facturasHasCustomDateRange = useMemo(
    () =>
      Boolean(facturasSelectedPeriod) &&
      (
        facturasFilters.dateRange?.[0] !== facturasDefaultDateRange[0] ||
        facturasFilters.dateRange?.[1] !== facturasDefaultDateRange[1]
      ),
    [facturasDefaultDateRange, facturasFilters.dateRange, facturasSelectedPeriod]
  );

  const notasDefaultYear = useMemo(() => {
    if (notasSourceMeta?.latestYear) {
      return String(notasSourceMeta.latestYear);
    }

    const years = [...new Set(notasRawWeeks.map((row) => String(row.year)).filter(Boolean))];
    if (years.includes("2026")) {
      return "2026";
    }

    return years[years.length - 1] || "ALL";
  }, [notasRawWeeks, notasSourceMeta]);

  useEffect(() => {
    if (isComparisonRoute) {
      loadDefaultWorkbook();
      loadDefaultVentas();
      loadDefaultNotasWorkbook();
      return;
    }

    if (isVentasRoute) {
      loadDefaultVentas();
      return;
    }

    if (isNotesRoute) {
      loadDefaultNotasWorkbook();
      return;
    }

    loadDefaultWorkbook();
  }, [isComparisonRoute, isNotesRoute, isVentasRoute, loadDefaultNotasWorkbook, loadDefaultVentas, loadDefaultWorkbook]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sharedCalendarFilters || !sharedCalendarRevision) {
      return;
    }

    const facturasCalendar = pickCalendarFilters(sharedCalendarFilters, { includeDates: true });
    if (
      sharedCalendarSource !== "facturas" &&
      lastAppliedCalendarRevisionRef.current.facturas !== sharedCalendarRevision &&
      facturasRawData.length &&
      !sameCalendarFilters(facturasFilters, facturasCalendar, { includeDates: true })
    ) {
      lastAppliedCalendarRevisionRef.current.facturas = sharedCalendarRevision;
      setFacturasFilters({ ...facturasCalendar, _skipCalendarSync: true });
    }

    const ventasCalendar = pickCalendarFilters(sharedCalendarFilters, { includeDates: true });
    if (
      sharedCalendarSource !== "ventas" &&
      lastAppliedCalendarRevisionRef.current.ventas !== sharedCalendarRevision &&
      ventasRawData.length &&
      !sameCalendarFilters(ventasFilters, ventasCalendar, { includeDates: true })
    ) {
      lastAppliedCalendarRevisionRef.current.ventas = sharedCalendarRevision;
      setVentasFilters({ ...ventasCalendar, _skipCalendarSync: true });
    }

    const notasCalendar = pickCalendarFilters(sharedCalendarFilters, { includeDates: false });
    if (
      sharedCalendarSource !== "notas" &&
      lastAppliedCalendarRevisionRef.current.notas !== sharedCalendarRevision &&
      notasRawWeeks.length &&
      !sameCalendarFilters(notasFilters, notasCalendar, { includeDates: false })
    ) {
      lastAppliedCalendarRevisionRef.current.notas = sharedCalendarRevision;
      setNotasFilters({ ...notasCalendar, _skipCalendarSync: true });
    }
  }, [
    facturasFilters,
    facturasRawData.length,
    notasFilters,
    notasRawWeeks.length,
    setFacturasFilters,
    setNotasFilters,
    setVentasFilters,
    sharedCalendarFilters,
    sharedCalendarRevision,
    sharedCalendarSource,
    ventasFilters,
    ventasRawData.length,
  ]);

  useEffect(() => {
    if (!isComparisonRoute || !facturasRawData.length || !notasRawWeeks.length) {
      return;
    }

    const notasYears = [...new Set(notasRawWeeks.map((row) => String(row.year)).filter(Boolean))];
    const syncedYear = facturasFilters.year === "ALL" || notasYears.includes(String(facturasFilters.year))
      ? facturasFilters.year
      : notasDefaultYear;

    const scopedNotasWeeks = syncedYear === "ALL"
      ? notasRawWeeks
      : notasRawWeeks.filter((row) => String(row.year) === String(syncedYear));
    const notasMonthKeys = [...new Set(scopedNotasWeeks.map((row) => row.monthKey).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );

    const defaultStart = syncedYear === "ALL"
      ? notasSourceMeta?.range?.start || notasMonthKeys[0] || null
      : notasMonthKeys[0] || null;
    const defaultEnd = syncedYear === "ALL"
      ? notasSourceMeta?.range?.end || notasMonthKeys[notasMonthKeys.length - 1] || null
      : notasMonthKeys[notasMonthKeys.length - 1] || null;

    let syncedMonth = facturasFilters.month;
    let syncedPeriodRange = [defaultStart, defaultEnd];
    let syncedSelectedPeriods = [];

    if (syncedYear !== "ALL" && facturasFilters.selectedPeriods?.length) {
      syncedSelectedPeriods = facturasFilters.selectedPeriods.filter((period) => notasMonthKeys.includes(period));
      syncedMonth = syncedSelectedPeriods.length === 1 ? String(Number(syncedSelectedPeriods[0].split("-")[1])) : "ALL";
      syncedPeriodRange = syncedSelectedPeriods.length
        ? [syncedSelectedPeriods[0], syncedSelectedPeriods[syncedSelectedPeriods.length - 1]]
        : [defaultStart, defaultEnd];
    } else if (syncedYear !== "ALL" && facturasFilters.month !== "ALL") {
      const targetMonthKey = `${syncedYear}-${String(facturasFilters.month).padStart(2, "0")}`;
      if (notasMonthKeys.includes(targetMonthKey)) {
        syncedPeriodRange = [targetMonthKey, targetMonthKey];
      } else {
        syncedMonth = "ALL";
      }
    } else {
      const requestedStart = facturasFilters.periodRange?.[0] || defaultStart;
      const requestedEnd = facturasFilters.periodRange?.[1] || defaultEnd;
      syncedPeriodRange = [
        notasMonthKeys.includes(requestedStart) ? requestedStart : defaultStart,
        notasMonthKeys.includes(requestedEnd) ? requestedEnd : defaultEnd,
      ];
    }

    const syncedNotasFilters = {
      year: syncedYear,
      month: syncedMonth,
      semester: syncedMonth === "ALL" ? facturasFilters.semester : "ALL",
      quarter: syncedMonth === "ALL" ? facturasFilters.quarter : "ALL",
      periodRange: syncedPeriodRange,
      selectedPeriods: syncedSelectedPeriods,
    };

    const alreadySynced =
      notasFilters.year === syncedNotasFilters.year &&
      notasFilters.month === syncedNotasFilters.month &&
      notasFilters.semester === syncedNotasFilters.semester &&
      notasFilters.quarter === syncedNotasFilters.quarter &&
      (notasFilters.periodRange?.[0] || null) === (syncedNotasFilters.periodRange?.[0] || null) &&
      (notasFilters.periodRange?.[1] || null) === (syncedNotasFilters.periodRange?.[1] || null) &&
      (notasFilters.selectedPeriods || []).join("|") === syncedSelectedPeriods.join("|");

    if (alreadySynced) {
      return;
    }

    setNotasFilters({ ...syncedNotasFilters, _skipCalendarSync: true });
  }, [
    facturasFilters.month,
    facturasFilters.periodRange,
    facturasFilters.semester,
    facturasFilters.quarter,
    facturasFilters.selectedPeriods,
    facturasFilters.year,
    facturasRawData.length,
    isComparisonRoute,
    notasDefaultYear,
    notasFilters.month,
    notasFilters.periodRange,
    notasFilters.quarter,
    notasFilters.selectedPeriods,
    notasFilters.semester,
    notasFilters.year,
    notasRawWeeks,
    notasRawWeeks.length,
    notasSourceMeta,
    setNotasFilters,
  ]);

  useEffect(() => {
    const node = navbarRef.current;
    if (!node) {
      return undefined;
    }

    const updateOffset = () => {
      const height = Math.ceil(node.getBoundingClientRect().height || 72);
      setShellOffset(height + 12);
    };

    updateOffset();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateOffset);
      return () => window.removeEventListener("resize", updateOffset);
    }

    const observer = new ResizeObserver(() => updateOffset());
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const facturasHasActiveFilters = useMemo(() => {
    const defaultStart = facturasSourceMeta?.range?.start || null;
    const defaultEnd = facturasSourceMeta?.range?.end || null;

    return (
      facturasFilters.year !== "ALL" ||
      facturasFilters.category !== "ALL" ||
      facturasFilters.provider !== "" ||
      facturasFilters.status !== "ALL" ||
      Boolean(facturasFilters.selectedPeriods?.length) ||
      Boolean(facturasFilters.selectedDates?.length) ||
      facturasHasCustomDateRange ||
      facturasFilters.periodRange?.[0] !== defaultStart ||
      facturasFilters.periodRange?.[1] !== defaultEnd
    );
  }, [facturasFilters, facturasHasCustomDateRange, facturasSourceMeta]);

  const notasHasActiveFilters = useMemo(() => {
    const defaultStart = notasSourceMeta?.range?.start || null;
    const defaultEnd = notasSourceMeta?.range?.end || null;

    return (
      notasFilters.year !== notasDefaultYear ||
      notasFilters.month !== "ALL" ||
      Boolean(notasFilters.selectedPeriods?.length) ||
      Boolean(notasFilters.impactKey) ||
      Boolean(notasFilters.responsible) ||
      notasFilters.periodRange?.[0] !== defaultStart ||
      notasFilters.periodRange?.[1] !== defaultEnd
    );
  }, [notasDefaultYear, notasFilters, notasSourceMeta]);

  const ventasHasActiveFilters = useMemo(() => {
    const defaultStart = ventasSourceMeta?.range?.start || null;
    const defaultEnd = ventasSourceMeta?.range?.end || null;
    return (
      ventasFilters.year !== "ALL" ||
      ventasFilters.month !== "ALL" ||
      Boolean(ventasFilters.provider) ||
      Boolean(ventasFilters.selectedPeriods?.length) ||
      Boolean(ventasFilters.selectedDates?.length) ||
      ventasFilters.periodRange?.[0] !== defaultStart ||
      ventasFilters.periodRange?.[1] !== defaultEnd
    );
  }, [ventasFilters, ventasSourceMeta]);

  const shell = useMemo(() => {
    if (isComparisonRoute) {
      return {
        datasetType: "comparativo",
        title: "PX / Consolidado compras y ventas",
        subtitle: "Compras y ventas en un solo resumen",
        sourceName: "Compras + Ventas",
        rangeLabel: "Corte consolidado",
        isLoading: facturasIsLoading || ventasIsLoading || notasIsLoading,
        isRefreshing:
          facturasFilterDirty || facturasFilterPending,
        error: null,
        hasData:
          facturasRawData.length > 0 || ventasRawData.length > 0 || notasRawNcRows.length > 0,
        hasActiveFilters: facturasHasActiveFilters || ventasHasActiveFilters,
        activeFilters: [],
        focusLabel: null,
        onClearFilters: () => {
          clearFacturasFilters();
        },
        onClearFocus: null,
        showSidebar: true,
        emptyHint: "Verifica que los datos de compras, ventas y notas crédito estén listos en la carpeta Data.",
      };
    }

    if (isVentasRoute) {
      const activeFilters = [];
      const defaultStart = ventasSourceMeta?.range?.start || null;
      const defaultEnd = ventasSourceMeta?.range?.end || null;

      if (ventasFilters.year !== "ALL") {
        activeFilters.push({ label: `Año: ${ventasFilters.year}`, variant: "tech" });
      }
      if (ventasFilters.month !== "ALL") {
        activeFilters.push({ label: `Mes: ${MONTH_LABELS[String(ventasFilters.month)] || ventasFilters.month}`, variant: "default" });
      }
      if (ventasFilters.provider) {
        activeFilters.push({ label: `Cliente: ${ventasFilters.provider}`, variant: "default" });
      }
      if (ventasFilters.selectedPeriods?.length > 1) {
        activeFilters.push({ label: `${ventasFilters.selectedPeriods.length} meses seleccionados`, variant: "warning" });
      } else if (ventasFilters.periodRange?.[0] !== defaultStart || ventasFilters.periodRange?.[1] !== defaultEnd) {
        activeFilters.push({ label: `Rango: ${formatRangeLabel(ventasFilters.periodRange?.[0], ventasFilters.periodRange?.[1])}`, variant: "warning" });
      }
      if (ventasFilters.selectedDates?.length) {
        activeFilters.push({ label: `${ventasFilters.selectedDates.length} días seleccionados`, variant: "warning" });
      }

      return {
        datasetType: "ventas",
        title: "PX / Ventas",
        subtitle: "Facturas, notas crédito y venta neta",
        sourceName: ventasSourceName,
        rangeLabel: formatRangeLabel(ventasFilters.periodRange?.[0], ventasFilters.periodRange?.[1]),
        isLoading: ventasIsLoading,
        isRefreshing: false,
        error: ventasError,
        hasData: true,
        hasActiveFilters: ventasHasActiveFilters,
        activeFilters,
        focusLabel: null,
        onClearFilters: clearVentasFilters,
        onClearFocus: null,
        showSidebar: true,
        emptyHint: "Carga un archivo con datos de ventas",
      };
    }

    if (isNotesRoute) {
      const activeFilters = [];
      const defaultStart = notasSourceMeta?.range?.start || null;
      const defaultEnd = notasSourceMeta?.range?.end || null;

      if (notasFilters.year !== notasDefaultYear) {
        activeFilters.push({ label: `Año: ${notasFilters.year}`, variant: "tech" });
      }
      if (notasFilters.month !== "ALL") {
        activeFilters.push({
          label: `Mes: ${MONTH_LABELS[String(notasFilters.month)] || notasFilters.month}`,
          variant: "default",
        });
      }
      if (notasFilters.selectedPeriods?.length > 1) {
        activeFilters.push({
          label: `${notasFilters.selectedPeriods.length} meses seleccionados`,
          variant: "warning",
        });
      } else if (
        notasFilters.periodRange?.[0] !== defaultStart ||
        notasFilters.periodRange?.[1] !== defaultEnd
      ) {
        activeFilters.push({
          label: `Rango: ${formatRangeLabel(notasFilters.periodRange?.[0], notasFilters.periodRange?.[1])}`,
          variant: "warning",
        });
      }
      if (notasFilters.impactKey) {
        activeFilters.push({ label: "Impacto aplicado", variant: "warning" });
      }
      if (notasFilters.responsible) {
        activeFilters.push({ label: `Responsable: ${notasFilters.responsible}`, variant: "default" });
      }

      return {
        datasetType: "notas",
        title: "PX / CONTROL DE VENTAS",
        subtitle: "Seguimiento semanal de facturación, NC y refacturación",
        sourceName: notasSourceName,
        rangeLabel: notasHeaderRangeLabel,
        isLoading: notasIsLoading,
        isRefreshing: notasFilterDirty || notasFilterPending,
        error: notasError,
        hasData: notasRawWeeks.length > 0 || notasRawNcRows.length > 0,
        hasActiveFilters: notasHasActiveFilters,
        activeFilters,
        focusLabel: notasSelectedWeekMeta ? `${notasSelectedWeekMeta.label} ${notasSelectedWeekMeta.year}` : null,
        onClearFilters: clearNotasFilters,
        onClearFocus: clearNotasSelectedWeek,
        showSidebar: true,
        emptyHint: "Verifica que los Excel maestros semanales y de NC estén disponibles dentro de la carpeta Data.",
      };
    }

    const activeFilters = [];
    const defaultStart = facturasSourceMeta?.range?.start || null;
    const defaultEnd = facturasSourceMeta?.range?.end || null;
    const hasCustomPeriodRange =
      facturasFilters.periodRange?.[0] !== defaultStart || facturasFilters.periodRange?.[1] !== defaultEnd;

    if (facturasFilters.year !== "ALL") {
      activeFilters.push({ label: `Año: ${facturasFilters.year}`, variant: "tech" });
    }
    if (facturasFilters.category !== "ALL") {
      activeFilters.push({ label: `Categoría: ${facturasFilters.category}`, variant: "default" });
    }
    if (facturasFilters.provider) {
      activeFilters.push({ label: `Proveedor: ${facturasFilters.provider}`, variant: "default" });
    }
    if (facturasFilters.status !== "ALL") {
      activeFilters.push({ label: `Estado: ${facturasFilters.status}`, variant: "default" });
    }
    if (facturasFilters.selectedPeriods?.length > 1) {
      activeFilters.push({
        label: `${facturasFilters.selectedPeriods.length} meses seleccionados`,
        variant: "warning",
      });
    } else if (facturasSelectedPeriod && hasCustomPeriodRange) {
      activeFilters.push({
        label: `Mes: ${formatPeriod(facturasSelectedPeriod, { monthStyle: "full" })}`,
        variant: "tech",
      });
    } else if (hasCustomPeriodRange) {
      activeFilters.push({
        label: `Rango: ${formatRangeLabel(facturasFilters.periodRange?.[0], facturasFilters.periodRange?.[1])}`,
        variant: "warning",
      });
    }
    if (facturasFilters.selectedDates?.length) {
      activeFilters.push({
        label: `${facturasFilters.selectedDates.length} días seleccionados`,
        variant: "warning",
      });
    } else if (facturasHasCustomDateRange) {
      activeFilters.push({
        label: `Días: ${formatRangeLabel(facturasFilters.dateRange?.[0], facturasFilters.dateRange?.[1])}`,
        variant: "warning",
      });
    }

    return {
      datasetType: "facturas",
      title: "PX / Compras",
      subtitle: "Facturas, notas crédito y compra neta",
      sourceName: facturasSourceName,
      rangeLabel: facturasFilters.selectedDates?.length
        ? `${facturasFilters.selectedDates.length} días seleccionados`
        : facturasFilters.selectedPeriods?.length > 1
          ? `${facturasFilters.selectedPeriods.length} meses seleccionados`
          : facturasHasCustomDateRange
            ? formatRangeLabel(facturasFilters.dateRange?.[0], facturasFilters.dateRange?.[1])
            : facturasSelectedPeriod
              ? formatPeriod(facturasSelectedPeriod, { monthStyle: "full" })
              : formatRangeLabel(facturasFilters.periodRange?.[0], facturasFilters.periodRange?.[1]),
      isLoading: facturasIsLoading,
      isRefreshing: facturasFilterDirty || facturasFilterPending,
      error: facturasError,
      hasData: facturasRawData.length > 0,
      hasActiveFilters: facturasHasActiveFilters,
      activeFilters,
      focusLabel: facturasFocusPeriod !== "ALL" ? formatPeriod(facturasFocusPeriod) : null,
      onClearFilters: clearFacturasFilters,
      onClearFocus: () => setFacturasFocusPeriod("ALL"),
      showSidebar: true,
      emptyHint: "Verifica que la tabla maestra de facturas esté disponible dentro de la carpeta Data.",
    };
  }, [
    isComparisonRoute,
    isNotesRoute,
    isVentasRoute,
    ventasSourceMeta,
    ventasSourceName,
    ventasFilters,
    ventasIsLoading,
    ventasError,
    ventasRawData.length,
    ventasHasActiveFilters,
    clearVentasFilters,
    notasSourceMeta,
    notasSourceName,
    notasHeaderRangeLabel,
    notasIsLoading,
    notasFilterDirty,
    notasFilterPending,
    notasError,
    notasRawWeeks.length,
    notasRawNcRows.length,
    notasDefaultYear,
    notasHasActiveFilters,
    notasSelectedWeekMeta,
    notasFilters,
    clearNotasFilters,
    clearNotasSelectedWeek,
    facturasSourceMeta,
    facturasSourceName,
    facturasFilters,
    facturasSelectedPeriod,
    facturasHasCustomDateRange,
    facturasIsLoading,
    facturasFilterDirty,
    facturasFilterPending,
    facturasError,
    facturasRawData.length,
    facturasHasActiveFilters,
    facturasFocusPeriod,
    clearFacturasFilters,
    setFacturasFocusPeriod,
  ]);

  return (
    <div className="min-h-screen text-[var(--txt)]" style={{ "--shell-offset": `${shellOffset}px` }}>
      <Navbar
        ref={navbarRef}
        routes={routes}
        title={shell.title}
        isLoading={shell.isLoading}
        onToggleSidebar={shell.showSidebar !== false ? () => setSidebarOpen(true) : null}
      />

      <div className="px-4 py-3 sm:px-5 lg:px-6 xl:px-8 2xl:px-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start xl:gap-5">
          {shell.showSidebar !== false ? (
            <FilterSidebar
              datasetType={shell.datasetType}
              mobileOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              hasActiveFilters={shell.hasActiveFilters}
              focusLabel={shell.focusLabel}
              onClearFilters={shell.onClearFilters}
              onClearFocus={shell.onClearFocus}
            />
          ) : null}

          <div className="min-w-0 flex-1 space-y-4">
            <main>
              {shell.isLoading && !shell.hasData ? (
                <LoadingShell sourceName={shell.sourceName} />
              ) : shell.error && !shell.hasData ? (
                <Card>
                  <CardContent className="space-y-3 pt-5">
                    <div className="text-lg font-medium text-[var(--txt)]">No fue posible cargar los datos</div>
                    <p className="text-sm text-[var(--txt2)]">{shell.error}</p>
                  </CardContent>
                </Card>
              ) : !shell.isLoading && !shell.hasData ? (
                <Card>
                  <CardContent className="space-y-3 pt-5">
                    <div className="text-lg font-medium text-[var(--txt)]">Aún no hay datos cargados</div>
                    <p className="text-sm text-[var(--txt2)]">
                      {shell.emptyHint} Verifica que los archivos estén disponibles dentro de la carpeta{" "}
                      <span className="font-medium text-[var(--txt)]">Data</span>.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="page-wrapper">
                  <Suspense fallback={<LoadingShell sourceName={shell.sourceName} />}>
                    <Routes location={location} key={location.pathname}>
                      <Route path="/" element={<Dashboard isLoading={shell.isLoading} />} />
                      <Route path="/ventas" element={<Ventas isLoading={shell.isLoading} />} />
                      <Route
                        path="/notas-credito"
                        element={<NotasCredito isLoading={shell.isLoading} />}
                      />
                      <Route path="/comparativo" element={<Comparativo />} />
                      <Route path="/categorías" element={<Navigate to="/" replace />} />
                      <Route path="/proveedores" element={<Navigate to="/" replace />} />
                      <Route path="/detalle" element={<Navigate to="/" replace />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
