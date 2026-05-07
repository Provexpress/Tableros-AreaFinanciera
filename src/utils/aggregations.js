import { formatPct, getTrendTone } from "./formatters.js";

function sumTotal(rows) {
  return rows.reduce((acc, row) => acc + row.total, 0);
}

function sortPeriodsAsc(a, b) {
  return a.localeCompare(b);
}

function safePercent(part, total) {
  if (!total) {
    return 0;
  }
  return (part / total) * 100;
}

export function isCreditNote(row) {
  return Number(row.signoDocumento || 1) < 0 || String(row.tipoDocNormalizado || row.tipoDoc || "").toLowerCase().includes("nota de crédito");
}

function isDebitNote(row) {
  return String(row.tipoDocNormalizado || row.tipoDoc || "").toLowerCase().includes("nota de débito");
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

function applyPeriodRange(data, periodRange) {
  const [start, end] = periodRange || [null, null];
  return data.filter((row) => {
    if (start && row.periodo < start) {
      return false;
    }
    if (end && row.periodo > end) {
      return false;
    }
    return true;
  });
}

function applyDateRange(data, dateRange) {
  const [start, end] = dateRange || [null, null];

  if (!start && !end) {
    return data;
  }

  return data.filter((row) => {
    if (!row.fechaIso) {
      return false;
    }
    if (start && row.fechaIso < start) {
      return false;
    }
    if (end && row.fechaIso > end) {
      return false;
    }
    return true;
  });
}

export function applyFilters(data, filters) {
  const year = filters.year && filters.year !== "ALL" ? String(filters.year) : null;
  const category = filters.category && filters.category !== "ALL" ? filters.category : null;
  const status = filters.status && filters.status !== "ALL" ? filters.status : null;
  const providerQuery = filters.provider ? filters.provider.toLowerCase().trim() : "";
  const [periodStart, periodEnd] = filters.periodRange || [null, null];
  const [dateStart, dateEnd] = filters.dateRange || [null, null];

  return data.filter((row) => {
    if (year && String(row.anio) !== year) {
      return false;
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

    if (periodStart && row.periodo < periodStart) {
      return false;
    }

    if (periodEnd && row.periodo > periodEnd) {
      return false;
    }

    if (dateStart || dateEnd) {
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

export function getByPeriod(data) {
  const map = new Map();

  data.forEach((row) => {
    if (!map.has(row.periodo)) {
      map.set(row.periodo, {
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

    const bucket = map.get(row.periodo);
    bucket.total += getNetValue(row);
    bucket.count += 1;
    bucket.byCategory[row.categoria] = (bucket.byCategory[row.categoria] || 0) + getNetValue(row);
    if (row.estado === "Aprobado") bucket.approved += 1;
    if (row.estado === "Rechazado") bucket.rejected += 1;
    if (isCreditNote(row)) {
      bucket.creditNoteTotal += getDocumentValue(row);
      bucket.creditNoteCount += 1;
    } else if (isPurchaseInvoice(row)) {
      bucket.purchaseInvoiceTotal += getDocumentValue(row);
      bucket.purchaseInvoiceCount += 1;
    }
  });

  return [...map.values()].sort((a, b) => sortPeriodsAsc(a.period, b.period));
}

export function getByCategory(data) {
  const total = sumTotal(data);
  const map = new Map();

  data.forEach((row) => {
    if (!map.has(row.categoria)) {
      map.set(row.categoria, { category: row.categoria, total: 0, count: 0 });
    }
    const bucket = map.get(row.categoria);
    bucket.total += row.total;
    bucket.count += 1;
  });

  return [...map.values()]
    .map((item) => ({
      ...item,
      pct: safePercent(item.total, total),
    }))
    .sort((a, b) => b.total - a.total);
}

export function getTopProviders(data, limit = 10) {
  const total = sumTotal(data);
  const map = new Map();

  data.forEach((row) => {
    if (!map.has(row.proveedor)) {
      map.set(row.proveedor, { provider: row.proveedor, total: 0, count: 0 });
    }
    const bucket = map.get(row.proveedor);
    bucket.total += row.total;
    bucket.count += 1;
  });

  return [...map.values()]
    .map((item) => ({
      ...item,
      pct: safePercent(item.total, total),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function getByProvider(data, category = "ALL", limit = 10) {
  const scoped = category === "ALL" ? data : data.filter((row) => row.categoria === category);
  return getTopProviders(scoped, limit);
}

export function getDocumentSummary(data) {
  const creditRows = data.filter(isCreditNote);
  const debitRows = data.filter(isDebitNote);
  const purchaseRows = data.filter(isPurchaseInvoice);
  const purchaseTotal = purchaseRows.reduce((sum, row) => sum + getDocumentValue(row), 0);
  const creditNoteTotal = creditRows.reduce((sum, row) => sum + getDocumentValue(row), 0);
  const netTotal = purchaseTotal - creditNoteTotal;
  const documentCount = data.length;

  return {
    purchaseInvoiceCount: purchaseRows.length,
    purchaseInvoiceTotal: purchaseTotal,
    creditNoteCount: creditRows.length,
    creditNoteTotal,
    debitNoteCount: debitRows.length,
    debitNoteTotal: debitRows.reduce((sum, row) => sum + getDocumentValue(row), 0),
    grossTotal: purchaseTotal,
    netTotal,
    documentCount,
    avgTicket: purchaseRows.length ? purchaseTotal / purchaseRows.length : 0,
    creditNoteShare: safePercent(creditNoteTotal, purchaseTotal),
  };
}

export function getYearAccumulated(data, filters) {
  if (!data.length) {
    return { year: null, total: 0, count: 0 };
  }

  const years = [...new Set(data.map((row) => Number(row.anio)).filter(Boolean))].sort((a, b) => a - b);
  const targetYear =
    filters.year && filters.year !== "ALL" ? Number(filters.year) : years[years.length - 1] || null;

  const scoped = data.filter((row) => Number(row.anio) === Number(targetYear));
  return {
    year: targetYear,
    total: scoped.reduce((sum, row) => sum + Number(row.total || 0), 0),
    count: scoped.length,
  };
}

export function getMonthlyTotals(data, year) {
  const scoped = year ? data.filter((row) => Number(row.anio) === Number(year)) : data;
  return getByPeriod(scoped).map((period) => ({
    ...period,
    label: period.period,
  }));
}

export function getDailySpend(data) {
  const map = new Map();

  data.forEach((row) => {
    if (!row.fechaIso) {
      return;
    }

    if (!map.has(row.fechaIso)) {
      map.set(row.fechaIso, {
        date: row.fechaIso,
        total: 0,
        count: 0,
      });
    }

    const bucket = map.get(row.fechaIso);
    bucket.total += Number(row.total || 0);
    bucket.count += 1;
  });

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function getStatusSummary(data) {
  const total = data.length;
  const approved = data.filter((row) => getStatusKey(row.estado) === "Aprobado").length;
  const rejected = data.filter((row) => getStatusKey(row.estado) === "Rechazado").length;
  const review = data.filter((row) => getStatusKey(row.estado) === "En revision").length;

  return {
    approved,
    rejected,
    review,
    approvalRate: safePercent(approved, total),
  };
}

export function getDocumentStatusBreakdown(data) {
  const order = ["Rechazado", "En revision", "Aprobado"];
  const map = new Map(order.map((status) => [status, { status, label: status, count: 0, total: 0, pct: 0 }]));
  const totalDocs = data.length;

  data.forEach((row) => {
    const key = getStatusKey(row.estado);
    const bucket = map.get(key) || map.get("En revision");
    bucket.count += 1;
    bucket.total += getDocumentValue(row);
  });

  return order.map((status) => {
    const bucket = map.get(status);
    return {
      ...bucket,
      pct: safePercent(bucket.count, totalDocs),
    };
  });
}

export function getStatusTrend(data) {
  const map = new Map();

  data.forEach((row) => {
    if (!map.has(row.periodo)) {
      map.set(row.periodo, {
        period: row.periodo,
        Rechazado: 0,
        "En revision": 0,
        Aprobado: 0,
        rejectedValue: 0,
        reviewValue: 0,
        approvedValue: 0,
      });
    }

    const bucket = map.get(row.periodo);
    const key = getStatusKey(row.estado);
    bucket[key] += 1;
    if (key === "Rechazado") bucket.rejectedValue += getDocumentValue(row);
    if (key === "En revision") bucket.reviewValue += getDocumentValue(row);
    if (key === "Aprobado") bucket.approvedValue += getDocumentValue(row);
  });

  return [...map.values()].sort((a, b) => sortPeriodsAsc(a.period, b.period));
}

export function getSupplierAccountingRanking(data, limit = 10) {
  const total = data.reduce((sum, row) => sum + Math.max(getNetValue(row), 0), 0);
  const map = new Map();

  data.forEach((row) => {
    if (!map.has(row.proveedor)) {
      map.set(row.proveedor, {
        provider: row.proveedor,
        total: 0,
        count: 0,
        purchaseInvoiceTotal: 0,
        purchaseInvoiceCount: 0,
        creditNoteTotal: 0,
        creditNoteCount: 0,
        rejectedCount: 0,
        reviewCount: 0,
      });
    }

    const bucket = map.get(row.proveedor);
    bucket.total += getNetValue(row);
    bucket.count += 1;
    if (isCreditNote(row)) {
      bucket.creditNoteCount += 1;
      bucket.creditNoteTotal += getDocumentValue(row);
    }
    if (isPurchaseInvoice(row)) {
      bucket.purchaseInvoiceCount += 1;
      bucket.purchaseInvoiceTotal += getDocumentValue(row);
    }
    if (getStatusKey(row.estado) === "Rechazado") bucket.rejectedCount += 1;
    if (getStatusKey(row.estado) === "En revision") bucket.reviewCount += 1;
  });

  return [...map.values()]
    .map((item) => ({
      ...item,
      pct: safePercent(item.total, total),
      avgTicket: item.purchaseInvoiceCount ? item.purchaseInvoiceTotal / item.purchaseInvoiceCount : 0,
      incidentCount: item.rejectedCount + item.reviewCount,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function getSupplierIncidentRanking(data, limit = 8) {
  const incidentRows = data.filter((row) => {
    const status = getStatusKey(row.estado);
    return status === "Rechazado" || status === "En revision";
  });
  const totalIncidentValue = incidentRows.reduce((sum, row) => sum + getDocumentValue(row), 0);
  const map = new Map();

  incidentRows.forEach((row) => {
    if (!map.has(row.proveedor)) {
      map.set(row.proveedor, {
        provider: row.proveedor,
        count: 0,
        rejectedCount: 0,
        reviewCount: 0,
        total: 0,
      });
    }

    const bucket = map.get(row.proveedor);
    const status = getStatusKey(row.estado);
    bucket.count += 1;
    bucket.total += getDocumentValue(row);
    if (status === "Rechazado") bucket.rejectedCount += 1;
    if (status === "En revision") bucket.reviewCount += 1;
  });

  return [...map.values()]
    .map((item) => ({
      ...item,
      pct: safePercent(item.total, totalIncidentValue),
    }))
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .slice(0, limit);
}

export function getRejectionReasons(data, limit = 8) {
  const map = new Map();

  data
    .filter((row) => getStatusKey(row.estado) === "Rechazado")
    .forEach((row) => {
      const reason = row.motivoRechazo || row.observacion || "Sin motivo registrado";
      const key = String(reason).trim() || "Sin motivo registrado";

      if (!map.has(key)) {
        map.set(key, { reason: key, count: 0, total: 0 });
      }

      const bucket = map.get(key);
      bucket.count += 1;
      bucket.total += getDocumentValue(row);
    });

  return [...map.values()].sort((a, b) => b.count - a.count || b.total - a.total).slice(0, limit);
}

export function getCategoryTrendSeries(data) {
  const byPeriod = getByPeriod(data);
  const categories = [...new Set(data.map((row) => row.categoria))];

  return categories.map((category) => ({
    category,
    data: byPeriod.map((period) => ({
      period: period.period,
      total: period.byCategory[category] || 0,
    })),
  }));
}

export function getStackedSeries(data) {
  return getByPeriod(data).map((period) => ({
    period: period.period,
    ...period.byCategory,
  }));
}

export function getMoMChanges(data) {
  const byPeriod = getByPeriod(data);

  return byPeriod.map((period, index) => {
    const previous = byPeriod[index - 1];
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
}

export function getPreviousYearPeriod(period) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return null;
  }

  const [year, month] = String(period).split("-");
  return `${Number(year) - 1}-${month}`;
}

export function getPeriodContext(data, period) {
  if (!period) {
    return null;
  }

  const byPeriod = getByPeriod(data);
  const periodIndex = byPeriod.findIndex((item) => item.period === period);
  if (periodIndex < 0) {
    return null;
  }

  const currentBucket = byPeriod[periodIndex];
  const previousBucket = periodIndex > 0 ? byPeriod[periodIndex - 1] : null;
  const previousYearPeriod = getPreviousYearPeriod(period);
  const previousYearBucket = previousYearPeriod ? byPeriod.find((item) => item.period === previousYearPeriod) || null : null;
  const currentRows = data.filter((row) => row.periodo === period);
  const previousRows = previousBucket ? data.filter((row) => row.periodo === previousBucket.period) : [];

  const previousCategoryMap = new Map(getByCategory(previousRows).map((item) => [item.category, item.total]));
  const categoryDrivers = getByCategory(currentRows)
    .map((item) => {
      const previousTotal = previousCategoryMap.get(item.category) || 0;
      return {
        ...item,
        prev: previousTotal,
        delta: item.total - previousTotal,
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4);

  const previousProviderMap = new Map();
  previousRows.forEach((row) => {
    previousProviderMap.set(row.proveedor, (previousProviderMap.get(row.proveedor) || 0) + row.total);
  });

  const providerDrivers = getTopProviders(currentRows, 8)
    .map((item) => {
      const previousTotal = previousProviderMap.get(item.provider) || 0;
      return {
        ...item,
        prev: previousTotal,
        delta: item.total - previousTotal,
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5);

  const topInvoices = [...currentRows]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const previousTotal = previousBucket?.total || 0;
  const change = currentBucket.total - previousTotal;
  const pct = previousTotal > 0 ? (change / previousTotal) * 100 : 0;
  const previousYearTotal = previousYearBucket?.total || 0;
  const yoyChange = currentBucket.total - previousYearTotal;
  const yoyPct = previousYearTotal > 0 ? (yoyChange / previousYearTotal) * 100 : 0;

  return {
    period,
    previousPeriod: previousBucket?.period || null,
    previousYearPeriod,
    total: currentBucket.total,
    count: currentBucket.count,
    change,
    pct,
    yoyChange,
    yoyPct,
    categories: categoryDrivers,
    providers: providerDrivers,
    invoices: topInvoices,
    topCategory: categoryDrivers[0] || null,
    topProvider: providerDrivers[0] || null,
  };
}

export function getInsights(data) {
  const byCategory = getByCategory(data);
  const byPeriod = getByPeriod(data);
  const withoutOc = data.filter((row) => !row.oc).length;
  const ocPct = safePercent(withoutOc, data.length);
  const topCategory = byCategory[0];
  const lastThree = byPeriod.slice(-3);
  const firstLastThree = lastThree[0]?.total || 0;
  const lastLastThree = lastThree[lastThree.length - 1]?.total || 0;
  const trendPct = firstLastThree ? ((lastLastThree - firstLastThree) / firstLastThree) * 100 : 0;

  return [
    topCategory
      ? `La categoría ${topCategory.category} representa ${formatPct(topCategory.pct, { signed: false })} del gasto total visible.`
      : "No hay concentración visible por categoría.",
    `${formatPct(ocPct, { signed: false })} de las facturas no tiene Orden de Compra registrada.`,
    trendPct >= 0
      ? `La tendencia de los últimos 3 meses muestra una mejora de ${formatPct(trendPct)}.`
      : `La tendencia de los últimos 3 meses muestra una caída de ${formatPct(trendPct)}.`,
  ];
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
      ? `La categoría ${topCategory.category} representa ${formatPct(topCategory.pct, { signed: false })} del gasto total visible.`
      : "No hay concentración visible por categoría.",
    `${formatPct(ocPct, { signed: false })} de las facturas no tiene Orden de Compra registrada.`,
    trendPct >= 0
      ? `La tendencia de los últimos 3 meses muestra una mejora de ${formatPct(trendPct)}.`
      : `La tendencia de los últimos 3 meses muestra una caída de ${formatPct(trendPct)}.`,
  ];
}

export function getTopProviderTrendSeries(data, category = "Tecnología", limit = 5) {
  const scoped = data.filter((row) => row.categoria === category);
  const topProviders = getTopProviders(scoped, limit).map((item) => item.provider);
  const byPeriod = getByPeriod(scoped);

  const topProviderSet = new Set(topProviders);
  const providerPeriodTotals = new Map();

  scoped.forEach((row) => {
    if (!topProviderSet.has(row.proveedor)) {
      return;
    }

    if (!providerPeriodTotals.has(row.proveedor)) {
      providerPeriodTotals.set(row.proveedor, new Map());
    }

    const periodTotals = providerPeriodTotals.get(row.proveedor);
    periodTotals.set(row.periodo, (periodTotals.get(row.periodo) || 0) + row.total);
  });

  return topProviders.map((provider) => {
    const periodTotals = providerPeriodTotals.get(provider) || new Map();

    return {
      provider,
      data: byPeriod.map((period) => ({
        period: period.period,
        total: periodTotals.get(period.period) || 0,
      })),
    };
  });
}

function compareDocumentRows(a, b) {
  const amountDelta = getDocumentValue(b) - getDocumentValue(a);
  if (amountDelta !== 0) {
    return amountDelta;
  }

  return String(b.fechaIso || "").localeCompare(String(a.fechaIso || ""));
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

function buildPeriodContextFromMetrics(metrics, period) {
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

  const topInvoices = [...currentRows].sort((a, b) => b.total - a.total).slice(0, 5);
  const previousTotal = previousBucket?.total || 0;
  const change = currentBucket.total - previousTotal;
  const pct = previousTotal > 0 ? (change / previousTotal) * 100 : 0;
  const previousYearTotal = previousYearBucket?.total || 0;
  const yoyChange = currentBucket.total - previousYearTotal;
  const yoyPct = previousYearTotal > 0 ? (yoyChange / previousYearTotal) * 100 : 0;

  return {
    period,
    previousPeriod: previousBucket?.period || null,
    previousYearPeriod,
    total: currentBucket.total,
    count: currentBucket.count,
    change,
    pct,
    yoyChange,
    yoyPct,
    categories,
    providers,
    invoices: topInvoices,
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

export function buildDerivedState(filteredData, filters, focusPeriod = "ALL") {
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
    return { period: period.period, total: period.total, prev: prevTotal, change, pct, tone: getTrendTone(pct), driver };
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
  const periodContext = buildPeriodContextFromMetrics(metrics, storyPeriod);

  const totalGasto = metrics.totalGasto;
  const byCategory = metrics.byCategorySorted;
  const byProvider = metrics.topProvidersSorted;
  const status = metrics.statusSummary;
  const documentSummary = metrics.documentSummary;
  const documentStatus = metrics.documentStatusBreakdown;
  const statusTrend = metrics.statusTrendSorted;
  const supplierAccountingRanking = metrics.supplierAccountingRanking;
  const supplierIncidentRanking = metrics.supplierIncidentRanking;
  const rejectionReasons = metrics.rejectionReasons;

  return {
    filteredData,
    analysisData,
    focusPeriod: resolvedFocusPeriod,
    detailSummary: buildDetailSummary(analysisData),
    totalGasto,
    countFacturas: filteredData.length,
    periods: metrics.byPeriodSorted.map((period) => period.period),
    byPeriod: metrics.byPeriodSorted,
    byCategory,
    byProvider,
    topProviders: byProvider,
    momChanges,
    topInsights: buildInsightsFromMetrics(metrics, filteredData.length),
    approvalRate: status.approvalRate,
    rejectedCount: status.rejected,
    latestPeriod,
    latestPct,
    averageMonthly: metrics.byPeriodSorted.length ? totalGasto / metrics.byPeriodSorted.length : 0,
    categoryTrendSeries: metrics.categoryTrendSeries,
    stackedSeries: metrics.byPeriodSorted.map((period) => ({
      period: period.period,
      ...period.byCategory,
    })),
    providerTrendSeries: getTopProviderTrendSeries(
      filteredData,
      filters.category && filters.category !== "ALL" ? filters.category : "Tecnología"
    ),
    providerComparisonRows: buildProviderComparison(
      metrics.providerTotalsByPeriod,
      activePeriod?.period || null,
      activePrevious?.period || null
    ),
    activePeriod,
    activePrevious,
    activePct,
    activeDriver,
    periodContext,
    documentSummary,
    documentStatus,
    documentRowsByStatus: metrics.documentRowsByStatus,
    purchaseInvoiceRows: metrics.purchaseInvoiceRows,
    creditNoteRows: metrics.creditNoteRows,
    statusTrend,
    supplierAccountingRanking,
    supplierRankingByCategory: metrics.supplierRankingByCategory,
    supplierIncidentRanking,
    rejectionReasons,
    yearAccumulated: metrics.yearAccumulated,
    activeMonthDailySpend,
    topExpenseDay,
    monthlyTotals,
  };
}

/**
 * Single-pass aggregation — computes core metrics in ONE forEach loop.
 * Returns intermediate maps and sorted arrays to avoid redundant iterations.
 */
function computeAllMetrics(data) {
  const periodMap = new Map();
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
  const dailySpendMap = new Map();
  const yearMap = new Map();

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
    if (statusKey === "Aprobado") totalApproved++;
    if (statusKey === "Rechazado") totalRejected++;
    if (!row.oc) missingOcCount++;

    // Period bucket
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
    const periodBucket = periodMap.get(row.periodo);
    periodBucket.total += netValue;
    periodBucket.count++;
    periodBucket.byCategory[row.categoria] = (periodBucket.byCategory[row.categoria] || 0) + netValue;
    if (statusKey === "Aprobado") periodBucket.approved++;
    if (statusKey === "Rechazado") periodBucket.rejected++;
    if (isCredit) {
      periodBucket.creditNoteTotal += docValue;
      periodBucket.creditNoteCount++;
    } else if (isPurchase) {
      periodBucket.purchaseInvoiceTotal += docValue;
      periodBucket.purchaseInvoiceCount++;
    }

    // Status bucket (global)
    const statusBucket = statusBucketMap.get(statusKey) || statusBucketMap.get("En revision");
    if (statusBucket) {
      statusBucket.count++;
      statusBucket.total += docValue;
    }

    // Status trend by period
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
    trendBucket[statusKey]++;
    if (statusKey === "Rechazado") trendBucket.rejectedValue += docValue;
    if (statusKey === "En revision") trendBucket.reviewValue += docValue;
    if (statusKey === "Aprobado") trendBucket.approvedValue += docValue;

    // Category
    if (!categoryMap.has(row.categoria)) {
      categoryMap.set(row.categoria, { category: row.categoria, total: 0, count: 0 });
    }
    categoryMap.get(row.categoria).total += netValue;
    categoryMap.get(row.categoria).count++;

    // Provider
    if (!providerMap.has(row.proveedor)) {
      providerMap.set(row.proveedor, { provider: row.proveedor, total: 0, count: 0 });
    }
    providerMap.get(row.proveedor).total += netValue;
    providerMap.get(row.proveedor).count++;

    // Supplier incident tracking
    const supplierStatusKey = statusKey;
    if (!supplierMap.has(row.proveedor)) {
      supplierMap.set(row.proveedor, {
        provider: row.proveedor,
        total: 0,
        count: 0,
        purchaseInvoiceTotal: 0,
        purchaseInvoiceCount: 0,
        creditNoteTotal: 0,
        creditNoteCount: 0,
        rejectedCount: 0,
        reviewCount: 0,
      });
    }
    const supplierBucket = supplierMap.get(row.proveedor);
    supplierBucket.total += netValue;
    supplierBucket.count++;
    if (isCredit) {
      supplierBucket.creditNoteCount++;
      supplierBucket.creditNoteTotal += docValue;
    }
    if (isPurchase) {
      supplierBucket.purchaseInvoiceCount++;
      supplierBucket.purchaseInvoiceTotal += docValue;
    }
    if (supplierStatusKey === "Rechazado") supplierBucket.rejectedCount++;
    if (supplierStatusKey === "En revision") supplierBucket.reviewCount++;

    // Rejection reasons
    if (statusKey === "Rechazado") {
      const reason = row.motivoRechazo || row.observacion || "Sin motivo registrado";
      const reasonKey = String(reason).trim() || "Sin motivo registrado";
      if (!rejectionMap.has(reasonKey)) {
        rejectionMap.set(reasonKey, { reason: reasonKey, count: 0, total: 0 });
      }
      const rejBucket = rejectionMap.get(reasonKey);
      rejBucket.count++;
      rejBucket.total += docValue;
    }

    // Daily spend (active period — for now compute for all, filter later)
    if (row.fechaIso) {
      if (!dailySpendMap.has(row.fechaIso)) {
        dailySpendMap.set(row.fechaIso, { date: row.fechaIso, total: 0, count: 0 });
      }
      const dayBucket = dailySpendMap.get(row.fechaIso);
      dayBucket.total += netValue;
      dayBucket.count++;
    }

    // Year tracking
    const yr = Number(row.anio);
    if (yr) {
      if (!yearMap.has(yr)) yearMap.set(yr, { total: 0, count: 0 });
      const yearBucket = yearMap.get(yr);
      yearBucket.total += netValue;
      yearBucket.count++;
    }

    // Document summary totals
    if (isCredit) {
      creditNoteTotalSum += docValue;
      creditNoteCountSum++;
    } else if (isDebit) {
      debitNoteTotalSum += docValue;
      debitNoteCountSum++;
    } else {
      purchaseTotalSum += docValue;
      purchaseCountSum++;
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
  const netTotal = purchaseTotalSum - creditNoteTotalSum;

  const statusSummary = {
    approved: totalApproved,
    rejected: totalRejected,
    review: data.length - totalApproved - totalRejected,
    approvalRate: safePercent(totalApproved, data.length),
  };

  const documentSummary = {
    purchaseInvoiceCount: purchaseCountSum,
    purchaseInvoiceTotal: purchaseTotalSum,
    creditNoteCount: creditNoteCountSum,
    creditNoteTotal: creditNoteTotalSum,
    debitNoteCount: debitNoteCountSum,
    debitNoteTotal: debitNoteTotalSum,
    grossTotal: purchaseTotalSum,
    netTotal,
    documentCount: data.length,
    avgTicket: purchaseCountSum ? purchaseTotalSum / purchaseCountSum : 0,
    creditNoteShare: safePercent(creditNoteTotalSum, purchaseTotalSum),
  };

  const totalIncidentValue = [...supplierMap.values()].reduce(
    (sum, s) => sum + (s.rejectedCount + s.reviewCount > 0 ? s.total : 0),
    0
  );
  const supplierIncidentRanking = [...supplierMap.values()]
    .filter((s) => s.rejectedCount + s.reviewCount > 0)
    .map((item) => ({
      ...item,
      pct: safePercent(item.total, totalIncidentValue || 1),
      avgTicket: item.purchaseInvoiceCount ? item.purchaseInvoiceTotal / item.purchaseInvoiceCount : 0,
      incidentCount: item.rejectedCount + item.reviewCount,
    }))
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .slice(0, 8);

  const supplierAccountingRanking = [...supplierMap.values()]
    .map((item) => ({
      ...item,
      pct: safePercent(item.total, totalGasto),
      avgTicket: item.purchaseInvoiceCount ? item.purchaseInvoiceTotal / item.purchaseInvoiceCount : 0,
      incidentCount: item.rejectedCount + item.reviewCount,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const rejectionReasons = [...rejectionMap.values()]
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .slice(0, 8);

  const sortedYears = [...yearMap.keys()].sort((a, b) => a - b);
  const latestYear = sortedYears[sortedYears.length - 1] || null;
  const yearAccumulated = latestYear ? { year: latestYear, ...yearMap.get(latestYear) } : { year: null, total: 0, count: 0 };

  const categoryTrendSeries = [...categoryMap.keys()].map((category) => ({
    category,
    data: byPeriodSorted.map((period) => ({
      period: period.period,
      total: period.byCategory[category] || 0,
    })),
  }));

  return {
    byPeriodMap: periodMap,
    byPeriodSorted,
    byCategorySorted,
    topProvidersSorted,
    statusTrendSorted,
    categoryTrendSeries,
    totalGasto,
    statusSummary,
    documentSummary,
    documentStatusBreakdown,
    supplierAccountingRanking,
    supplierIncidentRanking,
    rejectionReasons,
    yearAccumulated,
    dailySpendMap,
    missingOcCount,
  };
}
