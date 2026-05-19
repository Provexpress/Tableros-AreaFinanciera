import { formatRangeLabel } from "./formatters";

const IMPACT_DEFS = [
  {
    key: "admon",
    label: "Errores Admon",
    color: "#4f8ef7",
    weekField: "valorErrAdmon",
    match: (row) => row.origen === "Administrativo",
  },
  {
    key: "com",
    label: "Causadas por comercial",
    color: "#f5a623",
    weekField: "valorErrComercial",
    match: (row) => row.origen === "Comercial",
  },
  {
    key: "devT",
    label: "Devoluciones totales",
    color: "#d4537e",
    weekField: "valorDevTotales",
    match: (row) => row.concepto.toLowerCase().includes("devolucion total"),
  },
  {
    key: "devP",
    label: "Devoluciones parciales",
    color: "#a78bfa",
    weekField: "valorDevParcial",
    match: (row) => row.concepto.toLowerCase().includes("devolucion parcial"),
  },
  {
    key: "refact",
    label: "Refacturaciones",
    color: "#34c88a",
    weekField: "valorRefact",
    match: (row) => Boolean(row.reemplazadaPor),
  },
];

const CAUSE_DEFS = [
  { key: "admon", label: "Errores Admon", color: "#4f8ef7", field: "errAdmon" },
  { key: "logistica", label: "Errores Logistica", color: "#a78bfa", field: "errLogistica" },
  { key: "comercial", label: "Causadas por comercial", color: "#f5a623", field: "errComercial" },
  { key: "sistema", label: "Errores Sistema", color: "#e05c5c", field: "errSistema" },
  { key: "cliente", label: "Inducidos Cliente", color: "#34c88a", field: "errCliente" },
  { key: "devoluciones", label: "Devoluciones", color: "#d4537e", field: "devoluciones" },
];

const CAUSE_VARIATION_COLORS = {
  Administrativo: "#4f8ef7",
  Comercial: "#f5a623",
  Cliente: "#34c88a",
  Devolucion: "#d4537e",
  "Razon social": "#a78bfa",
  Radicacion: "#8b5cf6",
  Correo: "#ff8a4c",
  "Orden de compra": "#1fcbcb",
  Otros: "#545869",
};

function sumBy(rows, field) {
  return rows.reduce((acc, row) => acc + Number(row[field] || 0), 0);
}

function buildWeekNcMap(ncRows) {
  const map = new Map();

  ncRows.forEach((row) => {
    if (!row.llaveSemana) {
      return;
    }

    if (!map.has(row.llaveSemana)) {
      map.set(row.llaveSemana, []);
    }
    map.get(row.llaveSemana).push(row);
  });

  return map;
}

