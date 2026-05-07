import { useEffect, useMemo, useRef, useState } from "react";
import CreditNotesKpiGrid from "@/components/cards/CreditNotesKpiGrid";
import CreditNotesRankingMixPanel from "@/components/cards/CreditNotesRankingMixPanel";
import WeekVariationPanel from "@/components/cards/WeekVariationPanel";
import CreditNotesWeeklyChart from "@/components/charts/CreditNotesWeeklyChart";
import CreditNotesDetailTable from "@/components/tables/CreditNotesDetailTable";
import { useNotasCreditoStore } from "@/store/useNotasCreditoStore";

export default function NotasCredito({ isLoading = false }) {
  const [detailInteraction, setDetailInteraction] = useState(null);
  const detailRef = useRef(null);
  const {
    filters,
    weeklySeries,
    causeSummary,
    responsibleSummary,
    clientSummary,
    criticalWeeks,
    weekVariation,
    kpis,
    headerRangeLabel,
    selectedWeek,
    selectedWeekMeta,
    selectedWeekRows,
    visibleNcRows,
    activeInteractionLabel,
    selectedWeekComment,
    setSelectedWeek,
    clearFilters,
    clearSelectedWeek,
  } = useNotasCreditoStore((state) => state);

  const selectedWeekLabel = selectedWeekMeta ? `${selectedWeekMeta.label} ${selectedWeekMeta.year}` : null;
  const selectedInteractionType = detailInteraction?.type || null;

  useEffect(() => {
    if (!detailInteraction) {
      return;
    }

    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [detailInteraction]);

  function toggleDetailInteraction(next) {
    setDetailInteraction((current) =>
      current?.type === next.type && current?.key === next.key ? null : next
    );
  }

  function buildCauseMatcher(causeKey) {
    if (causeKey === "admon") return (row) => row.origen === "Administrativo";
    if (causeKey === "logistica") return (row) => row.origen === "Logistica";
    if (causeKey === "comercial") return (row) => row.origen === "Comercial";
    if (causeKey === "sistema") return (row) => row.origen === "Sistema";
    if (causeKey === "cliente") return (row) => row.origen === "Cliente";
    if (causeKey === "devoluciones") {
      return (row) =>
        row.origen === "Devolucion" || String(row.concepto || "").toLowerCase().includes("devolucion");
    }
    return () => true;
  }

  const hasDetailContext = Boolean(selectedWeek || activeInteractionLabel || detailInteraction);
  const detailRows = useMemo(() => {
    if (!hasDetailContext) {
      return [];
    }

    const baseRows = selectedWeek ? selectedWeekRows : visibleNcRows;
    if (!detailInteraction) {
      return baseRows;
    }

    if (detailInteraction.type === "causeBucket") {
      const matcher = buildCauseMatcher(detailInteraction.key);
      return baseRows.filter(matcher);
    }

    if (detailInteraction.type === "causeLabel") {
      return baseRows.filter((row) => (row.causa || "Otros") === detailInteraction.key);
    }

    if (detailInteraction.type === "client") {
      return baseRows.filter((row) => (row.cliente || "Sin cliente") === detailInteraction.key);
    }

    if (detailInteraction.type === "responsible") {
      return baseRows.filter(
        (row) => row.origen === "Comercial" && (row.asesor || "Sin responsable") === detailInteraction.key
      );
    }

    return baseRows;
  }, [activeInteractionLabel, detailInteraction, hasDetailContext, selectedWeek, selectedWeekRows, visibleNcRows]);

  return (
    <div className="space-y-4">
      <section className="space-y-3 stagger-item stagger-delay-1">
        <div>
          <h2 className="text-base font-semibold text-[var(--txt)]">Resumen de facturas y notas crédito de ventas</h2>
          <p className="text-sm text-[var(--txt2)]">
            {selectedWeekLabel ? `Semana activa: ${selectedWeekLabel}. ` : ""}
            Corte visible de notas crédito de ventas: {headerRangeLabel}
          </p>
          {selectedWeek && selectedWeekComment ? (
            <p className="mt-1 text-xs text-[var(--txt3)]">{selectedWeekComment}</p>
          ) : null}
        </div>
        <CreditNotesKpiGrid summary={kpis} isLoading={isLoading} />
      </section>

      <section className="space-y-3 stagger-item stagger-delay-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--txt)]">Tendencia semanal de NC, facturación y refacturación de ventas</h2>
          <p className="text-sm text-[var(--txt2)]">Porcentaje de notas crédito sobre ventas, con facturación bruta, valor NC y refacturación por semana.</p>
        </div>
        <CreditNotesWeeklyChart
          data={weeklySeries}
          selectedWeek={selectedWeek}
          onSelectWeek={setSelectedWeek}
          isLoading={isLoading}
          title="Tendencia semanal de notas crédito de ventas"
          subtitle="Línea de porcentaje de notas crédito y barras de facturación, NC y refacturación."
        />
      </section>

      <section className="space-y-3 stagger-item stagger-delay-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--txt)]">Variación semanal por causa y responsable en notas crédito de ventas</h2>
          <p className="text-sm text-[var(--txt2)]">Semana actual vs semana anterior, con foco en causas y responsables de notas crédito de ventas.</p>
        </div>
        <WeekVariationPanel
          variation={weekVariation}
          activeInteractionLabel={activeInteractionLabel}
          selectedCauseKey={selectedInteractionType === "causeLabel" ? detailInteraction?.key : null}
          selectedResponsibleKey={selectedInteractionType === "responsible" ? detailInteraction?.key : null}
          onSelectCause={(item) =>
            toggleDetailInteraction({
              type: "causeLabel",
              key: item.key,
              label: `Causa: ${item.label}`,
            })
          }
          onSelectResponsible={(item) =>
            toggleDetailInteraction({
              type: "responsible",
              key: item.key,
              label: `Responsable: ${item.label}`,
            })
          }
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--txt)]">Concentración de notas crédito de ventas por causa, cliente y comercial</h2>
          <p className="text-sm text-[var(--txt2)]">Causas, clientes y comerciales con mayor peso en las notas crédito de ventas.</p>
        </div>
        <div className="stagger-item stagger-delay-5">
          <CreditNotesRankingMixPanel
            rows={selectedWeek ? selectedWeekRows : visibleNcRows}
            causeSummary={causeSummary}
            clientSummary={clientSummary}
            responsibleSummary={responsibleSummary}
            selectedWeekLabel={selectedWeekLabel}
            isLoading={isLoading}
          />
        </div>
      </section>

      <section ref={detailRef} className="space-y-3 stagger-item stagger-delay-5">
        <div>
          <h2 className="text-base font-semibold text-[var(--txt)]">Detalle final de notas crédito de ventas</h2>
          <p className="text-sm text-[var(--txt2)]">Detalle final de notas crédito de ventas por semana, causa, responsable o cliente.</p>
        </div>
        <CreditNotesDetailTable
          rows={detailRows}
          hasDetailContext={hasDetailContext}
          selectedWeekLabel={selectedWeekLabel}
          activeInteractionLabel={activeInteractionLabel}
          detailInteractionLabel={detailInteraction?.label || null}
          selectedWeek={selectedWeek}
          criticalWeeks={criticalWeeks}
          onSelectWeek={setSelectedWeek}
          onClearSelectedWeek={clearSelectedWeek}
          hasTacticalFilters={Boolean(filters.impactKey || filters.responsible)}
          onClearTacticalFilters={clearFilters}
          onClearInteractionFilter={() => setDetailInteraction(null)}
        />
      </section>
    </div>
  );
}
