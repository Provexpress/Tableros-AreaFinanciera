import { useEffect, useMemo, useRef, useState } from "react";
import DocumentFlowBoard from "@/components/cards/DocumentFlowBoard";
import DocumentStatusGrid from "@/components/cards/DocumentStatusGrid";
import KpiCard from "@/components/cards/KpiCard";
import PurchaseAnalysisBlock from "@/components/cards/PurchaseAnalysisBlock";
import PurchaseTrendComparison from "@/components/cards/PurchaseTrendComparison";
import PurchasesKpiGrid from "@/components/cards/PurchasesKpiGrid";
import DocumentReviewSection from "@/components/tables/DocumentReviewSection";
import DetailTable from "@/components/tables/DetailTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useVentasStore } from "@/store/useVentasStore";
import { formatCOP, formatCOPFull, formatInteger, formatPeriod } from "@/utils/formatters";

const TEAL = "#1D9E75";
const CORAL = "#D85A30";

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

function ClientReconciliationPanel({ rows = [] }) {
  const visibleRows = rows.slice(0, 10);

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--txt)]">Conciliacion FV / NC por cliente</h2>
          <p className="text-sm text-[var(--txt2)]">
            Muestra como se casan las facturas de venta con las notas credito dentro del corte visible.
          </p>
        </div>
        <div className="overflow-x-auto rounded-[10px] border border-white/5">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-[0.08em] text-[var(--txt3)]">
              <tr>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2 text-right">FV</th>
                <th className="px-3 py-2 text-right">NC</th>
                <th className="px-3 py-2 text-right">Venta bruta</th>
                <th className="px-3 py-2 text-right">Notas credito</th>
                <th className="px-3 py-2 text-right">Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {!visibleRows.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-7 text-center text-sm text-[var(--txt3)]">
                    Sin clientes para el corte visible.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr key={row.cliente} className="bg-[var(--bg)] even:bg-white/[0.01]">
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
                ))
              )}
            </tbody>
          </table>
        </div>
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
          label="Base auditable de ventas"
          value={detailSummary.count.toLocaleString("es-CO")}
          sub="Registros del drill-down actual de ventas"
          accentColor="blue"
        />
        <KpiCard
          label="Total neto de ventas"
          value={formatCOP(detailSummary.total)}
          sub="Monto ajustado de la base filtrada de ventas"
          accentColor="green"
        />
        <KpiCard
          label="Aprobacion de ventas"
          value={`${detailSummary.approvalRate.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`}
          sub="Lectura rapida de ventas antes de entrar al detalle"
          accentColor="purple"
        />
      </section>

      <DetailTable
        rows={analysisData}
        search={searchInput}
        onSearchChange={setSearchInput}
        labels={{
          title: "Detalle auditable de documentos de ventas",
          subtitle: "Base filtrada de facturas de venta y notas credito de venta",
          searchPlaceholder: "Buscar cliente",
          entity: "Cliente",
          fileName: "detalle_ventas_auditable.csv",
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
  const [selectedFlowStatus, setSelectedFlowStatus] = useState("Rechazado");
  const detailRef = useRef(null);

  const periodContext = useVentasStore((state) => state.periodContext);
  const byPeriod = useVentasStore((state) => state.byPeriod);
  const byCategory = useVentasStore((state) => state.byCategory);
  const filteredData = useVentasStore((state) => state.filteredData);
  const filters = useVentasStore((state) => state.filters);
  const documentSummary = useVentasStore((state) => state.documentSummary);
  const documentStatus = useVentasStore((state) => state.documentStatus);
  const documentRowsByStatus = useVentasStore((state) => state.documentRowsByStatus);
  const purchaseInvoiceRows = useVentasStore((state) => state.purchaseInvoiceRows);
  const creditNoteRows = useVentasStore((state) => state.creditNoteRows);
  const supplierAccountingRanking = useVentasStore((state) => state.supplierAccountingRanking);
  const supplierRankingByCategory = useVentasStore((state) => state.supplierRankingByCategory);
  const activeMonthDailySpend = useVentasStore((state) => state.activeMonthDailySpend);
  const setFilters = useVentasStore((state) => state.setFilters);
  const clientReconciliationRows = useMemo(() => buildClientReconciliationRows(filteredData), [filteredData]);

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
      ? "Comparativo del mes seleccionado entre todos los anos visibles y comparacion simple por cliente."
      : filters.year !== "ALL" && filters.month !== "ALL"
        ? "Trazabilidad diaria de venta neta dentro del mes activo y comparacion simple por cliente."
        : "Lectura mensual simple de venta neta y comparacion contra el periodo anterior en ventas.";

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
                Resumen contable de facturas y notas credito de ventas
              </h2>
              <p className="text-sm text-[var(--txt2)]">
                Corte activo de ventas para leer FV, NC y valor neto: {formatPeriod(periodContext.period)}
              </p>
            </div>
          </div>
          <PurchasesKpiGrid
            summary={documentSummary}
            isLoading={isLoading}
            labels={{
              invoice: "Facturas de venta (FV)",
              invoiceDescription: "Base documental de facturas de venta del periodo visible",
              credit: "Notas credito de venta (NC)",
              creditDescription: "Notas credito de venta del periodo visible",
              net: "Venta neta contable",
              netDescription: "Facturas de venta menos notas credito de venta",
              fcHelper: "Base contable de referencia: 100% del valor de ventas visibles.",
              ncHelperSuffix: "sobre FV de ventas.",
              netHelperSuffix: "retenido frente a FV de ventas.",
            }}
            tones={{ invoice: "salesGreen", credit: "amber", net: "teal" }}
          />
        </section>

        <ClientReconciliationPanel rows={clientReconciliationRows} />

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--txt)]">
              Revision documental de facturas y notas credito de ventas
            </h2>
            <p className="text-sm text-[var(--txt2)]">
              Tablas operativas para revisar FV y NC de ventas dentro del corte visible.
            </p>
          </div>
          <DocumentReviewSection
            purchaseRows={purchaseInvoiceRows}
            creditRows={creditNoteRows}
            labels={{
              invoiceTitle: "Facturas de venta (FV)",
              invoiceSubtitle: "Facturas emitidas a clientes registradas en el periodo.",
              creditTitle: "Notas credito de venta (NC)",
              creditSubtitle: "Documentos de ajuste de ventas registrados en el periodo.",
              entity: "Cliente",
              invoiceNumber: "Numero factura",
              creditNumber: "Numero doc.",
            }}
          />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--txt)]">Flujo documental y estado operativo de ventas</h2>
            <p className="text-sm text-[var(--txt2)]">
              Estado y detalle operativo de los documentos de ventas por aprobacion, revision y rechazo.
            </p>
          </div>
          <DocumentStatusGrid
            rows={documentStatus}
            isLoading={isLoading}
            selectedStatus={selectedFlowStatus}
            onSelectStatus={toggleFlowStatus}
          />
          <DocumentFlowBoard
            rowsByStatus={documentRowsByStatus}
            selectedStatus={selectedFlowStatus}
            entityLabel="Cliente"
            layout="ventas"
          />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--txt)]">Concentracion de ventas por cliente y categoria</h2>
            <p className="text-sm text-[var(--txt2)]">Lectura rapida de clientes lideres y mezcla por categoria de ventas.</p>
          </div>
          <PurchaseAnalysisBlock
            providers={supplierAccountingRanking}
            providersByCategory={supplierRankingByCategory}
            categories={byCategory}
            onSelectCategory={(category) => setFilters({ category: category || "ALL", provider: "" })}
            onSelectProvider={(provider) => setFilters({ provider: filters.provider === provider ? "" : provider })}
            entityLabel="cliente"
            rankingTitle="Ranking de ventas por cliente"
            rankingSubtitle="Top clientes por monto total del corte."
          />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--txt)]">Tendencia de venta neta y comparativo por cliente</h2>
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
              monthly: "Venta neta mensual - ultimos 12 meses",
            }}
            colors={{ selected: TEAL, up: TEAL, down: CORAL, line: TEAL }}
          />
        </section>
      </div>

      <section ref={detailRef}>
        {showDetail ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-[8px] border border-white/8 bg-[var(--surface)]/60 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: TEAL }} />
                <span className="text-sm font-medium text-[var(--txt)]">Detalle auditable de ventas</span>
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
            <span className="text-sm text-[var(--txt2)]">Detalle auditable de ventas</span>
            <span className="text-xs text-[var(--txt3)]">Opcional - expandir</span>
          </button>
        )}
      </section>
    </div>
  );
}