function resolveWeeklyMetrics(weeks, weekNcMap) {
  return weeks.map((week) => {
    const mappedRows = weekNcMap.get(week.llave) || [];
    const mappedNcCount = mappedRows.length;
    const mappedNcValue = sumBy(mappedRows, "valor");
    const mappedRefactCount = mappedRows.reduce((acc, row) => acc + (row.reemplazadaPor ? 1 : 0), 0);

    const rawNcValue = Number(week.valorNc || 0);
    const rawNcCount = Number(week.numNc || 0);
    const rawRefactCount = Number(week.numNcRefact || 0);
    const rawPct = Number(week.pctNc || 0);
    const rawGrossValue = Number(week.valorBruto || 0);
    const rawNetValue = Number(week.facturadoNeto || 0);

    // Preferimos el consolidado semanal cuando la semana ya existe en esa fuente.
    // Si el resumen trae conteo de NC pero valor 0, mezclar el valor desde el detalle
    // rompe la relacion Bruta - NC = Neto en los KPIs.
    const resolvedNcValue = rawNcValue > 0 ? rawNcValue : rawNcCount > 0 ? rawNcValue : mappedNcValue;
    const resolvedNcCount = rawNcCount > 0 ? rawNcCount : mappedNcCount;
    const resolvedRefactCount = rawRefactCount > 0 ? rawRefactCount : mappedRefactCount;
    const resolvedGrossValue =
      rawGrossValue > 0 ? rawGrossValue : rawNetValue > 0 ? rawNetValue + resolvedNcValue : rawGrossValue;
    const resolvedNetValue =
      rawNetValue > 0 ? rawNetValue : resolvedGrossValue > 0 ? Math.max(0, resolvedGrossValue - resolvedNcValue) : rawNetValue;
    const resolvedPct = resolvedGrossValue > 0 ? resolvedNcValue / resolvedGrossValue : rawPct;

    return {
      ...week,
      rawValorBruto: rawGrossValue,
      rawFacturadoNeto: rawNetValue,
      rawValorNc: rawNcValue,
      rawNumNc: rawNcCount,
      rawNumNcRefact: rawRefactCount,
      rawPctNc: rawPct,
      valorBruto: resolvedGrossValue,
      valorNc: resolvedNcValue,
      numNc: resolvedNcCount,
      numNcRefact: resolvedRefactCount,
      facturadoNeto: resolvedNetValue,
      pctNc: resolvedPct,
      fallbackGrossFromNet: rawGrossValue <= 0 && resolvedGrossValue > 0,
      fallbackFromNcDetail: rawNcValue <= 0 && rawNcCount <= 0 && mappedNcValue > 0,
      mappedNcValue,
      mappedNcCount,
    };
  });
}

function filterWeeksByTime(weeks, filters) {
  return weeks.filter((week) => {
    const start = filters.periodRange?.[0] || null;
    const end = filters.periodRange?.[1] || null;
    const selectedPeriodSet = new Set(filters.selectedPeriods || []);
    const semester = filters.semester && filters.semester !== "ALL" ? Number(filters.semester) : null;
    const quarter = filters.quarter && filters.quarter !== "ALL" ? Number(filters.quarter) : null;

    if (selectedPeriodSet.size) {
      if (!selectedPeriodSet.has(week.monthKey)) {
        return false;
      }
    } else {
      if (start && week.monthKey && week.monthKey.localeCompare(start) < 0) {
        return false;
      }
      if (end && week.monthKey && week.monthKey.localeCompare(end) > 0) {
        return false;
      }
    }
    if (filters.year !== "ALL" && String(week.year) !== String(filters.year)) {
      return false;
    }
    if (!selectedPeriodSet.size && filters.month !== "ALL" && Number(week.monthNumber) !== Number(filters.month)) {
      return false;
    }
    if (semester) {
      const weekSemester = Number(week.monthNumber) <= 6 ? 1 : 2;
      if (weekSemester !== semester) {
        return false;
      }
    }
    if (quarter) {
      const weekQuarter = Math.ceil(Number(week.monthNumber || 0) / 3);
      if (weekQuarter !== quarter) {
        return false;
      }
    }
    return true;
  });
}

function applyRowInteractionFilter(rows, filters) {
  let next = [...rows];

  if (filters.impactKey) {
    const impact = IMPACT_DEFS.find((item) => item.key === filters.impactKey);
    if (impact) {
      next = next.filter((row) => impact.match(row));
    }
  }

  if (filters.responsible) {
    next = next.filter((row) => row.origen === "Comercial" && row.asesor === filters.responsible);
  }

  return next;
}

function filterWeeksByInteraction(weeks, weekNcMap, filters) {
  let next = [...weeks];

  if (filters.impactKey) {
    const impact = IMPACT_DEFS.find((item) => item.key === filters.impactKey);
    if (impact) {
      next = next.filter((week) => (weekNcMap.get(week.llave) || []).some((row) => impact.match(row)));
    }
  }

  if (filters.responsible) {
    next = next.filter((week) =>
      (weekNcMap.get(week.llave) || []).some(
        (row) => row.origen === "Comercial" && row.asesor === filters.responsible
      )
    );
  }

  return next;
}

