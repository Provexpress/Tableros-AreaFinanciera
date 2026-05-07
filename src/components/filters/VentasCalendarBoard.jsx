import { useMemo } from "react";
import PeriodRangeControls from "@/components/filters/PeriodRangeControls";
import { useVentasStore, ventasCalendarSelectors } from "@/store/useVentasStore";
import { isSingleValueRange } from "@/utils/facturasTime";

export default function VentasCalendarBoard() {
  const rawData = useVentasStore((state) => state.rawData);
  const filters = useVentasStore((state) => state.filters);
  const sourceMeta = useVentasStore((state) => state.sourceMeta);
  const setFilters = useVentasStore((state) => state.setFilters);
  const activeYear = filters.year;

  const years = useMemo(() => ventasCalendarSelectors.getYears(rawData), [rawData]);
  const periods = useMemo(() => ventasCalendarSelectors.getPeriods(rawData, activeYear), [activeYear, rawData]);
  const selectedPeriod = isSingleValueRange(filters.periodRange) ? filters.periodRange[0] : null;
  const dates = useMemo(
    () => ventasCalendarSelectors.getDatesForPeriod(rawData, selectedPeriod),
    [rawData, selectedPeriod]
  );

  return (
    <PeriodRangeControls
      years={years}
      periods={periods}
      dates={dates}
      filters={filters}
      sourceMeta={sourceMeta}
      activeYear={activeYear}
      setFilters={setFilters}
      title="Rango de ventas"
    />
  );
}
