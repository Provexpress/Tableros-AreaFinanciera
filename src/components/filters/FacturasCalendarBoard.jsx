import { useMemo } from "react";
import PeriodRangeControls from "@/components/filters/PeriodRangeControls";
import { useFacturasStore } from "@/store/useFacturasStore";
import {
  getFacturasDatesForPeriod,
  getFacturasPeriods,
  getFacturasYears,
  isSingleValueRange,
} from "@/utils/facturasTime";

export default function FacturasCalendarBoard({ fixedYear = null }) {
  const rawData = useFacturasStore((state) => state.rawData);
  const filters = useFacturasStore((state) => state.filters);
  const sourceMeta = useFacturasStore((state) => state.sourceMeta);
  const setFilters = useFacturasStore((state) => state.setFilters);
  const activeYear = fixedYear || filters.year;

  const years = useMemo(() => getFacturasYears(rawData), [rawData]);
  const periods = useMemo(() => getFacturasPeriods(rawData, activeYear), [activeYear, rawData]);
  const selectedPeriod = isSingleValueRange(filters.periodRange) ? filters.periodRange[0] : null;
  const dates = useMemo(() => getFacturasDatesForPeriod(rawData, selectedPeriod), [rawData, selectedPeriod]);

  return (
    <PeriodRangeControls
      years={years}
      periods={periods}
      dates={dates}
      filters={filters}
      sourceMeta={sourceMeta}
      activeYear={activeYear}
      fixedYear={fixedYear}
      setFilters={setFilters}
      title="Rango de compras"
    />
  );
}