function buildMonthOptions(weeks, filters) {
  const start = filters.periodRange?.[0] || null;
  const end = filters.periodRange?.[1] || null;
  const selectedPeriodSet = new Set(filters.selectedPeriods || []);
  const semester = filters.semester && filters.semester !== "ALL" ? Number(filters.semester) : null;
  const quarter = filters.quarter && filters.quarter !== "ALL" ? Number(filters.quarter) : null;
  const scoped = weeks.filter((week) => {
    if (selectedPeriodSet.size) {
      if (!selectedPeriodSet.has(week.monthKey)) {
        return false;
      }
    } else {
      if (start && week.monthKey && week.monthKey.localeCompare(start) < 0) {
        return false;
      }
      if (end && week.monthKey && week.monthKey.localeCompare(end) > 0) {
        return false;
      }
    }
    if (filters.year !== "ALL" && String(week.year) !== String(filters.year)) {
      return false;
    }
    if (!selectedPeriodSet.size && filters.month !== "ALL" && Number(week.monthNumber) !== Number(filters.month)) {
      return false;
    }
    if (semester) {
      const weekSemester = Number(week.monthNumber) <= 6 ? 1 : 2;
      if (weekSemester !== semester) {
        return false;
      }
    }
    if (quarter) {
      const weekQuarter = Math.ceil(Number(week.monthNumber || 0) / 3);
      if (weekQuarter !== quarter) {
        return false;
      }
    }
    return true;
  });

  return [...new Set(scoped.map((week) => Number(week.monthNumber)))]
    .filter(Boolean)
    .sort((a, b) => a - b);
}

function buildKpis(weeks) {
  const totalBruto = sumBy(weeks, "valorBruto");
  const totalNc = sumBy(weeks, "valorNc");
  const totalRefact = sumBy(weeks, "valorRefact");
  const totalNeto = sumBy(weeks, "facturadoNeto");
  const totalFacturas = sumBy(weeks, "numFacturas");
  const totalNcCount = sumBy(weeks, "numNc");
  const totalRefactCount = sumBy(weeks, "numNcRefact");
  const pctNc = totalBruto > 0 ? (totalNc / totalBruto) * 100 : 0;
  const lastWeek = weeks[weeks.length - 1] || null;

  return {
    totalBruto,
    totalNc,
    totalRefact,
    totalNeto,
    totalFacturas,
    totalNcCount,
    totalRefactCount,
    pctNc,
    lastWeek,
  };
}

function buildCauseSummary(rows) {
  return CAUSE_DEFS.map((item) => {
    const scopedRows = rows.filter((row) => {
      if (item.key === "admon") return row.origen === "Administrativo";
      if (item.key === "logistica") return row.origen === "Logistica";
      if (item.key === "comercial") return row.origen === "Comercial";
      if (item.key === "sistema") return row.origen === "Sistema";
      if (item.key === "cliente") return row.origen === "Cliente";
      if (item.key === "devoluciones") {
        return row.origen === "Devolucion" || String(row.concepto || "").toLowerCase().includes("devolucion");
      }
      return false;
    });

    return {
      ...item,
      value: scopedRows.length,
      totalValue: sumBy(scopedRows, "valor"),
    };
  })
    .filter((item) => item.value > 0 || item.totalValue > 0)
    .sort((a, b) => b.value - a.value || b.totalValue - a.totalValue);
}

function buildImpactSummary(weeks) {
  return IMPACT_DEFS.map((item) => ({
    ...item,
    value: sumBy(weeks, item.weekField),
  }));
}

function buildResponsibleSummary(rows) {
  const totals = new Map();

  rows.forEach((row) => {
    if (row.origen !== "Comercial") {
      return;
    }

    const key = row.asesor || "Sin responsable";
    if (!totals.has(key)) {
      totals.set(key, { key, label: key, value: 0, totalValue: 0, color: "#f5a623" });
    }

    const bucket = totals.get(key);
    bucket.value += 1;
    bucket.totalValue += Number(row.valor || 0);
  });

  return [...totals.values()]
    .sort((a, b) => b.value - a.value || b.totalValue - a.totalValue)
    .slice(0, 6);
}

