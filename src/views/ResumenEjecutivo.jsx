import { useState } from "react";
import DocumentFlowBoard from "@/components/cards/DocumentFlowBoard";
import DocumentStatusGrid from "@/components/cards/DocumentStatusGrid";
import PurchaseAnalysisBlock from "@/components/cards/PurchaseAnalysisBlock";
import PurchaseTrendComparison from "@/components/cards/PurchaseTrendComparison";
import PurchasesKpiGrid from "@/components/cards/PurchasesKpiGrid";
import DocumentReviewSection from "@/components/tables/DocumentReviewSection";
import { Card, CardContent } from "@/components/ui/card";
import { useFacturasStore } from "@/store/useFacturasStore";
import { formatPeriod } from "@/utils/formatters";

export default function ResumenEjecutivo({
  isLoading = false,
  onSelectCategory = null,
  onSelectProvider = null,
}) {
  const periodContext = useFacturasStore((state) => state.periodContext);
  const byPeriod = useFacturasStore((state) => state.byPeriod);
  const byCategory = useFacturasStore((state) => state.byCategory);
  const filters = useFacturasStore((state) => state.filters);
  const documentSummary = useFacturasStore((state) => state.documentSummary);
  const documentStatus = useFacturasStore((state) => state.documentStatus);
  const documentRowsByStatus = useFacturasStore((state) => state.documentRowsByStatus);
  const purchaseInvoiceRows = useFacturasStore((state) => state.purchaseInvoiceRows);
  const creditNoteRows = useFacturasStore((state) => state.creditNoteRows);
  const supplierAccountingRanking = useFacturasStore((state) => state.supplierAccountingRanking);
  const supplierRankingByCategory = useFacturasStore((state) => state.supplierRankingByCategory);
  const activeMonthDailySpend = useFacturasStore((state) => state.activeMonthDailySpend);
  const setFilters = useFacturasStore((state) => state.setFilters);
  const [selectedFlowStatus, setSelectedFlowStatus] = useState("Rechazado");
  const toggleFlowStatus = (status) => {
    setSelectedFlowStatus((current) => (current === status ? null : status));
  };
  const handleSelectDay = (date) => {
    setFilters({
      selectedDates: [date],
      dateRange: [date, date],
    });
  };
  const trendDescription =
    filters.year === "ALL" && filters.month !== "ALL"
      ? "Comparativo del mes seleccionado entre todos los años visibles y comparación simple por proveedor."
      : filters.year !== "ALL" && filters.month !== "ALL"
      ? "Trazabilidad diaria de compra neta dentro del mes activo y comparación simple por proveedor."
      : "Lectura mensual simple de compra neta y comparación contra el periodo anterior en compras.";

  if (!periodContext || !Number.isFinite(periodContext.total) || periodContext.count <= 0) {
    return (
      <Card>
        <CardContent className="pt-5 text-sm text-[var(--txt2)]">
          Sin datos utiles para construir el corte activo. Ajusta los filtros del costado.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--txt)]">Resumen de facturas y notas crédito de compras</h2>
            <p className="text-sm text-[var(--txt2)]">Corte activo de compras para leer FC, NC y valor neto: {formatPeriod(periodContext.period)}</p>
            <p className="mt-1 text-xs text-[var(--txt3)]">
              Fuente: API de compras para facturas; NC y estado documental desde Control Facturas cuando hay coincidencia.
            </p>
          </div>
        </div>
        <PurchasesKpiGrid summary={documentSummary} isLoading={isLoading} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--txt)]">Estado documental de facturas y notas crédito de compras</h2>
            <p className="text-sm text-[var(--txt2)]">Tablas operativas para revisar FC y NC de compras dentro del corte visible.</p>
          </div>
        </div>
        <DocumentReviewSection purchaseRows={purchaseInvoiceRows} creditRows={creditNoteRows} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--txt)]">Flujo documental y estado operativo de compras</h2>
            <p className="text-sm text-[var(--txt2)]">Estado y detalle operativo de los documentos de compras por aprobacion, revision y rechazo.</p>
          </div>
        </div>
          <DocumentStatusGrid
            rows={documentStatus}
            isLoading={isLoading}
            selectedStatus={selectedFlowStatus}
            onSelectStatus={toggleFlowStatus}
            labels={{
              Rechazado: { label: "Rechazada", helper: "Facturas rechazadas por Provexpress" },
              "En revision": { label: "Pendiente", helper: "Pendiente de validación interna" },
              Aprobado: { label: "Aceptada", helper: "Factura aceptada para el proceso" },
            }}
          />
        <DocumentFlowBoard rowsByStatus={documentRowsByStatus} selectedStatus={selectedFlowStatus} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--txt)]">Concentración de compras por proveedor y categoría</h2>
          <p className="text-sm text-[var(--txt2)]">Lectura rápida de proveedores líderes y mezcla por categoría de compras.</p>
        </div>
        <PurchaseAnalysisBlock
          providers={supplierAccountingRanking}
          providersByCategory={supplierRankingByCategory}
          categories={byCategory}
          onSelectCategory={onSelectCategory}
          onSelectProvider={onSelectProvider}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--txt)]">Tendencia de compra neta y comparativo por proveedor</h2>
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
          onSelectDay={handleSelectDay}
        />
      </section>
    </div>
  );
}
