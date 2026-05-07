import { useMemo } from "react";
import ConsolidatedSnapshotPanel from "@/components/cards/ConsolidatedSnapshotPanel";
import { useFacturasStore } from "@/store/useFacturasStore";
import { useNotasCreditoStore } from "@/store/useNotasCreditoStore";
import { useVentasStore } from "@/store/useVentasStore";
import { formatPeriod } from "@/utils/formatters";

const emptySummary = {
  purchaseInvoiceCount: 0,
  purchaseInvoiceTotal: 0,
  creditNoteCount: 0,
  creditNoteTotal: 0,
  netTotal: 0,
  documentCount: 0,
  creditNoteShare: 0,
};

function getPeriod(row) {
  const rawPeriod = String(row?.periodo || row?.monthKey || row?.monthRef || row?.fechaInicialIso || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(rawPeriod) ? rawPeriod.slice(0, 7) : rawPeriod;
}

function getYear(row) {
  return String(row?.anio || row?.year || getPeriod(row).slice(0, 4)).trim();
}

function getDate(row) {
  return String(row?.fechaIso || row?.fechaEmision || row?.fecha || "").slice(0, 10);
}

function matchesSelectedDates(row, selectedDateSet) {
  if (!selectedDateSet.size) return true;

  const start = String(row?.fechaInicialIso || "").slice(0, 10);
  const end = String(row?.fechaFinalIso || "").slice(0, 10);
  if (start && end) {
    return [...selectedDateSet].some((date) => date >= start && date <= end);
  }

  return selectedDateSet.has(getDate(row));
}

function getNumericValue(row) {
  return Number(row?.totalOriginal ?? row?.total ?? row?.valor ?? 0) || 0;
}

function isCreditNote(row) {
  const type = String(row?.tipoDocNormalizado || row?.tipoDoc || row?.tipoDocumento || "").toLowerCase();
  return Number(row?.signoDocumento || 1) < 0 || type.includes("nota de cr") || type.includes("nota credito");
}

function calculateResumen(rows = []) {
  if (!rows.length) {
    return { ...emptySummary };
  }

  return rows.reduce(
    (acc, row) => {
      const value = Math.abs(getNumericValue(row));
      acc.documentCount += 1;

      if (isCreditNote(row)) {
        acc.creditNoteCount += 1;
        acc.creditNoteTotal += value;
      } else {
        acc.purchaseInvoiceCount += 1;
        acc.purchaseInvoiceTotal += value;
      }

      acc.netTotal = acc.purchaseInvoiceTotal - acc.creditNoteTotal;
      acc.creditNoteShare = acc.purchaseInvoiceTotal ? (acc.creditNoteTotal / acc.purchaseInvoiceTotal) * 100 : 0;
      return acc;
    },
    { ...emptySummary }
  );
}

function normalizePurchaseStatus(row) {
  const text = String(row?.estado || row?.estadoFinal || row?.estado_final || "").toLowerCase();
  if (text.includes("rechaz") || text.includes("devuelt")) return "Rechazado";
  if (text.includes("aprob") || text.includes("ok") || text.includes("recib") || text.includes("radic")) return "Aprobado";
  return "En revision";
}

function normalizeSalesStatus(row) {
  const text = String(row?.estadoAcuse || row?.estado || row?.estadoDian || "").toLowerCase();
  if (row?.esRechazada || text.includes("rechaz") || text.includes("devuelt")) return "Rechazado";
  if (row?.esPagaSistema || row?.tieneAcuse || text.includes("paga") || text.includes("acus")) return "Aprobado";
  return "En revision";
}

function buildStatusRows(rows = [], resolver) {
  const buckets = {
    Aprobado: { status: "Aprobado", count: 0, total: 0 },
    "En revision": { status: "En revision", count: 0, total: 0 },
    Rechazado: { status: "Rechazado", count: 0, total: 0 },
  };

  rows.forEach((row) => {
    const status = resolver(row);
    const bucket = buckets[status] || buckets["En revision"];
    bucket.count += 1;
    bucket.total += Math.abs(getNumericValue(row));
  });

  return Object.values(buckets);
}

function buildPurchaseRanking(rows = []) {
  const totals = new Map();
  rows.forEach((row) => {
    const provider = row?.proveedor || row?.nombreEmisor || "Sin proveedor";
    if (!totals.has(provider)) {
      totals.set(provider, {
        provider,
        total: 0,
        count: 0,
        purchaseInvoiceCount: 0,
        creditNoteCount: 0,
      });
    }

    const bucket = totals.get(provider);
    bucket.total += Number(row?.total || 0) || 0;
    bucket.count += 1;
    if (isCreditNote(row)) {
      bucket.creditNoteCount += 1;
    } else {
      bucket.purchaseInvoiceCount += 1;
    }
  });

  return [...totals.values()].sort((a, b) => b.total - a.total || b.count - a.count);
}

function adaptSalesRows(rows = []) {
  return rows.map((row) => {
    const total = Math.abs(getNumericValue(row));
    const category = row.categoria || row.categoriaVenta || row.category || "Sin categoria";
    return {
      ...row,
      cliente: row.cliente || row.clienteNormalizado || row.nombreCliente || "Sin cliente",
      proveedor: row.cliente || row.clienteNormalizado || row.nombreCliente || "Sin cliente",
      categoria: category,
      total,
      totalOriginal: total,
      valor: total,
      fechaIso: row.fechaIso || row.fechaEmision,
      tipoDocNormalizado: row.tipoDocNormalizado || "Factura de venta",
      signoDocumento: Number(row.signoDocumento || 1),
    };
  });
}

function normalizeClientMatchKey(value) {
  return String(value || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b(SAS|SA|S A S|S A|LTDA|LTD|SUCURSAL|COLOMBIA|DE|DEL|LA|EL|LOS|LAS)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenScore(sourceTokens, targetTokens) {
  if (!sourceTokens.length || !targetTokens.length) return 0;
  const targetSet = new Set(targetTokens);
  const matches = sourceTokens.filter((token) => targetSet.has(token)).length;
  return matches / sourceTokens.length;
}

function buildClientResolver(rows = []) {
  const candidates = new Map();

  rows.forEach((row) => {
    const label = row.cliente || row.clienteNormalizado || row.nombreCliente || "Sin cliente";
    const key = normalizeClientMatchKey(label);
    if (!key || candidates.has(label)) return;

    candidates.set(label, {
      label,
      key,
      tokens: key.split(" ").filter(Boolean),
    });
  });

  const candidateRows = [...candidates.values()];
  const exact = new Map(candidateRows.map((row) => [row.key, row.label]));

  return (value) => {
    const rawLabel = value || "Sin cliente";
    const key = normalizeClientMatchKey(rawLabel);
    if (!key) return rawLabel;
    if (exact.has(key)) return exact.get(key);

    const direct = candidateRows.find((row) => row.key.includes(key) || key.includes(row.key));
    if (direct) return direct.label;

    const sourceTokens = key.split(" ").filter(Boolean);
    const scored = candidateRows
      .map((row) => ({ row, score: tokenScore(sourceTokens, row.tokens) }))
      .filter((item) => item.score >= 0.65)
      .sort((a, b) => b.score - a.score || b.row.key.length - a.row.key.length);

    return scored[0]?.row.label || rawLabel;
  };
}

function adaptSalesCreditRows(rows = [], resolveClient = (value) => value || "Sin cliente") {
  return rows.map((row) => {
    const value = Math.abs(Number(row.valor ?? row.total ?? 0) || 0);
    const client = resolveClient(row.cliente);
    const category = row.categoria || row.categoriaVenta || row.category || row.causa || row.concepto || "Notas credito";
    return {
      ...row,
      cliente: client,
      proveedor: client,
      categoria: category,
      total: -value,
      totalOriginal: value,
      valor: -value,
      periodo: getPeriod(row),
      fechaIso: row.fechaInicialIso || row.monthRef,
      numeroDocumento: row.nc || row.numeroDocumento || "-",
      tipoDocNormalizado: "Nota credito de venta",
      signoDocumento: -1,
    };
  });
}

export default function Comparativo() {
  const facturasRawData = useFacturasStore((state) => state.rawData);
  const facturasFilters = useFacturasStore((state) => state.filters);
  const ventasRawData = useVentasStore((state) => state.rawData);
  const notasRawNcRows = useNotasCreditoStore((state) => state.rawNcRows);
  const facturasLoading = useFacturasStore((state) => state.isLoading);
  const ventasLoading = useVentasStore((state) => state.isLoading);
  const notasLoading = useNotasCreditoStore((state) => state.isLoading);
  const isLoading = facturasLoading || ventasLoading || notasLoading;

  const purchase2026Rows = useMemo(
    () => facturasRawData.filter((row) => getYear(row) === "2026"),
    [facturasRawData]
  );
  const sales2026Rows = useMemo(
    () => ventasRawData.filter((row) => getYear(row) === "2026"),
    [ventasRawData]
  );
  const salesCredit2026Rows = useMemo(
    () => notasRawNcRows.filter((row) => getYear(row) === "2026"),
    [notasRawNcRows]
  );

  const commonPeriods = useMemo(() => {
    const purchasePeriods = new Set(purchase2026Rows.map(getPeriod).filter(Boolean));
    const salesPeriods = new Set(sales2026Rows.map(getPeriod).filter(Boolean));
    return [...salesPeriods].filter((period) => purchasePeriods.has(period)).sort();
  }, [purchase2026Rows, sales2026Rows]);

  const commonPeriodSet = useMemo(() => new Set(commonPeriods), [commonPeriods]);
  const selectedPeriodSet = useMemo(() => new Set(facturasFilters.selectedPeriods || []), [facturasFilters.selectedPeriods]);
  const selectedDateSet = useMemo(() => new Set(facturasFilters.selectedDates || []), [facturasFilters.selectedDates]);

  const matchesCalendarFilters = (row) => {
    const period = getPeriod(row);
    if (!commonPeriodSet.has(period)) return false;

    if (selectedPeriodSet.size && !selectedPeriodSet.has(period)) return false;
    if (!selectedPeriodSet.size && facturasFilters.month !== "ALL") {
      const month = String(Number(period.slice(5, 7) || row?.mesNum || 0));
      if (month !== String(Number(facturasFilters.month))) return false;
    }

    if (!matchesSelectedDates(row, selectedDateSet)) return false;

    return true;
  };

  const purchaseRows = useMemo(
    () => purchase2026Rows.filter(matchesCalendarFilters),
    [purchase2026Rows, commonPeriodSet, selectedPeriodSet, selectedDateSet, facturasFilters.month]
  );

  const rawSalesRows = useMemo(
    () => sales2026Rows.filter(matchesCalendarFilters),
    [sales2026Rows, commonPeriodSet, selectedPeriodSet, selectedDateSet, facturasFilters.month]
  );
  const rawSalesCreditRows = useMemo(
    () => salesCredit2026Rows.filter(matchesCalendarFilters),
    [salesCredit2026Rows, commonPeriodSet, selectedPeriodSet, selectedDateSet, facturasFilters.month]
  );
  const resolveSalesClient = useMemo(() => buildClientResolver(rawSalesRows), [rawSalesRows]);

  const salesRows = useMemo(
    () => [...adaptSalesRows(rawSalesRows), ...adaptSalesCreditRows(rawSalesCreditRows, resolveSalesClient)],
    [rawSalesCreditRows, rawSalesRows, resolveSalesClient]
  );
  const comprasSummary = useMemo(() => calculateResumen(purchaseRows), [purchaseRows]);
  const ventasSummary = useMemo(() => calculateResumen(salesRows), [salesRows]);
  const purchaseStatus = useMemo(() => buildStatusRows(purchaseRows, normalizePurchaseStatus), [purchaseRows]);
  const salesStatus = useMemo(() => buildStatusRows(salesRows, normalizeSalesStatus), [salesRows]);
  const purchaseRanking = useMemo(() => buildPurchaseRanking(purchaseRows), [purchaseRows]);
  const hasData = purchaseRows.length > 0 && salesRows.length > 0;
  const visiblePeriods = useMemo(
    () => [...new Set([...purchaseRows, ...salesRows].map(getPeriod).filter(Boolean))].sort(),
    [purchaseRows, salesRows]
  );
  const rangeLabel = visiblePeriods.length
    ? `${formatPeriod(visiblePeriods[0])} - ${formatPeriod(visiblePeriods[visiblePeriods.length - 1])}`
    : "Sin rango comun";

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--txt)]">Lectura ejecutiva de compras y ventas</h2>
          <p className="text-sm text-[var(--txt2)]">
            Corte comun disponible: {rangeLabel}. El consolidado solo compara periodos presentes en compras y ventas.
          </p>
        </div>
        <ConsolidatedSnapshotPanel
          comprasSummary={comprasSummary}
          ventasSummary={ventasSummary}
          purchaseRows={purchaseRows}
          purchaseRanking={purchaseRanking}
          salesRows={salesRows}
          purchaseStatus={purchaseStatus}
          salesStatus={salesStatus}
          isLoading={isLoading}
          hasData={hasData}
        />
      </section>
    </div>
  );
}