function buildClientSummary(rows) {
  const totals = new Map();

  rows.forEach((row) => {
    const key = row.cliente || "Sin cliente";
    if (!totals.has(key)) {
      totals.set(key, { key, label: key, value: 0, totalValue: 0, color: "#4f8ef7" });
    }

    const bucket = totals.get(key);
    bucket.value += 1;
    bucket.totalValue += Number(row.valor || 0);
  });

  return [...totals.values()]
    .sort((a, b) => b.value - a.value || b.totalValue - a.totalValue)
    .slice(0, 6);
}

function buildBucketMap(rows, getKey, getLabel, getColor) {
  const map = new Map();

  rows.forEach((row) => {
    const key = getKey(row);
    if (!key) {
      return;
    }

    if (!map.has(key)) {
      map.set(key, {
        key,
        label: getLabel ? getLabel(row, key) : key,
        color: getColor ? getColor(row, key) : "#545869",
        count: 0,
        totalValue: 0,
      });
    }

    const bucket = map.get(key);
    bucket.count += 1;
    bucket.totalValue += Number(row.valor || 0);
  });

  return map;
}

function buildDeltaList(currentMap, previousMap) {
  const allKeys = new Set([...currentMap.keys(), ...previousMap.keys()]);

  return [...allKeys]
    .map((key) => {
      const current = currentMap.get(key) || null;
      const previous = previousMap.get(key) || null;

      return {
        key,
        label: current?.label || previous?.label || key,
        color: current?.color || previous?.color || "#545869",
        currentCount: current?.count || 0,
        previousCount: previous?.count || 0,
        currentValue: current?.totalValue || 0,
        previousValue: previous?.totalValue || 0,
        deltaCount: (current?.count || 0) - (previous?.count || 0),
        deltaValue: (current?.totalValue || 0) - (previous?.totalValue || 0),
      };
    })
    .filter((item) => item.currentCount > 0 || item.previousCount > 0)
    .sort((a, b) => {
      if (b.deltaCount !== a.deltaCount) {
        return b.deltaCount - a.deltaCount;
      }
      return b.deltaValue - a.deltaValue;
    });
}

function buildWeekVariation(weeks, weekNcMap, filters, selectedWeek) {
  if (!weeks.length) {
    return {
      currentWeek: null,
      previousWeek: null,
      ncDeltaCount: 0,
      ncDeltaValue: 0,
      worseningCauses: [],
      improvingCauses: [],
      worseningResponsibles: [],
      improvingResponsibles: [],
    };
  }

  const activeWeekKey = selectedWeek && weeks.some((week) => week.llave === selectedWeek) ? selectedWeek : weeks[weeks.length - 1]?.llave;
  const activeWeekIndex = weeks.findIndex((week) => week.llave === activeWeekKey);
  const currentWeek = activeWeekIndex >= 0 ? weeks[activeWeekIndex] : null;
  const previousWeek = activeWeekIndex > 0 ? weeks[activeWeekIndex - 1] : null;

  if (!currentWeek || !previousWeek) {
    return {
      currentWeek,
      previousWeek,
      ncDeltaCount: 0,
      ncDeltaValue: 0,
      worseningCauses: [],
      improvingCauses: [],
      worseningResponsibles: [],
      improvingResponsibles: [],
    };
  }

  const currentRows = applyRowInteractionFilter(weekNcMap.get(currentWeek.llave) || [], filters);
  const previousRows = applyRowInteractionFilter(weekNcMap.get(previousWeek.llave) || [], filters);

  const currentCauseMap = buildBucketMap(
    currentRows,
    (row) => row.causa || "Otros",
    (_row, key) => key,
    (_row, key) => CAUSE_VARIATION_COLORS[key] || "#545869"
  );
  const previousCauseMap = buildBucketMap(
    previousRows,
    (row) => row.causa || "Otros",
    (_row, key) => key,
    (_row, key) => CAUSE_VARIATION_COLORS[key] || "#545869"
  );

  const currentResponsibleMap = buildBucketMap(
    currentRows.filter((row) => row.origen === "Comercial"),
    (row) => row.asesor || "Sin responsable",
    (_row, key) => key,
    () => "#f5a623"
  );
  const previousResponsibleMap = buildBucketMap(
    previousRows.filter((row) => row.origen === "Comercial"),
    (row) => row.asesor || "Sin responsable",
    (_row, key) => key,
    () => "#f5a623"
  );

  const causeDeltas = buildDeltaList(currentCauseMap, previousCauseMap);
  const responsibleDeltas = buildDeltaList(currentResponsibleMap, previousResponsibleMap);

  return {
    currentWeek,
    previousWeek,
    ncDeltaCount: currentRows.length - previousRows.length,
    ncDeltaValue: sumBy(currentRows, "valor") - sumBy(previousRows, "valor"),
    worseningCauses: causeDeltas.filter((item) => item.deltaCount > 0 || item.deltaValue > 0).slice(0, 4),
    improvingCauses: causeDeltas.filter((item) => item.deltaCount < 0 || item.deltaValue < 0).slice(0, 2),
    worseningResponsibles: responsibleDeltas.filter((item) => item.deltaCount > 0 || item.deltaValue > 0).slice(0, 4),
    improvingResponsibles: responsibleDeltas.filter((item) => item.deltaCount < 0 || item.deltaValue < 0).slice(0, 2),
  };
}

