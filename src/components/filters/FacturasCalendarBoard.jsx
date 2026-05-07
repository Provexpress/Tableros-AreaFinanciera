import { useMemo } from "react";
import { Select } from "@/components/ui/select";
import { cn } from "@/utils/cn";
import { useFacturasStore } from "@/store/useFacturasStore";
import {
  getFacturasDatesForPeriod,
  getFacturasPeriodDefaults,
  getFacturasPeriods,
  getFacturasYears,
  isSingleValueRange,
} from "@/utils/facturasTime";

const MONTH_LABELS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const MONTH_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function CalendarCard({ title, children, className = "" }) {
  return (
    <div className={cn("rounded-[12px] border border-white/10 bg-white/[0.03] p-3", className)}>
      <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[var(--txt3)]">{title}</div>
      {children}
    </div>
  );
}

function isValueInRange(value, range) {
  const [start, end] = range || [null, null];
  if (!value || !start || !end) {
    return false;
  }

  return String(value).localeCompare(String(start)) >= 0 && String(value).localeCompare(String(end)) <= 0;
}

export default function FacturasCalendarBoard({ fixedYear = null }) {
  const rawData = useFacturasStore((state) => state.rawData);
  const filters = useFacturasStore((state) => state.filters);
  const sourceMeta = useFacturasStore((state) => state.sourceMeta);
  const setFilters = useFacturasStore((state) => state.setFilters);
  const activeYear = fixedYear || filters.year;

  const years = useMemo(() => getFacturasYears(rawData), [rawData]);
  const periods = useMemo(() => getFacturasPeriods(rawData, activeYear), [activeYear, rawData]);
  const defaultRange = useMemo(
    () => getFacturasPeriodDefaults(periods, activeYear, sourceMeta?.range),
    [activeYear, periods, sourceMeta]
  );
  const selectedPeriod = isSingleValueRange(filters.periodRange) ? filters.periodRange[0] : null;
  const selectedPeriods = filters.selectedPeriods || [];
  const selectedDates = filters.selectedDates || [];
  const focusedPeriodForDays = selectedPeriods.length === 1 ? selectedPeriods[0] : selectedPeriod;
  const datesForSelectedPeriod = useMemo(
    () => getFacturasDatesForPeriod(rawData, focusedPeriodForDays),
    [rawData, focusedPeriodForDays]
  );
  const defaultDateRange = [
    datesForSelectedPeriod[0] || null,
    datesForSelectedPeriod[datesForSelectedPeriod.length - 1] || null,
  ];

  const monthItems = useMemo(() => {
    const buckets = new Map();
    const scopedRows = rawData
      .filter((row) => activeYear === "ALL" || String(row.anio) === String(activeYear))
      .sort((a, b) => String(a.periodo || "").localeCompare(String(b.periodo || "")));

    scopedRows.forEach((row) => {
      const monthNumber = Number(row.mesNum || 0);
      if (!monthNumber) return;

      const key = activeYear === "ALL" ? String(monthNumber) : String(row.periodo || "");
      if (!key) return;

      if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          monthNumber,
          label: MONTH_LABELS[monthNumber - 1] || `M${monthNumber}`,
          fullLabel: MONTH_FULL[monthNumber - 1] || `Mes ${monthNumber}`,
          count: 0,
          periodKey: activeYear === "ALL" ? null : row.periodo,
        });
      }
      buckets.get(key).count += 1;
    });

    return [...buckets.values()];
  }, [activeYear, rawData]);

  const dayItems = useMemo(() => {
    if (!focusedPeriodForDays) return [];

    const countsByDay = new Map();
    rawData.forEach((row) => {
      if (row.periodo !== focusedPeriodForDays || !row.fechaIso) return;
      countsByDay.set(row.fechaIso, (countsByDay.get(row.fechaIso) || 0) + 1);
    });

    return datesForSelectedPeriod.map((dateKey) => ({
      key: dateKey,
      label: new Date(`${dateKey}T00:00:00`).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      }),
      count: countsByDay.get(dateKey) || 0,
      isSelected: selectedDates.length ? selectedDates.includes(dateKey) : isValueInRange(dateKey, filters.dateRange),
    }));
  }, [datesForSelectedPeriod, filters.dateRange, focusedPeriodForDays, rawData, selectedDates]);

  const handleSelectYear = (yearValue) => {
    const nextPeriodRange =
      yearValue === "ALL"
        ? [sourceMeta?.range?.start || null, sourceMeta?.range?.end || null]
        : [null, null];

    setFilters({
      year: yearValue,
      month: "ALL",
      semester: "ALL",
      quarter: "ALL",
      periodRange: nextPeriodRange,
      dateRange: [null, null],
      selectedPeriods: [],
      selectedDates: [],
    });
  };

  const handleSelectMonth = (month) => {
    if (!month.periodKey || activeYear === "ALL") {
      const isSameMonth = String(filters.month) === String(month.monthNumber);
      setFilters({
        year: activeYear,
        month: isSameMonth ? "ALL" : String(month.monthNumber),
        periodRange: defaultRange,
        dateRange: [null, null],
        selectedPeriods: [],
        selectedDates: [],
      });
      return;
    }

    const nextSelectedPeriods = selectedPeriods.includes(month.periodKey)
      ? selectedPeriods.filter((period) => period !== month.periodKey)
      : [...selectedPeriods, month.periodKey].sort((a, b) => a.localeCompare(b));

    setFilters({
      year: activeYear,
      month: nextSelectedPeriods.length === 1 ? String(Number(nextSelectedPeriods[0].split("-")[1])) : "ALL",
      semester: "ALL",
      quarter: "ALL",
      periodRange: nextSelectedPeriods.length
        ? [nextSelectedPeriods[0], nextSelectedPeriods[nextSelectedPeriods.length - 1]]
        : defaultRange,
      dateRange: [null, null],
      selectedPeriods: nextSelectedPeriods,
      selectedDates: [],
    });
  };

  const handleSelectDay = (day) => {
    const nextSelectedDates = selectedDates.includes(day.key)
      ? selectedDates.filter((date) => date !== day.key)
      : [...selectedDates, day.key].sort((a, b) => a.localeCompare(b));

    setFilters({
      selectedDates: nextSelectedDates,
      dateRange: nextSelectedDates.length
        ? [nextSelectedDates[0], nextSelectedDates[nextSelectedDates.length - 1]]
        : defaultDateRange,
    });
  };

  const activeMonthLabel = filters.month !== "ALL"
    ? MONTH_FULL[Number(filters.month) - 1] || filters.month
    : null;

  return (
    <div className="space-y-3">
      {/* Selector de año - simple y prominente */}
      <CalendarCard title="Año">
        <Select value={activeYear} onChange={(e) => handleSelectYear(e.target.value)} disabled={Boolean(fixedYear)}>
          <option value="ALL">Todos los años</option>
          {years.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </Select>
      </CalendarCard>

      {/* Meses como cards en grid - más visual */}
      <CalendarCard title={activeMonthLabel ? `Meses del ${activeMonthLabel}` : "Meses"}>
        <div className="grid grid-cols-4 gap-1.5">
          {monthItems.map((month) => {
            const isActive =
              selectedPeriods.includes(month.periodKey) ||
              (!selectedPeriods.length && String(filters.month) === String(month.monthNumber));
            return (
              <button
                key={month.key}
                type="button"
                onClick={() => handleSelectMonth(month)}
                className={cn(
                  "flex flex-col items-center justify-center rounded-[10px] border px-2 py-2.5 text-center transition-colors duration-150",
                  isActive
                    ? "border-[color:rgb(79_142_247_/_0.55)] bg-[color:rgb(79_142_247_/_0.18)] text-[var(--txt)]"
                    : "border-white/10 bg-white/[0.03] text-[var(--txt2)] hover:border-white/20 hover:text-[var(--txt)]"
                )}
              >
                <span className="text-sm font-medium">{month.label}</span>
                <span className={cn("text-[10px]", isActive ? "text-[var(--tec)]" : "text-[var(--txt3)]")}>
                  {month.count} días
                </span>
              </button>
            );
          })}
        </div>
      </CalendarCard>

      {/* Días - solo si hay mes seleccionado */}
      {focusedPeriodForDays && (
        <CalendarCard title="Días del mes">
          <div className="max-h-[180px] space-y-1 overflow-y-auto pr-1">
            {dayItems.map((day) => (
              <button
                key={day.key}
                type="button"
                onClick={() => handleSelectDay(day)}
                className={cn(
                  "flex w-full items-center justify-between rounded-[8px] border px-2.5 py-1.5 text-left transition-colors duration-150",
                  day.isSelected
                    ? "border-[color:rgb(79_142_247_/_0.55)] bg-[color:rgb(79_142_247_/_0.18)] text-[var(--txt)]"
                    : "border-white/8 bg-white/[0.02] text-[var(--txt2)] hover:border-white/15 hover:text-[var(--txt)]"
                )}
              >
                <span className="text-sm">{day.label}</span>
                <span className="text-[11px] text-[var(--txt3)]">{day.count}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFilters({ dateRange: [null, null], selectedDates: [] })}
            className="mt-2 text-xs text-[var(--txt3)] underline hover:text-[var(--txt2)]"
          >
            Limpiar día seleccionado
          </button>
        </CalendarCard>
      )}

      {/* Hint cuando no hay mes seleccionado */}
      {!selectedPeriod && activeYear !== "ALL" && monthItems.length > 0 && (
        <div className="text-center text-xs text-[var(--txt3)]">
          Selecciona un mes para ver los días disponibles
        </div>
      )}
    </div>
  );
}
