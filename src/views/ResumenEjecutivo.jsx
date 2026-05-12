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
      ? "Compara el mes seleccionado contra otros a?os."
      : filters.year !== "ALL" && filters.month !== "ALL"
      ? "Muestra c?mo se movi? la compra d?a a d?a."
      : "Muestra la compra neta por mes y su cambio frente al periodo anterior.";

  if (!periodContext || !Number.isFinite(periodContext.total) || periodContext.count <= 0) {
    return (
      <Card>
        <CardContent className="pt-5 text-sm text-[var(--txt2)]">
          Sin datos útiles para este periodo. Ajusta los filtros del costado.
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
            <p className="text-sm text-[var(--txt2)]">Compras del periodo seleccionado: {formatPeriod(periodContext.period)}</p>
            <p className="mt-1 text-xs text-[var(--txt3)]">
              Datos: compras desde API; notas crédito y estados desde Control Facturas cuando aplica.
            </p>
          </div>
        </div>
        <PurchasesKpiGrid summary={documentSummary} isLoading={isLoading} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--txt)]">Estado de facturas y notas cr?dito de compras</h2>
            <p className="text-sm text-[var(--txt2)]">Facturas y notas crédito de compras del periodo seleccionado.</p>
          </div>
        </div>
        <DocumentReviewSection purchaseRows={purchaseInvoiceRows} creditRows={creditNoteRows} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--txt)]">Estado de compras</h2>
            <p className="text-sm text-[var(--txt2)]">Aceptadas, pendientes y rechazadas dentro del periodo.</p>
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
          <h2 className="text-base font-semibold text-[var(--txt)]">Evolución de compra neta</h2>
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