function buildCriticalWeeks(weeks) {
  return [...weeks]
    .sort((a, b) => b.pctNc - a.pctNc)
    .slice(0, 6)
    .map((week) => ({
      key: week.llave,
      label: `${week.label} ${week.year}`,
      value: Number(week.pctNc || 0) * 100,
      pctNcPercent: Number(week.pctNc || 0) * 100,
      color: week.pctNc < 0.04 ? "#34c88a" : week.pctNc < 0.08 ? "#f5a623" : "#e05c5c",
      note: `${week.numNc} NC`,
    }));
}

function buildWeekOptions(weeks, weekNcMap, filters) {
  return weeks
    .filter((week) => applyRowInteractionFilter(weekNcMap.get(week.llave) || [], filters).length > 0)
    .map((week) => ({
      key: week.llave,
      label: `${week.label} ${week.year}`,
      note: `${applyRowInteractionFilter(weekNcMap.get(week.llave) || [], filters).length} NC`,
      pctNcPercent: Number(week.pctNc || 0) * 100,
    }));
}

function buildWeeklySeries(weeks) {
  return weeks.map((week) => ({
    ...week,
    displayLabel: `${week.label} ${week.year}`,
    pctNcPercent: Number(week.pctNc || 0) * 100,
    notaCelda: week.notaCelda || null,
  }));
}

function buildSelectedWeek(weeks, weekNcMap, filters, selectedWeek) {
  const visibleWeekKeys = new Set(weeks.map((week) => week.llave));
  const resolvedWeek = selectedWeek && visibleWeekKeys.has(selectedWeek) ? selectedWeek : null;
  const selectedMeta = resolvedWeek ? weeks.find((week) => week.llave === resolvedWeek) || null : null;
  const selectedRows = resolvedWeek
    ? applyRowInteractionFilter(weekNcMap.get(resolvedWeek) || [], filters).sort((a, b) => b.valor - a.valor)
    : [];

  const weekNote = selectedMeta?.notaCelda || selectedMeta?.comentario || null;
  const noteText = weekNote
    ? `Nota: ${weekNote}`
    : resolvedWeek
      ? "Sin nota de celda registrada para esta semana."
      : "";

  return {
    selectedWeek: resolvedWeek,
    selectedWeekMeta: selectedMeta,
    selectedWeekRows: selectedRows,
    selectedWeekComment: noteText,
  };
}

