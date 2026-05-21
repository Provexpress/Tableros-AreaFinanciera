import { useMemo } from "react";
import PeriodRangeControls from "@/components/filters/PeriodRangeControls";
import { useNotasCreditoStore } from "@/store/useNotasCreditoStore";
import { cn } from "@/utils/cn";

function CalendarCard({ title, children, className = "" }) {
  return (
    <div className={cn("filter-card rounded-[12px] border border-[rgba(26,43,107,0.12)] bg-white p-3 shadow-[0_8px_20px_rgba(26,43,107,0.04)]", className)}>
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

  const years = useMemo(
    () => [...new Set(rawWeeks.map((row) => String(row.year)).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rawWeeks]
  );

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

  const rawWeekMap = useMemo(() => new Map(rawWeeks.map((row) => [row.llave, row])), [rawWeeks]);

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
            fechaInicialIso: raw?.fechaInicialIso || "",
            weekOfMonth: Number(raw?.weekOfMonth || 0),
            isSelected: selectedWeek === week.key,
          };
        })
        .filter((week) => week.monthKey)
        .sort(
          (a, b) =>
            String(b.fechaInicialIso).localeCompare(String(a.fechaInicialIso)) ||
            Number(b.weekOfMonth || 0) - Number(a.weekOfMonth || 0)
        ),
    [rawWeekMap, selectedWeek, weekOptions]
  );

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

  return (
    <div className="space-y-3">
      <PeriodRangeControls
        years={years}
        periods={periods}
        dates={[]}
        filters={filters}
        sourceMeta={sourceMeta}
        activeYear={filters.year}
        setFilters={setFilters}
        title="Rango de NC"
        showDateControls={false}
      />

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
                      ? "border-[var(--tec)]/45 bg-[var(--tec)]/12 text-[var(--txt)]"
                      : "border-[rgba(26,43,107,0.1)] bg-white text-[var(--txt2)] hover:border-[rgba(21,101,192,0.2)] hover:bg-[var(--surface-2)] hover:text-[var(--txt)]"
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
            Selecciona un año y rango para ver semanas
          </div>
        )}
      </CalendarCard>
    </div>
  );
}
