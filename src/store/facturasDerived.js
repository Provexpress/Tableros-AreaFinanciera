import { formatPct, getTrendTone } from "@/utils/formatters";
import { calcularResumen } from "@/utils/documentSummary";

function safePercent(part, total) {
  if (!total) {
    return 0;
  }

  return (part / total) * 100;
}

function sortPeriodsAsc(a, b) {
  return a.localeCompare(b);
}

function isReviewStatus(status) {
  const normalized = String(status || "").toLowerCase();
  return normalized.includes("revisi") || normalized.includes("pend");
}

function isRejectedStatus(status) {
  return String(status || "").toLowerCase().includes("rechaz");
}

function getStatusKey(status) {
  if (isRejectedStatus(status)) {
    return "Rechazado";
  }

  if (isReviewStatus(status)) {
    return "En revision";
  }

  if (String(status || "").toLowerCase().includes("aprob")) {
    return "Aprobado";
  }

  return "En revision";
}

function isCreditNote(row) {
  return (
    Number(row.signoDocumento || 1) < 0 ||
    String(row.tipoDocNormalizado || row.tipoDoc || "").toLowerCase().includes("nota de cr")
  );
}

function isDebitNote(row) {
  return String(row.tipoDocNormalizado || row.tipoDoc || "").toLowerCase().includes("nota de d");
}

export function isPurchaseInvoice(row) {
  return !isCreditNote(row) && !isDebitNote(row);
}

function getDocumentValue(row) {
  return Math.abs(Number(row.totalOriginal ?? row.total ?? 0));
}

function getNetValue(row) {
  return Number(row.total || 0);
}

function compareDocumentRows(a, b) {
  const amountDelta = getDocumentValue(b) - getDocumentValue(a);
  if (amountDelta !== 0) {
    return amountDelta;
  }

  return String(b.fechaIso || "").localeCompare(String(a.fechaIso || ""));
}

function buildInsightsFromMetrics(metrics, totalRows) {
  const topCategory = metrics.byCategorySorted[0];
  const ocPct = safePercent(metrics.missingOcCount, totalRows);
  const lastThree = metrics.byPeriodSorted.slice(-3);
  const firstLastThree = lastThree[0]?.total || 0;
  const lastLastThree = lastThree[lastThree.length - 1]?.total || 0;
  const trendPct = firstLastThree ? ((lastLastThree - firstLastThree) / firstLastThree) * 100 : 0;

  return [
    topCategory
      ? `La categoria ${topCategory.category} representa ${formatPct(topCategory.pct, { signed: false })} del gasto total visible.`
      : "No hay concentración visible por categoría.",
    `${formatPct(ocPct, { signed: false })} de las facturas no tiene Orden de Compra registrada.`,
    trendPct >= 0
      ? `La tendencia de los últimos 3 meses muestra una mejora de ${formatPct(trendPct)}.`
      : `La tendencia de los últimos 3 meses muestra una caída de ${formatPct(trendPct)}.`,
  ];
}

function createSupplierBucket(provider) {
  return {
    provider,
    total: 0,
    count: 0,
    purchaseInvoiceTotal: 0,
    purchaseInvoiceCount: 0,
    creditNoteTotal: 0,
    creditNoteCount: 0,
    rejectedCount: 0,
    reviewCount: 0,
  };
}

function accumulateSupplierBucket(bucket, netValue, docValue, isCredit, isPurchase, statusKey) {
  bucket.total += netValue;
  bucket.count += 1;

  if (isCredit) {
    bucket.creditNoteCount += 1;
    bucket.creditNoteTotal += docValue;
  }

  if (isPurchase) {
    bucket.purchaseInvoiceCount += 1;
    bucket.purchaseInvoiceTotal += docValue;
  }

  if (statusKey === "Rechazado") {
    bucket.rejectedCount += 1;
  }

  if (statusKey === "En revision") {
    bucket.reviewCount += 1;
  }
}