function buildRangeLabel(filters, meta, monthsAvailable) {
  if (filters.month !== "ALL") {
    const monthIndex = Number(filters.month) - 1;
    const monthLabel = monthIndex >= 0 ? ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][monthIndex] : "Mes";
    return filters.year === "ALL" ? `${monthLabel} (multianual)` : `${monthLabel} ${filters.year}`;
  }

  if (filters.semester !== "ALL") {
    return filters.year === "ALL" ? `Semestre ${filters.semester} (multianual)` : `Semestre ${filters.semester} ${filters.year}`;
  }

  if (filters.quarter !== "ALL") {
    return filters.year === "ALL" ? `Trimestre ${filters.quarter} (multianual)` : `Trimestre ${filters.quarter} ${filters.year}`;
  }

  const defaultStart = meta?.range?.start || null;
  const defaultEnd = meta?.range?.end || null;
  const rangeChanged =
    filters.periodRange?.[0] !== defaultStart || filters.periodRange?.[1] !== defaultEnd;

  if (rangeChanged) {
    const rangeLabel = formatRangeLabel(filters.periodRange?.[0], filters.periodRange?.[1]);
    const monthIndex = Number(filters.month) - 1;
    const monthLabel =
      monthIndex >= 0
        ? ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][monthIndex]
        : null;

    if (filters.year !== "ALL" && filters.month !== "ALL") {
      return `${rangeLabel} · Año ${filters.year} · ${monthLabel || `Mes ${filters.month}`}`;
    }
    if (filters.year !== "ALL") {
      return `${rangeLabel} · Año ${filters.year}`;
    }
    if (filters.month !== "ALL") {
      return `${rangeLabel} · ${monthLabel || `Mes ${filters.month}`}`;
    }
    return rangeLabel;
  }

  if (filters.year === "ALL" && filters.month === "ALL") {
    return meta?.rangeLabel || "Todo semanal";
  }

  if (filters.year !== "ALL" && filters.month === "ALL") {
    return `Año ${filters.year}`;
  }

  if (monthsAvailable.length) {
    return "Semanas visibles";
  }

  return "Sin rango";
}

function getInteractionLabel(filters) {
  if (filters.impactKey) {
    return IMPACT_DEFS.find((item) => item.key === filters.impactKey)?.label || null;
  }

  if (filters.responsible) {
    return filters.responsible;
  }

  return null;
}

export function buildNotasDerivedState(rawWeeks, rawNcRows, filters, selectedWeek, meta) {
  const weekNcMap = buildWeekNcMap(rawNcRows);
  const monthsAvailable = buildMonthOptions(rawWeeks, filters);

  const visibleWeeks = resolveWeeklyMetrics(
    filterWeeksByInteraction(filterWeeksByTime(rawWeeks, filters), weekNcMap, filters),
    weekNcMap
  );
  const visibleWeekKeys = new Set(visibleWeeks.map((week) => week.llave));
  const visibleNcRows = applyRowInteractionFilter(
    rawNcRows.filter((row) => visibleWeekKeys.has(row.llaveSemana)),
    filters
  );

  const weekSelection = buildSelectedWeek(visibleWeeks, weekNcMap, filters, selectedWeek);
  const analysisWeeks = weekSelection.selectedWeekMeta ? [weekSelection.selectedWeekMeta] : visibleWeeks;
  const analysisRows = weekSelection.selectedWeek ? weekSelection.selectedWeekRows : visibleNcRows;
  const kpis = buildKpis(analysisWeeks);
  const weekVariation = buildWeekVariation(visibleWeeks, weekNcMap, filters, weekSelection.selectedWeek);

  return {
    visibleWeeks,
    visibleNcRows,
    monthsAvailable,
    kpis,
    causeSummary: buildCauseSummary(analysisRows),
    impactSummary: buildImpactSummary(visibleWeeks),
    responsibleSummary: buildResponsibleSummary(analysisRows),
    clientSummary: buildClientSummary(analysisRows),
    criticalWeeks: buildCriticalWeeks(visibleWeeks),
    weeklySeries: buildWeeklySeries(visibleWeeks),
    weekOptions: buildWeekOptions(visibleWeeks, weekNcMap, filters),
    activeInteractionLabel: getInteractionLabel(filters),
    headerRangeLabel: buildRangeLabel(filters, meta, monthsAvailable),
    weekVariation,
    ...weekSelection,
  };
}
