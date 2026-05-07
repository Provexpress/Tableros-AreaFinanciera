import { useMemo } from "react";
import { Select } from "@/components/ui/select";
import { cn } from "@/utils/cn";
import { useNotasCreditoStore } from "@/store/useNotasCreditoStore";

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

export default function NotasCalendarBoard() {
  const filters = useNotasCreditoStore((state) => state.filters);
  const selectedWeek = useNotasCreditoStore((state) => state.selectedWeek);
  const selectedWeekMeta = useNotasCreditoStore((state) => state.selectedWeekMeta);
  const sourceMeta = useNotasCreditoStore((state) => state.sourceMeta);
  const rawWeeks = useNotasCreditoStore((state) => state.rawWeeks);
  const weekOptions = useNotasCreditoStore((state) => state.weekOptions);
  const setFilters = useNotasCreditoStore((state) => state.setFilters);
  const setSelectedWeek = useNotasCreditoStore((state) => state.setSelectedWeek);
  const selectedPeriods = filters.selectedPeriods || [];

  const years = sourceMeta?.years || [];
  const periods = useMemo(
    () =>
      [...new Set(
        rawWeeks
          .filter((row) => filters.year === "ALL" || String(row.year) === String(filters.year))
          .map((row) => row.monthKey)
          .filter(Boolean)
      )].sort((a, b) => a.localeCompare(b)),
    [filters.year, rawWeeks]
  );
  const defaultRange = [
    filters.year === "ALL" ? sourceMeta?.range?.start || periods[0] || null : periods[0] || null,
    filters.year === "ALL"
      ? sourceMeta?.range?.end || periods[periods.length - 1] || null
      : periods[periods.length - 1] || null,
  ];
  const rawWeekMap = useMemo(() => new Map(rawWeeks.map((row) => [row.llave, row])), [rawWeeks]);

  const monthItems = useMemo(() => {
    const buckets = new Map();
    const scopedWeeks = rawWeeks
      .filter((row) => filters.year === "ALL" || String(row.year) === String(filters.year))
      .sort((a, b) => String(a.monthKey || "").localeCompare(String(b.monthKey || "")));

    scopedWeeks.forEach((row) => {
      const monthNumber = Number(row.monthNumber || 0);
      if (!monthNumber) return;

      const key = filters.year === "ALL" ? String(monthNumber) : String(row.monthKey || "");
      if (!key) return;

      if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          monthNumber,
          label: MONTH_LABELS[monthNumber - 1] || `M${monthNumber}`,
          fullLabel: MONTH_FULL[monthNumber - 1] || `Mes ${monthNumber}`,
          ncCount: 0,
          monthKey: filters.year === "ALL" ? null : row.monthKey,
        });
      }
      buckets.get(key).ncCount += Number(row.numNc || 0);
    });

    return [...buckets.values()];
  }, [filters.year, rawWeeks]);

  const weekItems = useMemo(
    () =>
      weekOptions
        .map((week) => {
          const raw = rawWeekMap.get(week.key);
          return {
            key: week.key,
            label: week.label,
            note: week.note,
            monthKey: raw?.monthKey || null,
            monthNumber: Number(raw?.monthNumber || 0),
            isSelected: selectedWeek === week.key,
          };
        })
        .filter((week) => week.monthKey),
    [rawWeekMap, selectedWeek, weekOptions]
  );

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
      selectedPeriods: [],
    });
  };

  const handleSelectMonth = (month) => {
    if (!month.monthKey || filters.year === "ALL") {
      const isSameMonth = String(filters.month) === String(month.monthNumber);
      setFilters({
        month: isSameMonth ? "ALL" : String(month.monthNumber),
        periodRange: defaultRange,
        selectedPeriods: [],
      });
      return;
    }

    const nextSelectedPeriods = selectedPeriods.includes(month.monthKey)
      ? selectedPeriods.filter((period) => period !== month.monthKey)
      : [...selectedPeriods, month.monthKey].sort((a, b) => a.localeCompare(b));

    setFilters({
      month: nextSelectedPeriods.length === 1 ? String(Number(nextSelectedPeriods[0].split("-")[1])) : "ALL",
      semester: "ALL",
      quarter: "ALL",
      periodRange: nextSelectedPeriods.length
        ? [nextSelectedPeriods[0], nextSelectedPeriods[nextSelectedPeriods.length - 1]]
        : defaultRange,
      selectedPeriods: nextSelectedPeriods,
    });
  };

  const handleSelectWeek = (week) => {
    const shouldFocusMonth =
      filters.year !== "ALL" &&
      (filters.month !== String(week.monthNumber) ||
        filters.periodRange?.[0] !== week.monthKey ||
        filters.periodRange?.[1] !== week.monthKey);

    if (shouldFocusMonth) {
      setFilters({
        month: String(week.monthNumber),
        semester: "ALL",
        quarter: "ALL",
        periodRange: [week.monthKey, week.monthKey],
        selectedPeriods: [],
      });
    }

    setSelectedWeek(week.key);
  };

  const activeMonthLabel = filters.month !== "ALL"
    ? MONTH_FULL[Number(filters.month) - 1] || filters.month
    : null;

  return (
    <div className="space-y-3">
      {/* Selector de año */}
      <CalendarCard title="Año">
        <Select value={filters.year} onChange={(e) => handleSelectYear(e.target.value)}>
          <option value="ALL">Todos los años</option>
          {years.map((year) => (
            <option key={year} value={String(year)}>{year}</option>
          ))}
        </Select>
      </CalendarCard>

      {/* Meses como grid de cards */}
      <CalendarCard title={activeMonthLabel ? `Meses del ${activeMonthLabel}` : "Meses"}>
        <div className="grid grid-cols-4 gap-1.5">
          {monthItems.map((month) => {
            const isActive =
              selectedPeriods.includes(month.monthKey) ||
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
                  {month.ncCount} NC
                </span>
              </button>
            );
          })}
        </div>
      </CalendarCard>

      {/* Semanas */}
      <CalendarCard title="Semanas">
        {weekItems.length ? (
          <>
            <div className="max-h-[180px] space-y-1 overflow-y-auto pr-1">
              {weekItems.map((week) => (
                <button
                  key={week.key}
                  type="button"
                  onClick={() => handleSelectWeek(week)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[8px] border px-2.5 py-1.5 text-left transition-colors duration-150",
                    week.isSelected
                      ? "border-[color:rgb(79_142_247_/_0.55)] bg-[color:rgb(79_142_247_/_0.18)] text-[var(--txt)]"
                      : "border-white/8 bg-white/[0.02] text-[var(--txt2)] hover:border-white/15 hover:text-[var(--txt)]"
                  )}
                >
                  <span className="text-sm">{week.label}</span>
                  <span className="text-[11px] text-[var(--txt3)]">{week.note}</span>
                </button>
              ))}
            </div>
            {selectedWeekMeta && (
              <div className="mt-2 text-xs text-[var(--txt3)]">
                Activa: <span className="text-[var(--tec)]">{selectedWeekMeta.label}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setSelectedWeek(null)}
              className="mt-1 text-xs text-[var(--txt3)] underline transition-colors duration-150 hover:text-[var(--txt2)]"
            >
              Quitar semana seleccionada
            </button>
          </>
        ) : (
          <div className="py-4 text-center text-xs text-[var(--txt3)]">
            Selecciona un año y mes para ver semanas
          </div>
        )}
      </CalendarCard>
    </div>
  );
}
