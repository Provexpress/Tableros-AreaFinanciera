import { Select } from "@/components/ui/select";
import { cn } from "@/utils/cn";
import { formatPeriod } from "@/utils/formatters";

function FilterCard({ title, children }) {
  return (
    <div className="rounded-[12px] border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[var(--txt3)]">{title}</div>
      {children}
    </div>
  );
}

function clampIndex(index, length) {
  if (!length) return 0;
  return Math.max(0, Math.min(length - 1, Number(index) || 0));
}

export default function PeriodRangeControls({
  years = [],
  periods = [],
  dates = [],
  filters,
  sourceMeta,
  activeYear,
  fixedYear = null,
  setFilters,
  title = "Rango",
}) {
  const defaultStart = periods[0] || sourceMeta?.range?.start || null;
  const defaultEnd = periods[periods.length - 1] || sourceMeta?.range?.end || null;
  const startPeriod = filters.periodRange?.[0] || defaultStart;
  const endPeriod = filters.periodRange?.[1] || defaultEnd;
  const startIndex = Math.max(0, periods.indexOf(startPeriod));
  const endIndex = Math.max(startIndex, periods.indexOf(endPeriod) >= 0 ? periods.indexOf(endPeriod) : periods.length - 1);
  const selectedSinglePeriod = startPeriod && startPeriod === endPeriod ? startPeriod : null;
  const firstDate = dates[0] || null;
  const lastDate = dates[dates.length - 1] || null;
  const startDate = filters.dateRange?.[0] || firstDate || "";
  const endDate = filters.dateRange?.[1] || lastDate || "";

  function updateYear(yearValue) {
    setFilters({
      year: yearValue,
      month: "ALL",
      semester: "ALL",
      quarter: "ALL",
      periodRange: yearValue === "ALL" ? [sourceMeta?.range?.start || null, sourceMeta?.range?.end || null] : [null, null],
      dateRange: [null, null],
      selectedPeriods: [],
      selectedDates: [],
    });
  }

  function updatePeriodRange(nextStartIndex, nextEndIndex) {
    if (!periods.length) return;
    const safeStart = clampIndex(nextStartIndex, periods.length);
    const safeEnd = clampIndex(nextEndIndex, periods.length);
    const orderedStart = Math.min(safeStart, safeEnd);
    const orderedEnd = Math.max(safeStart, safeEnd);
    const nextStart = periods[orderedStart];
    const nextEnd = periods[orderedEnd];
    const selectedPeriods = nextStart === nextEnd ? [nextStart] : [];

    setFilters({
      year: activeYear,
      month: selectedPeriods.length ? String(Number(nextStart.slice(5, 7))) : "ALL",
      semester: "ALL",
      quarter: "ALL",
      periodRange: [nextStart, nextEnd],
      dateRange: [null, null],
      selectedPeriods,
      selectedDates: [],
    });
  }

  function updateDateRange(nextStart, nextEnd) {
    if (!selectedSinglePeriod) return;
    const safeStart = nextStart || firstDate;
    const safeEnd = nextEnd || lastDate;
    if (!safeStart || !safeEnd) return;
    const ordered = safeStart <= safeEnd ? [safeStart, safeEnd] : [safeEnd, safeStart];
    setFilters({
      dateRange: ordered,
      selectedDates: ordered[0] === ordered[1] ? [ordered[0]] : [],
    });
  }

  return (
    <div className="space-y-3">
      <FilterCard title="Año">
        <Select value={activeYear} onChange={(event) => updateYear(event.target.value)} disabled={Boolean(fixedYear)}>
          <option value="ALL">Todos los años</option>
          {years.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </Select>
      </FilterCard>

      <FilterCard title={title}>
        {periods.length ? (
          <div className="space-y-3">
            <div className="rounded-[8px] border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-[var(--txt)]">
              {formatPeriod(startPeriod)} - {formatPeriod(endPeriod)}
            </div>
            <div className="space-y-2">
              <label className="block text-xs text-[var(--txt3)]">Desde</label>
              <input
                type="range"
                min="0"
                max={periods.length - 1}
                value={startIndex}
                onChange={(event) => updatePeriodRange(event.target.value, endIndex)}
                className="w-full accent-[var(--tec)]"
              />
              <label className="block text-xs text-[var(--txt3)]">Hasta</label>
              <input
                type="range"
                min="0"
                max={periods.length - 1}
                value={endIndex}
                onChange={(event) => updatePeriodRange(startIndex, event.target.value)}
                className="w-full accent-[var(--tec)]"
              />
            </div>
            <button
              type="button"
              onClick={() => updatePeriodRange(periods.length - 1, periods.length - 1)}
              className={cn(
                "w-full rounded-[8px] border px-3 py-2 text-sm transition",
                selectedSinglePeriod === periods[periods.length - 1]
                  ? "border-[var(--tec)]/40 bg-[var(--tec)]/10 text-[var(--txt)]"
                  : "border-white/8 bg-white/[0.02] text-[var(--txt2)] hover:border-white/16"
              )}
            >
              Último mes disponible
            </button>
          </div>
        ) : (
          <div className="text-sm text-[var(--txt3)]">Sin periodos disponibles.</div>
        )}
      </FilterCard>

      {selectedSinglePeriod ? (
        <FilterCard title="Fechas del mes">
          <div className="space-y-2">
            <label className="block text-xs text-[var(--txt3)]">Fecha inicial</label>
            <input
              type="date"
              value={startDate}
              min={firstDate || undefined}
              max={lastDate || undefined}
              onChange={(event) => updateDateRange(event.target.value, endDate)}
              className="h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.03] px-2 text-sm text-[var(--txt)] outline-none"
            />
            <label className="block text-xs text-[var(--txt3)]">Fecha final</label>
            <input
              type="date"
              value={endDate}
              min={firstDate || undefined}
              max={lastDate || undefined}
              onChange={(event) => updateDateRange(startDate, event.target.value)}
              className="h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.03] px-2 text-sm text-[var(--txt)] outline-none"
            />
            <button
              type="button"
              onClick={() => setFilters({ dateRange: [null, null], selectedDates: [] })}
              className="text-xs text-[var(--txt3)] underline hover:text-[var(--txt2)]"
            >
              Limpiar fechas
            </button>
          </div>
        </FilterCard>
      ) : (
        <div className="rounded-[10px] border border-white/8 bg-white/[0.02] px-3 py-2 text-xs text-[var(--txt3)]">
          Elige el mismo mes en desde/hasta para habilitar el rango de fechas.
        </div>
      )}
    </div>
  );
}