function mapSupplierRanking(map, totalBase, limit = 10) {
  return [...map.values()]
    .map((item) => ({
      ...item,
      pct: safePercent(item.total, totalBase),
      avgTicket: item.purchaseInvoiceCount ? item.purchaseInvoiceTotal / item.purchaseInvoiceCount : 0,
      incidentCount: item.rejectedCount + item.reviewCount,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function applyFacturasFilters(data, filters) {
  const year = filters.year && filters.year !== "ALL" ? String(filters.year) : null;
  const month = filters.month && filters.month !== "ALL" ? Number(filters.month) : null;
  const semester = filters.semester && filters.semester !== "ALL" ? Number(filters.semester) : null;
  const quarter = filters.quarter && filters.quarter !== "ALL" ? Number(filters.quarter) : null;
  const category = filters.category && filters.category !== "ALL" ? filters.category : null;
  const status = filters.status && filters.status !== "ALL" ? filters.status : null;
  const providerQuery = filters.provider ? filters.provider.toLowerCase().trim() : "";
  const [periodStart, periodEnd] = filters.periodRange || [null, null];
  const [dateStart, dateEnd] = filters.dateRange || [null, null];
  const selectedPeriodSet = new Set(filters.selectedPeriods || []);
  const selectedDateSet = new Set(filters.selectedDates || []);

  return data.filter((row) => {
    if (year && String(row.anio) !== year) {
      return false;
    }

    if (!selectedPeriodSet.size && month && Number(row.mesNum) !== month) {
      return false;
    }

    if (semester) {
      const rowSemester = Number(row.mesNum) <= 6 ? 1 : 2;
      if (rowSemester !== semester) {
        return false;
      }
    }

    if (quarter) {
      const rowQuarter = Math.ceil(Number(row.mesNum || 0) / 3);
      if (rowQuarter !== quarter) {
        return false;
      }
    }

    if (category && row.categoria !== category) {
      return false;
    }

    if (status && row.estado !== status) {
      return false;
    }

    if (providerQuery && !String(row.proveedor || "").toLowerCase().includes(providerQuery)) {
      return false;
    }

    if (selectedPeriodSet.size) {
      if (!selectedPeriodSet.has(row.periodo)) {
        return false;
      }
    } else {
      if (periodStart && row.periodo < periodStart) {
        return false;
      }

      if (periodEnd && row.periodo > periodEnd) {
        return false;
      }
    }

    if (selectedDateSet.size) {
      if (!row.fechaIso || !selectedDateSet.has(row.fechaIso)) {
        return false;
      }
    } else if (dateStart || dateEnd) {
      if (!row.fechaIso) {
        return false;
      }
      if (dateStart && row.fechaIso < dateStart) {
        return false;
      }
      if (dateEnd && row.fechaIso > dateEnd) {
        return false;
      }
    }

    return true;
  });
}

function getPreviousYearPeriod(period) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return null;
  }

  const [year, month] = String(period).split("-");
  return `${Number(year) - 1}-${month}`;
}

function buildProviderTrendSeries(providerTotalsByPeriod) {
  if (!providerTotalsByPeriod || !providerTotalsByPeriod.size) {
    return [];
  }

  const allPeriods = [...providerTotalsByPeriod.keys()].sort();
  const result = [];

  allPeriods.forEach((period) => {
    const periodMap = providerTotalsByPeriod.get(period);
    if (!periodMap) return;

    periodMap.forEach((total, provider) => {
      const prevPeriod = allPeriods.find((p) => p < period);
      const prevTotal = prevPeriod ? providerTotalsByPeriod.get(prevPeriod)?.get(provider) : null;
      const variationPct = prevTotal && prevTotal !== 0 ? ((total - prevTotal) / prevTotal) * 100 : null;

      result.push({
        provider,
        period,
        total,
        variationPct,
      });
    });
  });

  return result;
}

function buildProviderComparison(providerTotalsByPeriod, currentPeriod, previousPeriod) {
  if (!currentPeriod) {
    return [];
  }

  const currentTotals = providerTotalsByPeriod.get(currentPeriod) || new Map();
  const previousTotals = previousPeriod ? providerTotalsByPeriod.get(previousPeriod) || new Map() : new Map();
  const providers = new Set([...currentTotals.keys(), ...previousTotals.keys()]);

  return [...providers]
    .map((provider) => {
      const currentTotal = currentTotals.get(provider) || 0;
      const previousTotal = previousTotals.get(provider) || 0;
      const delta = currentTotal - previousTotal;

      return {
        provider,
        currentTotal,
        previousTotal,
        variationPct: previousTotal !== 0 ? (delta / previousTotal) * 100 : null,
        direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
      };
    })
    .filter((row) => row.currentTotal !== 0 || row.previousTotal !== 0)
    .sort((a, b) => {
      if (b.currentTotal !== a.currentTotal) {
        return b.currentTotal - a.currentTotal;
      }
      if (b.previousTotal !== a.previousTotal) {
        return b.previousTotal - a.previousTotal;
      }
      return String(a.provider).localeCompare(String(b.provider));
    });
}

function buildPeriodContext(metrics, period) {
  if (!period) {
    return null;
  }

  const periodIndex = metrics.byPeriodSorted.findIndex((item) => item.period === period);
  if (periodIndex < 0) {
    return null;
  }

  const currentBucket = metrics.byPeriodSorted[periodIndex];
  const previousBucket = periodIndex > 0 ? metrics.byPeriodSorted[periodIndex - 1] : null;
  const previousYearPeriod = getPreviousYearPeriod(period);
  const previousYearBucket = previousYearPeriod ? metrics.byPeriodMap.get(previousYearPeriod) || null : null;
  const currentRows = metrics.rowsByPeriodMap.get(period) || [];
  const currentProviderTotals = metrics.providerTotalsByPeriod.get(period) || new Map();
  const previousProviderTotals = previousBucket
    ? metrics.providerTotalsByPeriod.get(previousBucket.period) || new Map()
    : new Map();

  const categories = Object.entries(currentBucket.byCategory || {})
    .map(([category, total]) => {
      const previousTotal = previousBucket?.byCategory?.[category] || 0;
      return {
        category,
        total,
        count: 0,
        pct: safePercent(total, currentBucket.total),
        prev: previousTotal,
        delta: total - previousTotal,
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4);

  const providers = [...currentProviderTotals.entries()]
    .map(([provider, total]) => {
      const previousTotal = previousProviderTotals.get(provider) || 0;
      return {
        provider,
        total,
        count: 0,
        pct: safePercent(total, currentBucket.total),
        prev: previousTotal,
        delta: total - previousTotal,
      };
    })
    .sort((a, b) => {
      const deltaGap = Math.abs(b.delta) - Math.abs(a.delta);
      if (deltaGap !== 0) {
        return deltaGap;
      }
      return b.total - a.total;
    })
    .slice(0, 5);

  return {
    period,
    previousPeriod: previousBucket?.period || null,
    previousYearPeriod,
    total: currentBucket.total,
    count: currentBucket.count,
    change: currentBucket.total - (previousBucket?.total || 0),
    pct: previousBucket?.total ? ((currentBucket.total - previousBucket.total) / previousBucket.total) * 100 : 0,
    yoyChange: currentBucket.total - (previousYearBucket?.total || 0),
    yoyPct:
      previousYearBucket?.total ? ((currentBucket.total - previousYearBucket.total) / previousYearBucket.total) * 100 : 0,
    categories,
    providers,
    invoices: [...currentRows].sort((a, b) => b.total - a.total).slice(0, 5),
    topCategory: categories[0] || null,
    topProvider: providers[0] || null,
  };
}

function buildDetailSummary(rows) {
  const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const approved = rows.reduce((sum, row) => sum + (getStatusKey(row.estado) === "Aprobado" ? 1 : 0), 0);

  return {
    total,
    count: rows.length,
    approvalRate: rows.length ? (approved / rows.length) * 100 : 0,
  };
}

function computeAllMetrics(data) {
  const periodMap = new Map();
  const rowsByPeriodMap = new Map();
  const categoryMap = new Map();
  const providerMap = new Map();
  const statusBucketMap = new Map([
    ["Rechazado", { status: "Rechazado", label: "Rechazado", count: 0, total: 0 }],
    ["En revision", { status: "En revision", label: "En revision", count: 0, total: 0 }],
    ["Aprobado", { status: "Aprobado", label: "Aprobado", count: 0, total: 0 }],
  ]);
  const statusTrendMap = new Map();
  const rejectionMap = new Map();
  const supplierMap = new Map();
  const yearMap = new Map();
  const providerTotalsByPeriod = new Map();
  const categoryProviderMap = new Map();
  const documentRowsByStatusMap = new Map([
    ["Rechazado", []],
    ["En revision", []],
    ["Aprobado", []],
  ]);
  const dailySpendByPeriodMap = new Map();
  const purchaseInvoiceRows = [];
  const creditNoteRows = [];

  let totalGasto = 0;
  let totalApproved = 0;
  let totalRejected = 0;
  let creditNoteTotalSum = 0;
  let creditNoteCountSum = 0;
  let purchaseTotalSum = 0;
  let purchaseCountSum = 0;
  let debitNoteTotalSum = 0;
  let debitNoteCountSum = 0;
  let missingOcCount = 0;

  for (const row of data) {
    const netValue = getNetValue(row);
    const docValue = getDocumentValue(row);
    const statusKey = getStatusKey(row.estado);
    const isCredit = isCreditNote(row);
    const isDebit = isDebitNote(row);
    const isPurchase = isPurchaseInvoice(row);

    totalGasto += netValue;
    if (statusKey === "Aprobado") totalApproved += 1;
    if (statusKey === "Rechazado") totalRejected += 1;
    if (!row.oc) missingOcCount += 1;

    if (!periodMap.has(row.periodo)) {
      periodMap.set(row.periodo, {
        period: row.periodo,
        total: 0,
        count: 0,
        byCategory: {},
        approved: 0,
        rejected: 0,
        purchaseInvoiceTotal: 0,
        purchaseInvoiceCount: 0,
        creditNoteTotal: 0,
        creditNoteCount: 0,
      });
    }
    if (!rowsByPeriodMap.has(row.periodo)) {
      rowsByPeriodMap.set(row.periodo, []);
    }

    const periodBucket = periodMap.get(row.periodo);
    periodBucket.total += netValue;
    periodBucket.count += 1;
    periodBucket.byCategory[row.categoria] = (periodBucket.byCategory[row.categoria] || 0) + netValue;
    if (statusKey === "Aprobado") periodBucket.approved += 1;
    if (statusKey === "Rechazado") periodBucket.rejected += 1;
    if (isCredit) {
      periodBucket.creditNoteTotal += docValue;
      periodBucket.creditNoteCount += 1;
    } else if (isPurchase) {
      periodBucket.purchaseInvoiceTotal += docValue;
      periodBucket.purchaseInvoiceCount += 1;
    }
    rowsByPeriodMap.get(row.periodo).push(row);

    const statusBucket = statusBucketMap.get(statusKey) || statusBucketMap.get("En revision");
    if (statusBucket) {
      statusBucket.count += 1;
      statusBucket.total += docValue;
    }
    documentRowsByStatusMap.get(statusKey)?.push(row);

    if (!statusTrendMap.has(row.periodo)) {
      statusTrendMap.set(row.periodo, {
        period: row.periodo,
        Rechazado: 0,
        "En revision": 0,
        Aprobado: 0,
        rejectedValue: 0,
        reviewValue: 0,
        approvedValue: 0,
      });
    }
    const trendBucket = statusTrendMap.get(row.periodo);
    trendBucket[statusKey] += 1;
    if (statusKey === "Rechazado") trendBucket.rejectedValue += docValue;
    if (statusKey === "En revision") trendBucket.reviewValue += docValue;
    if (statusKey === "Aprobado") trendBucket.approvedValue += docValue;

    if (!categoryMap.has(row.categoria)) {
      categoryMap.set(row.categoria, { category: row.categoria, total: 0, count: 0 });
    }
    categoryMap.get(row.categoria).total += netValue;
    categoryMap.get(row.categoria).count += 1;

    if (!providerMap.has(row.proveedor)) {
      providerMap.set(row.proveedor, { provider: row.proveedor, total: 0, count: 0 });
    }
    providerMap.get(row.proveedor).total += netValue;
    providerMap.get(row.proveedor).count += 1;

    if (!providerTotalsByPeriod.has(row.periodo)) {
      providerTotalsByPeriod.set(row.periodo, new Map());
    }
    const providerPeriodMap = providerTotalsByPeriod.get(row.periodo);
    providerPeriodMap.set(row.proveedor, (providerPeriodMap.get(row.proveedor) || 0) + netValue);

    if (!supplierMap.has(row.proveedor)) {
      supplierMap.set(row.proveedor, createSupplierBucket(row.proveedor));
    }
    accumulateSupplierBucket(supplierMap.get(row.proveedor), netValue, docValue, isCredit, isPurchase, statusKey);

    if (!categoryProviderMap.has(row.categoria)) {
      categoryProviderMap.set(row.categoria, new Map());
    }
    const categoryProviders = categoryProviderMap.get(row.categoria);
    if (!categoryProviders.has(row.proveedor)) {
      categoryProviders.set(row.proveedor, createSupplierBucket(row.proveedor));
    }
    accumulateSupplierBucket(categoryProviders.get(row.proveedor), netValue, docValue, isCredit, isPurchase, statusKey);

    if (statusKey === "Rechazado") {
      const reason = row.motivoRechazo || row.observacion || "Sin motivo registrado";
      const reasonKey = String(reason).trim() || "Sin motivo registrado";
      if (!rejectionMap.has(reasonKey)) {
        rejectionMap.set(reasonKey, { reason: reasonKey, count: 0, total: 0 });
      }
      const rejectionBucket = rejectionMap.get(reasonKey);
      rejectionBucket.count += 1;
      rejectionBucket.total += docValue;
    }

    if (row.fechaIso) {
      if (!dailySpendByPeriodMap.has(row.periodo)) {
        dailySpendByPeriodMap.set(row.periodo, new Map());
      }
      const periodDailyMap = dailySpendByPeriodMap.get(row.periodo);
      if (!periodDailyMap.has(row.fechaIso)) {
        periodDailyMap.set(row.fechaIso, { date: row.fechaIso, total: 0, count: 0 });
      }
      const dayBucket = periodDailyMap.get(row.fechaIso);
      dayBucket.total += netValue;
      dayBucket.count += 1;
    }

    const year = Number(row.anio);
    if (year) {
      if (!yearMap.has(year)) {
        yearMap.set(year, { total: 0, count: 0 });
      }
      const yearBucket = yearMap.get(year);
      yearBucket.total += netValue;
      yearBucket.count += 1;
    }

    if (isCredit) {
      creditNoteTotalSum += docValue;
      creditNoteCountSum += 1;
      creditNoteRows.push(row);
    } else if (isDebit) {
      debitNoteTotalSum += docValue;
      debitNoteCountSum += 1;
    } else {
      purchaseTotalSum += docValue;
      purchaseCountSum += 1;
      purchaseInvoiceRows.push(row);
    }
  }

  const totalDocs = data.length;
  const documentStatusBreakdown = ["Rechazado", "En revision", "Aprobado"].map((status) => {
    const bucket = statusBucketMap.get(status);
    return { ...bucket, pct: safePercent(bucket.count, totalDocs) };
  });

  const byPeriodSorted = [...periodMap.values()].sort((a, b) => sortPeriodsAsc(a.period, b.period));
  const byCategorySorted = [...categoryMap.values()]
    .map((item) => ({ ...item, pct: safePercent(item.total, totalGasto) }))
    .sort((a, b) => b.total - a.total);
  const topProvidersSorted = [...providerMap.values()]
    .map((item) => ({ ...item, pct: safePercent(item.total, totalGasto) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
  const statusTrendSorted = [...statusTrendMap.values()].sort((a, b) => sortPeriodsAsc(a.period, b.period));

  const totalIncidentValue = [...supplierMap.values()].reduce(
    (sum, item) => sum + (item.rejectedCount + item.reviewCount > 0 ? item.total : 0),
    0
  );
  const supplierIncidentRanking = [...supplierMap.values()]
    .filter((item) => item.rejectedCount + item.reviewCount > 0)
    .map((item) => ({
      ...item,
      pct: safePercent(item.total, totalIncidentValue || 1),
      avgTicket: item.purchaseInvoiceCount ? item.purchaseInvoiceTotal / item.purchaseInvoiceCount : 0,
      incidentCount: item.rejectedCount + item.reviewCount,
    }))
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .slice(0, 8);

  const supplierAccountingRanking = mapSupplierRanking(supplierMap, totalGasto, 10);
  const supplierRankingByCategory = Object.fromEntries(
    [...categoryProviderMap.entries()].map(([category, providers]) => {
      const categoryTotal = [...providers.values()].reduce((sum, item) => sum + item.total, 0);
      return [category, mapSupplierRanking(providers, categoryTotal || 1, 5)];
    })
  );

  const rejectionReasons = [...rejectionMap.values()]
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .slice(0, 8);

  const sortedYears = [...yearMap.keys()].sort((a, b) => a - b);
  const latestYear = sortedYears[sortedYears.length - 1] || null;
  const yearAccumulated = latestYear
    ? { year: latestYear, ...yearMap.get(latestYear) }
    : { year: null, total: 0, count: 0 };

  const categoryTrendSeries = [...categoryMap.keys()].map((category) => ({
    category,
    data: byPeriodSorted.map((period) => ({
      period: period.period,
      total: period.byCategory[category] || 0,
    })),
  }));

  const documentRowsByStatus = Object.fromEntries(
    [...documentRowsByStatusMap.entries()].map(([status, rows]) => [status, [...rows].sort(compareDocumentRows)])
  );
  const sortedDailySpendByPeriodMap = new Map(
    [...dailySpendByPeriodMap.entries()].map(([period, rowsMap]) => [
      period,
      [...rowsMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    ])
  );
  const resumen = calcularResumen(data);

  return {
    byPeriodMap: periodMap,
    rowsByPeriodMap,
    byPeriodSorted,
    byCategorySorted,
    topProvidersSorted,
    statusTrendSorted,
    categoryTrendSeries,
    totalGasto,
    statusSummary: {
      approved: totalApproved,
      rejected: totalRejected,
      review: data.length - totalApproved - totalRejected,
      approvalRate: safePercent(totalApproved, data.length),
    },
    documentSummary: {
      purchaseInvoiceCount: resumen.cantidadFC,
      purchaseInvoiceTotal: resumen.totalBruto,
      creditNoteCount: resumen.cantidadNC,
      creditNoteTotal: resumen.totalNC,
      debitNoteCount: debitNoteCountSum,
      debitNoteTotal: debitNoteTotalSum,
      grossTotal: resumen.totalBruto,
      netTotal: resumen.totalNeto,
      documentCount: data.length,
      avgTicket: resumen.cantidadFC ? resumen.totalBruto / resumen.cantidadFC : 0,
      creditNoteShare: safePercent(resumen.totalNC, resumen.totalBruto),
      totalBruto: resumen.totalBruto,
      totalNC: resumen.totalNC,
      totalNeto: resumen.totalNeto,
      cantidadFC: resumen.cantidadFC,
      cantidadNC: resumen.cantidadNC,
      cantidadNeta: resumen.cantidadFC - resumen.cantidadNC,
    },
    documentStatusBreakdown,
    documentRowsByStatus,
    purchaseInvoiceRows: [...purchaseInvoiceRows].sort(compareDocumentRows),
    creditNoteRows: [...creditNoteRows].sort(compareDocumentRows),
    supplierAccountingRanking,
    supplierRankingByCategory,
    supplierIncidentRanking,
    rejectionReasons,
    yearAccumulated,
    dailySpendByPeriodMap: sortedDailySpendByPeriodMap,
    providerTotalsByPeriod,
    missingOcCount,
  };
}

export function computeFacturasDerivedState(filteredData, filters, focusPeriod = "ALL") {
  const metrics = computeAllMetrics(filteredData);
  const latestPeriod = metrics.byPeriodSorted[metrics.byPeriodSorted.length - 1] || null;
  const previousPeriod = metrics.byPeriodSorted[metrics.byPeriodSorted.length - 2] || null;
  const latestPct =
    latestPeriod && previousPeriod && previousPeriod.total > 0
      ? ((latestPeriod.total - previousPeriod.total) / previousPeriod.total) * 100
      : 0;
  const resolvedFocusPeriod =
    focusPeriod && focusPeriod !== "ALL" && metrics.rowsByPeriodMap.has(focusPeriod) ? focusPeriod : "ALL";
  const analysisData =
    resolvedFocusPeriod !== "ALL" ? metrics.rowsByPeriodMap.get(resolvedFocusPeriod) || [] : filteredData;
  const activePeriod = resolvedFocusPeriod !== "ALL" ? metrics.byPeriodMap.get(resolvedFocusPeriod) || latestPeriod : latestPeriod;
  const activeIndex = activePeriod ? metrics.byPeriodSorted.findIndex((item) => item.period === activePeriod.period) : -1;
  const activePrevious = activeIndex > 0 ? metrics.byPeriodSorted[activeIndex - 1] : null;
  const activePct =
    activePeriod && activePrevious && activePrevious.total > 0
      ? ((activePeriod.total - activePrevious.total) / activePrevious.total) * 100
      : 0;

  const momChanges = metrics.byPeriodSorted.map((period, index) => {
    const previous = metrics.byPeriodSorted[index - 1];
    const prevTotal = previous?.total ?? 0;
    const change = index === 0 ? 0 : period.total - prevTotal;
    const pct = index === 0 || prevTotal === 0 ? 0 : (change / prevTotal) * 100;
    let driver = "-";

    if (previous) {
      const categories = new Set([...Object.keys(period.byCategory), ...Object.keys(previous.byCategory)]);
      let maxCategory = { name: "-", delta: 0 };
      categories.forEach((category) => {
        const currentTotal = period.byCategory[category] || 0;
        const previousTotalCategory = previous.byCategory[category] || 0;
        const delta = Math.abs(currentTotal - previousTotalCategory);
        if (delta > maxCategory.delta) {
          maxCategory = { name: category, delta };
        }
      });
      driver = maxCategory.name;
    }

    return {
      period: period.period,
      total: period.total,
      prev: prevTotal,
      change,
      pct,
      tone: getTrendTone(pct),
      driver,
    };
  });

  const activeDriver = momChanges.find((row) => row.period === activePeriod?.period)?.driver || "-";
  const activeMonthDailySpend = activePeriod?.period ? metrics.dailySpendByPeriodMap.get(activePeriod.period) || [] : [];
  const topExpenseDay = [...activeMonthDailySpend].sort((a, b) => b.total - a.total || b.count - a.count)[0] || null;
  const activeYearPrefix = metrics.yearAccumulated.year ? `${metrics.yearAccumulated.year}-` : null;
  const monthlyTotals = metrics.byPeriodSorted
    .filter((period) => !activeYearPrefix || String(period.period).startsWith(activeYearPrefix))
    .map((period) => ({
      ...period,
      label: period.period,
    }));
  const storyPeriod = activePeriod?.period || latestPeriod?.period || null;

  return {
    filteredData,
    analysisData,
    focusPeriod: resolvedFocusPeriod,
    detailSummary: buildDetailSummary(analysisData),
    totalGasto: metrics.totalGasto,
    countFacturas: filteredData.length,
    periods: metrics.byPeriodSorted.map((period) => period.period),
    byPeriod: metrics.byPeriodSorted,
    byCategory: metrics.byCategorySorted,
    byProvider: metrics.topProvidersSorted,
    topProviders: metrics.topProvidersSorted,
    momChanges,
    topInsights: buildInsightsFromMetrics(metrics, filteredData.length),
    approvalRate: metrics.statusSummary.approvalRate,
    rejectedCount: metrics.statusSummary.rejected,
    latestPeriod,
    latestPct,
    averageMonthly: metrics.byPeriodSorted.length ? metrics.totalGasto / metrics.byPeriodSorted.length : 0,
    categoryTrendSeries: metrics.categoryTrendSeries,
    stackedSeries: metrics.byPeriodSorted.map((period) => ({
      period: period.period,
      ...period.byCategory,
    })),
    providerTrendSeries: buildProviderTrendSeries(metrics.providerTotalsByPeriod),
    providerComparisonRows: buildProviderComparison(
      metrics.providerTotalsByPeriod,
      activePeriod?.period || null,
      activePrevious?.period || null
    ),
    activePeriod,
    activePrevious,
    activePct,
    activeDriver,
    periodContext: buildPeriodContext(metrics, storyPeriod),
    documentSummary: metrics.documentSummary,
    documentStatus: metrics.documentStatusBreakdown,
    documentRowsByStatus: metrics.documentRowsByStatus,
    purchaseInvoiceRows: metrics.purchaseInvoiceRows,
    creditNoteRows: metrics.creditNoteRows,
    statusTrend: metrics.statusTrendSorted,
    supplierAccountingRanking: metrics.supplierAccountingRanking,
    supplierRankingByCategory: metrics.supplierRankingByCategory,
    supplierIncidentRanking: metrics.supplierIncidentRanking,
    rejectionReasons: metrics.rejectionReasons,
    yearAccumulated: metrics.yearAccumulated,
    activeMonthDailySpend,
    topExpenseDay,
    monthlyTotals,
  };
}
