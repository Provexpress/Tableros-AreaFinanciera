import { useEffect, useMemo, useRef, useState } from "react";
import DocumentStatusGrid from "@/components/cards/DocumentStatusGrid";
import KpiCard from "@/components/cards/KpiCard";
import PurchaseAnalysisBlock from "@/components/cards/PurchaseAnalysisBlock";
import PurchaseTrendComparison from "@/components/cards/PurchaseTrendComparison";
import PurchasesKpiGrid from "@/components/cards/PurchasesKpiGrid";
import DetailTable from "@/components/tables/DetailTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useVentasStore } from "@/store/useVentasStore";
import { formatCOP, formatCOPFull, formatDate, formatInteger, formatPeriod } from "@/utils/formatters";

const TEAL = "#1D9E75";
const CORAL = "#D85A30";

function getStatusKey(status) {
  const text = String(status || "").toLowerCase();
  if (text.includes("rechaz")) {
    return "Rechazado";
  }
  if (text.includes("revisi") || text.includes("pend")) {
    return "En revision";
  }
  if (text.includes("aprob")) {
    return "Aprobado";
  }
  return "En revision";
}

function getPositiveDocumentValue(row) {
  return Math.abs(Number(row.totalOriginal ?? row.total ?? 0));
}

function buildSalesAnalysisRows(rows = []) {
  const totalBase = rows.reduce((sum, row) => sum + getPositiveDocumentValue(row), 0);
  const providerMap = new Map();
  const categoryMap = new Map();
  const categoryProviderMap = new Map();

  rows.forEach((row) => {
    const provider = row.cliente || row.proveedor || "Sin cliente";
    const category = row.categoria || "Sin categoría";
    const value = getPositiveDocumentValue(row);

    if (!providerMap.has(provider)) {
      providerMap.set(provider, {
        provider,
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
    const providerBucket = providerMap.get(provider);
    providerBucket.total += value;
    providerBucket.count += 1;
    providerBucket.purchaseInvoiceTotal += value;
    providerBucket.purchaseInvoiceCount += 1;

    if (!categoryMap.has(category)) {
      categoryMap.set(category, { category, total: 0, count: 0 });
    }
    const categoryBucket = categoryMap.get(category);
    categoryBucket.total += value;
    categoryBucket.count += 1;

    if (!categoryProviderMap.has(category)) {
      categoryProviderMap.set(category, new Map());
    }
    const providersByCategory = categoryProviderMap.get(category);
    if (!providersByCategory.has(provider)) {
      providersByCategory.set(provider, {
        provider,
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
    const categoryProviderBucket = providersByCategory.get(provider);
    categoryProviderBucket.total += value;
    categoryProviderBucket.count += 1;
    categoryProviderBucket.purchaseInvoiceTotal += value;
    categoryProviderBucket.purchaseInvoiceCount += 1;
  });

  const mapRanking = (map, base, limit) =>
    [...map.values()]
      .map((item) => ({
        ...item,
        pct: base ? (item.total / base) * 100 : 0,
        avgTicket: item.purchaseInvoiceCount ? item.purchaseInvoiceTotal / item.purchaseInvoiceCount : 0,
        incidentCount: item.rejectedCount + item.reviewCount,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);

  const categories = [...categoryMap.values()]
    .map((item) => ({ ...item, pct: totalBase ? (item.total / totalBase) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);

  const providersByCategory = Object.fromEntries(
    [...categoryProviderMap.entries()].map(([category, providers]) => {
      const categoryTotal = [...providers.values()].reduce((sum, item) => sum + item.total, 0);
      return [category, mapRanking(providers, categoryTotal, 5)];
    })
  );

  return {
    providers: mapRanking(providerMap, totalBase, 10),
    categories,
    providersByCategory,
  };
}

function buildClientReconciliationRows(rows = []) {
  const buckets = new Map();

  rows.forEach((row) => {
    const cliente = row.cliente || row.proveedor || "Sin cliente";
    if (!buckets.has(cliente)) {
      buckets.set(cliente, {
        cliente,
        facturas: 0,
        notasCredito: 0,
        neto: 0,
        cantidadFV: 0,
        cantidadNC: 0,
      });
    }

    const bucket = buckets.get(cliente);
    const value = Math.abs(Number(row.totalOriginal ?? row.total ?? 0));
    const signed = Number(row.total || 0);
    const isCredit = Number(row.signoDocumento || 1) < 0;

    if (isCredit) {
      bucket.notasCredito += value;
      bucket.cantidadNC += 1;
    } else {
      bucket.facturas += value;
      bucket.cantidadFV += 1;
    }
    bucket.neto += signed;
  });

  return [...buckets.values()].sort(
    (a, b) => b.notasCredito - a.notasCredito || b.neto - a.neto || b.facturas - a.facturas
  );
}

function ClientReconciliationPanel({ rows = [], documents = [] }) {
  const [query, setQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = normalizedQuery
    ? rows.filter((row) => String(row.cliente || "").toLowerCase().includes(normalizedQuery))
    : rows;
  const visibleRows = filteredRows.slice(0, 10);
  const selectedRows = useMemo(
    () =>
      selectedClient
        ? documents
            .filter((row) => (row.cliente || row.proveedor || "Sin cliente") === selectedClient)
            .sort((a, b) => String(b.fechaIso || "").localeCompare(String(a.fechaIso || "")))
        : [],
    [documents, selectedClient]
  );

  const handleSelectClient = (client) => {
    setSelectedClient((current) => (current === client ? null : client));
  };

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--txt)]">Cruce de facturas y notas crédito por cliente</h2>
            <p className="text-sm text-[var(--txt2)]">
              Muestra facturas, notas crédito y neto por cliente.
            </p>
          </div>
          <div className="w-full sm:w-[280px]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar cliente"
              aria-label="Buscar cliente"
            />
          </div>
        </div>
        <div className="overflow-x-auto rounded-[10px] border border-white/5">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-[0.08em] text-[var(--txt3)]">
              <tr>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2 text-right">FV</th>
                <th className="px-3 py-2 text-right">NC</th>
                <th className="px-3 py-2 text-right">Venta bruta</th>
                <th className="px-3 py-2 text-right">Notas crédito</th>
                <th className="px-3 py-2 text-right">Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {!visibleRows.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-7 text-center text-sm text-[var(--txt3)]">
                    {normalizedQuery ? "Sin clientes para esa búsqueda." : "Sin clientes en el periodo seleccionado."}
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const selected = selectedClient === row.cliente;
                  return (
                  <tr
                    key={row.cliente}
                    className={`cursor-pointer bg-[var(--bg)] even:bg-white/[0.01] hover:bg-[var(--surface-2)] ${
                      selected ? "outline outline-1 outline-[var(--tec)]/40" : ""
                    }`}
                    onClick={() => handleSelectClient(row.cliente)}
                  >
                    <td className="px-3 py-2 font-medium text-[var(--txt)]">
                      <div className="max-w-[260px] truncate" title={row.cliente}>
                        {row.cliente}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--txt2)]">{formatInteger(row.cantidadFV)}</td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--danger)]">{formatInteger(row.cantidadNC)}</td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--txt)]">{formatCOPFull(row.facturas)}</td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--danger)]">
                      {row.notasCredito ? formatCOPFull(row.notasCredito) : "Sin NC"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-[var(--txt)]">{formatCOPFull(row.neto)}</td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-[var(--txt3)]">
          Mostrando {formatInteger(visibleRows.length)} de {formatInteger(filteredRows.length)} clientes.
        </div>
        {selectedClient ? (
          <div className="rounded-[10px] border border-white/8 bg-white/[0.02]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-[var(--txt)]" title={selectedClient}>
                  {selectedClient}
                </div>
                <div className="text-xs text-[var(--txt3)]">
                  {formatInteger(selectedRows.length)} documentos del periodo seleccionado
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setSelectedClient(null)}>
                Cerrar
              </Button>
            </div>
            <div className="max-h-[320px] overflow-auto">
              <table className="min-w-[860px] w-full text-sm">
                <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-[0.08em] text-[var(--txt3)]">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Doc</th>
                    <th className="px-3 py-2">Factura / NC</th>
                    <th className="px-3 py-2 text-right">Monto factura</th>
                    <th className="px-3 py-2 text-right">Monto NC</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {selectedRows.map((row) => {
                    const isCredit = Number(row.signoDocumento || 1) < 0;
                    const amount = Math.abs(Number(row.totalOriginal ?? row.total ?? 0));
                    return (
                      <tr key={row.id} className="bg-[var(--bg)] even:bg-white/[0.01]">
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.fecha)}</td>
                        <td className="px-3 py-2">{isCredit ? "NC" : "FV"}</td>
                        <td className="px-3 py-2 font-mono text-xs text-[var(--txt2)]">
                          {row.numeroDocumento || row.folio || "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[var(--txt)]">
                          {isCredit ? "-" : formatCOPFull(amount)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[var(--danger)]">
                          {isCredit ? formatCOPFull(amount) : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-[var(--txt)]">
                          {formatCOPFull(Number(row.total || 0))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DetalleVentas() {
  const analysisData = useVentasStore((state) => state.analysisData);
  const detailSummary = useVentasStore((state) => state.detailSummary);
  const filters = useVentasStore((state) => state.filters);
  const setFilters = useVentasStore((state) => state.setFilters);
  const clearFilters = useVentasStore((state) => state.clearFilters);
  const [searchInput, setSearchInput] = useState(filters.provider);

  useEffect(() => {
    setSearchInput(filters.provider);
  }, [filters.provider]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput !== filters.provider) {
        setFilters({ provider: searchInput });
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [filters.provider, searchInput, setFilters]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <KpiCard
          label="Detalle de ventas"
          value={detailSummary.count.toLocaleString("es-CO")}
          sub="Facturas y notas crédito del periodo seleccionado"
          accentColor="blue"
        />
        <KpiCard
          label="Total neto de ventas"
          value={formatCOP(detailSummary.total)}
          sub="Monto neto mostrado"
          accentColor="green"
        />
        <KpiCard
          label="Aprobación de ventas"
          value={`${detailSummary.approvalRate.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`}
          sub="Facturas aceptadas en el detalle"
          accentColor="purple"
        />
      </section>

      <DetailTable
        rows={analysisData}
        search={searchInput}
        onSearchChange={setSearchInput}
        labels={{
          title: "Detalle de ventas",
          subtitle: "Listado filtrado de facturas y notas crédito de venta",
          searchPlaceholder: "Buscar cliente",
          entity: "Cliente",
          fileName: "detalle_ventas.csv",
        }}
      />

      <Button variant="secondary" onClick={clearFilters}>
        Limpiar filtros
      </Button>
    </div>
  );
}

export default function Ventas({ isLoading = false }) {
  const [showDetail, setShowDetail] = useState(false);
  const [selectedFlowStatus, setSelectedFlowStatus] = useState(null);
  const detailRef = useRef(null);

  const periodContext = useVentasStore((state) => state.periodContext);
  const byPeriod = useVentasStore((state) => state.byPeriod);
  const byCategory = useVentasStore((state) => state.byCategory);
  const filteredData = useVentasStore((state) => state.filteredData);
  const filters = useVentasStore((state) => state.filters);
  const documentSummary = useVentasStore((state) => state.documentSummary);
  const documentStatus = useVentasStore((state) => state.documentStatus);
  const purchaseInvoiceRows = useVentasStore((state) => state.purchaseInvoiceRows);
  const supplierAccountingRanking = useVentasStore((state) => state.supplierAccountingRanking);
  const supplierRankingByCategory = useVentasStore((state) => state.supplierRankingByCategory);
  const activeMonthDailySpend = useVentasStore((state) => state.activeMonthDailySpend);
  const setFilters = useVentasStore((state) => state.setFilters);
  const clientReconciliationRows = useMemo(() => buildClientReconciliationRows(filteredData), [filteredData]);
  const statusAnalysis = useMemo(() => {
    if (!selectedFlowStatus) {
      return {
        providers: supplierAccountingRanking,
        categories: byCategory,
        providersByCategory: supplierRankingByCategory,
        count: purchaseInvoiceRows.length,
      };
    }

    const rows = purchaseInvoiceRows.filter((row) => getStatusKey(row.estado) === selectedFlowStatus);
    return {
      ...buildSalesAnalysisRows(rows),
      count: rows.length,
    };
  }, [byCategory, purchaseInvoiceRows, selectedFlowStatus, supplierAccountingRanking, supplierRankingByCategory]);

  const handleSelectDay = (date) => {
    const isSameSelectedDate =
      filters.selectedDates?.length === 1 &&
      filters.selectedDates[0] === date &&
      filters.dateRange?.[0] === date &&
      filters.dateRange?.[1] === date;

    if (isSameSelectedDate) {
      setFilters({
        selectedDates: [],
        dateRange: [null, null],
      });
      return;
    }

    setFilters({
      selectedDates: [date],
      dateRange: [date, date],
    });
    setShowDetail(true);
  };

  useEffect(() => {
    if (showDetail) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showDetail]);

  if (!periodContext || !Number.isFinite(periodContext.total) || periodContext.count <= 0) {
    return (
      <Card>
        <CardContent className="pt-5 text-sm text-[var(--txt2)]">
          Carga un archivo con datos de ventas o verifica que los acuses mensuales esten disponibles.
        </CardContent>
      </Card>
    );
  }

  const toggleFlowStatus = (status) => {
    setSelectedFlowStatus((current) => (current === status ? null : status));
  };

  const trendDescription =
    filters.year === "ALL" && filters.month !== "ALL"
      ? "Compara el mes seleccionado contra otros a?os."
      : filters.year !== "ALL" && filters.month !== "ALL"
        ? "Muestra c?mo se movi? la venta d?a a d?a."
        : "Muestra la venta neta por mes y su cambio frente al periodo anterior.";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-[var(--txt)]">Ventas</h1>
      </div>

      <div className="space-y-4">
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--txt)]">
                Resumen de facturas y notas crédito de ventas
              </h2>
              <p className="text-sm text-[var(--txt2)]">
                Ventas del periodo seleccionado: {formatPeriod(periodContext.period)}
              </p>
              <p className="mt-1 text-xs text-[var(--txt3)]">
                Datos de ventas desde la API. Las notas crédito y los estados se cruzan cuando hay coincidencia.
              </p>
            </div>
          </div>
          <PurchasesKpiGrid
            summary={documentSummary}
            isLoading={isLoading}
            labels={{
              invoice: "Facturas de venta (FV)",
              invoiceDescription: "Facturas de venta del periodo",
              credit: "Notas crédito de venta (NC)",
              creditDescription: "Notas crédito de venta del periodo",
              net: "Venta neta",
              netDescription: "Facturas de venta menos notas crédito de venta",
              fcHelper: "Total bruto de ventas mostradas.",
              ncHelperSuffix: "sobre FV de ventas.",
              netHelperSuffix: "queda frente a la venta bruta.",
            }}
            tones={{ invoice: "salesGreen", credit: "amber", net: "teal" }}
          />
        </section>

        <ClientReconciliationPanel rows={clientReconciliationRows} documents={filteredData} />

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--txt)]">Estado de facturación de ventas</h2>
            <p className="text-sm text-[var(--txt2)]">
              Cómo están las facturas emitidas a clientes.
            </p>
          </div>
          <DocumentStatusGrid
            rows={documentStatus}
            isLoading={isLoading}
            selectedStatus={selectedFlowStatus}
            onSelectStatus={toggleFlowStatus}
            labels={{
              Rechazado: { label: "Rechazada", helper: "Facturas rechazadas por el cliente" },
              "En revision": { label: "Sin aceptar", helper: "Aún no aparece aceptación completa" },
              Aprobado: { label: "Aceptada", helper: "Aceptada por el cliente o por tiempo cumplido" },
            }}
          />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--txt)]">Concentración de ventas por cliente y categoría</h2>
            <p className="text-sm text-[var(--txt2)]">Clientes principales y mezcla por categoría de ventas.</p>
          </div>
          <PurchaseAnalysisBlock
            providers={statusAnalysis.providers}
            providersByCategory={statusAnalysis.providersByCategory}
            categories={statusAnalysis.categories}
            onSelectCategory={(category) => setFilters({ category: category || "ALL", provider: "" })}
            onSelectProvider={(provider) => setFilters({ provider: filters.provider === provider ? "" : provider })}
            entityLabel="cliente"
            rankingTitle="Ranking de ventas por cliente"
            rankingSubtitle={
              selectedFlowStatus
                ? `${statusAnalysis.count.toLocaleString("es-CO")} facturas en estado ${selectedFlowStatus.toLowerCase()}.`
                : "Clientes con mayor valor vendido."
            }
            mixTitle="Mix de ventas por categoría"
            mixSubtitle={
              selectedFlowStatus
                ? "Categorías de las facturas del estado seleccionado."
                : "Ventas y notas crédito agrupadas por categoría."
            }
          />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--txt)]">Evolución de venta neta</h2>
            <p className="text-sm text-[var(--txt2)]">{trendDescription}</p>
          </div>
          <PurchaseTrendComparison
            byPeriod={byPeriod}
            currentPeriod={periodContext.period}
            isLoading={isLoading}
            selectedYear={filters.year}
            selectedMonth={filters.month}
            dailyTrend={activeMonthDailySpend}
            dateRange={filters.dateRange}
            labels={{
              title: "Evolucion de venta neta",
              value: "Venta neta",
              daily: "Venta neta diaria",
              monthly: "Venta neta mensual - últimos 12 meses",
            }}
            colors={{ selected: TEAL, up: TEAL, down: CORAL, line: TEAL }}
            onSelectDay={handleSelectDay}
          />
        </section>
      </div>

      <section ref={detailRef}>
        {showDetail ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-[8px] border border-white/8 bg-[var(--surface)]/60 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: TEAL }} />
                <span className="text-sm font-medium text-[var(--txt)]">Detalle de ventas</span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setShowDetail(false)}>
                Ocultar
              </Button>
            </div>
            <DetalleVentas />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDetail(true)}
            className="flex w-full items-center justify-between rounded-[8px] border border-dashed border-white/12 bg-[var(--surface)]/40 px-4 py-3 text-left transition-all hover:border-white/20 hover:bg-[var(--surface)]/60"
          >
            <span className="text-sm text-[var(--txt2)]">Detalle de ventas</span>
            <span className="text-xs text-[var(--txt3)]">Opcional - expandir</span>
          </button>
        )}
      </section>
    </div>
  );
}
