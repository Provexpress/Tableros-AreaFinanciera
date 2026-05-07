function sortTimeKeysAsc(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

const facturasTimeIndexCache = new WeakMap();

function getOrCreateSet(map, key) {
  if (!map.has(key)) {
    map.set(key, new Set());
  }

  return map.get(key);
}

function buildFacturasTimeIndex(rawData) {
  const years = new Set();
  const periodsAll = new Set();
  const periodsByYear = new Map();
  const datesByPeriod = new Map();

  rawData.forEach((row) => {
    const yearKey = row?.anio != null && row.anio !== "" ? String(row.anio) : null;
    const periodKey = row?.periodo ? String(row.periodo) : null;
    const dateKey = row?.fechaIso ? String(row.fechaIso) : null;

    if (yearKey) {
      years.add(yearKey);
    }

    if (!periodKey) {
      return;
    }

    periodsAll.add(periodKey);

    if (yearKey) {
      getOrCreateSet(periodsByYear, yearKey).add(periodKey);
    }

    if (dateKey) {
      getOrCreateSet(datesByPeriod, periodKey).add(dateKey);
    }
  });

  return {
    years: [...years].sort(sortTimeKeysAsc),
    periodsAll: [...periodsAll].sort(sortTimeKeysAsc),
    periodsByYear: new Map(
      [...periodsByYear.entries()].map(([yearKey, periodSet]) => [
        yearKey,
        [...periodSet].sort(sortTimeKeysAsc),
      ])
    ),
    datesByPeriod: new Map(
      [...datesByPeriod.entries()].map(([periodKey, dateSet]) => [
        periodKey,
        [...dateSet].sort(sortTimeKeysAsc),
      ])
    ),
  };
}

function getFacturasTimeIndex(rawData) {
  if (!Array.isArray(rawData)) {
    return {
      years: [],
      periodsAll: [],
      periodsByYear: new Map(),
      datesByPeriod: new Map(),
    };
  }

  const cachedIndex = facturasTimeIndexCache.get(rawData);
  if (cachedIndex) {
    return cachedIndex;
  }

  const nextIndex = buildFacturasTimeIndex(rawData);
  facturasTimeIndexCache.set(rawData, nextIndex);
  return nextIndex;
}

export function sameRange(left, right) {
  return (left?.[0] || null) === (right?.[0] || null) && (left?.[1] || null) === (right?.[1] || null);
}

export function isSingleValueRange(range) {
  const [start, end] = range || [null, null];
  return Boolean(start) && start === end;
}

export function getFacturasYears(rawData) {
  return getFacturasTimeIndex(rawData).years;
}

export function getFacturasPeriods(rawData, year = "ALL") {
  const index = getFacturasTimeIndex(rawData);
  return year === "ALL" ? index.periodsAll : index.periodsByYear.get(String(year)) || [];
}

export function getFacturasPeriodDefaults(periods, year = "ALL", metaRange = null) {
  return [
    year === "ALL" ? metaRange?.start || periods[0] || null : periods[0] || null,
    year === "ALL" ? metaRange?.end || periods[periods.length - 1] || null : periods[periods.length - 1] || null,
  ];
}

export function getFacturasDatesForPeriod(rawData, periodKey) {
  if (!periodKey) {
    return [];
  }

  return getFacturasTimeIndex(rawData).datesByPeriod.get(String(periodKey)) || [];
}

export function getMonthValueFromPeriod(periodKey) {
  const [, month] = String(periodKey || "").split("-");
  if (!month) {
    return "ALL";
  }

  return String(Number(month));
}
