import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/utils/cn";
import { formatCOP } from "@/utils/formatters";

function formatSignedCount(value) {
  const numeric = Number(value || 0);
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${numeric.toLocaleString("es-CO")} NC`;
}

function getDeltaMeta(value) {
  const numeric = Number(value || 0);

  if (numeric === 0) {
    return {
      label: "Sin cambio",
      variant: "default",
      icon: Minus,
      className: "text-[var(--txt3)]",
    };
  }

  return {
    label: numeric > 0 ? "Sube" : "Baja",
    variant: numeric > 0 ? "danger" : "success",
    icon: numeric > 0 ? ArrowUpRight : ArrowDownRight,
    className: numeric > 0 ? "text-[var(--danger)]" : "text-[var(--success)]",
  };
}

function EmptyState({ children }) {
  return (
    <div className="rounded-[10px] border border-dashed border-white/10 px-4 py-5 text-sm text-[var(--txt3)]">
      {children}
    </div>
  );
}

function SummaryTile({ label, value, helper = null, toneClass = "text-[var(--txt)]" }) {
  return (
    <div className="rounded-[10px] border border-white/8 bg-[var(--surface-2)] px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--txt3)]">{label}</div>
      <div className={cn("mt-2 text-lg font-medium", toneClass)}>{value}</div>
      {helper ? <div className="mt-1 text-xs text-[var(--txt3)]">{helper}</div> : null}
    </div>
  );
}

function DeltaList({ title, items, emptyMessage, selectedKey = null, onSelect = null }) {
  return (
    <div className="space-y-3">
      <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--txt3)]">{title}</div>
      {items.length === 0 ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const deltaMeta = getDeltaMeta(item.deltaCount);
            const Icon = deltaMeta.icon;

            return (
              <button
                key={item.key}
                type="button"
                onClick={onSelect ? () => onSelect(item) : undefined}
                className={cn(
                  "w-full rounded-[10px] border px-3 py-3 text-left",
                  onSelect ? "cursor-pointer transition-colors hover:border-white/14 hover:bg-[var(--surface-2)]/88" : "cursor-default",
                  selectedKey === item.key
                    ? "border-[var(--tec)]/28 bg-[color:rgb(79_142_247_/_0.08)]"
                    : "border-white/8 bg-[var(--surface-2)]"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color || "var(--nocat)" }}
                      />
                      <div className="truncate text-sm font-medium text-[var(--txt)]" title={item.label}>
                        {item.label}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-[var(--txt3)]">
                      {item.currentCount.toLocaleString("es-CO")} vs {item.previousCount.toLocaleString("es-CO")} NC
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className={cn("inline-flex items-center gap-1 text-xs font-medium", deltaMeta.className)}>
                      <Icon className="h-3.5 w-3.5" />
                      {formatSignedCount(item.deltaCount)}
                    </div>
                    <div className={cn("mt-1 font-mono text-xs [font-variant-numeric:tabular-nums]", deltaMeta.className)}>
                      {formatCOP(item.deltaValue)}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function WeekVariationPanel({
  variation,
  activeInteractionLabel,
  selectedCauseKey = null,
  selectedResponsibleKey = null,
  onSelectCause = null,
  onSelectResponsible = null,
}) {
  const currentWeek = variation?.currentWeek || null;
  const previousWeek = variation?.previousWeek || null;

  if (!currentWeek) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Variacion semanal de notas credito de ventas</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState>No hay semanas visibles para comparar.</EmptyState>
        </CardContent>
      </Card>
    );
  }

  if (!previousWeek) {
    return (
      <Card>
        <CardHeader className="gap-3">
          <CardTitle>Variacion semanal de notas credito de ventas</CardTitle>
          {activeInteractionLabel ? <Badge variant="warning">Filtro activo: {activeInteractionLabel}</Badge> : null}
        </CardHeader>
        <CardContent>
          <EmptyState>
            {currentWeek.label} {currentWeek.year} es la primera semana visible del corte. Aun no hay una base previa para comparar.
          </EmptyState>
        </CardContent>
      </Card>
    );
  }

  const countMeta = getDeltaMeta(variation.ncDeltaCount);
  const valueMeta = getDeltaMeta(variation.ncDeltaValue);
  const improvingItems = [
    ...(variation.improvingCauses || []).map((item) => ({ ...item, kind: "Causa" })),
    ...(variation.improvingResponsibles || []).map((item) => ({ ...item, kind: "Responsable" })),
  ].slice(0, 4);

  return (
    <Card className="min-w-0">
      <CardHeader className="gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle>Variacion semanal de notas credito de ventas</CardTitle>
          <div className="text-sm text-[var(--txt2)]">
            Semana actual vs semana anterior para notas credito de ventas, causas y responsables.
          </div>
        </div>
        {activeInteractionLabel ? <Badge variant="warning">Filtro activo: {activeInteractionLabel}</Badge> : null}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          <SummaryTile
            label="Semana actual"
            value={`${currentWeek.label} ${currentWeek.year}`}
            helper={`${currentWeek.numNc.toLocaleString("es-CO")} NC`}
          />
          <SummaryTile
            label="Semana anterior"
            value={`${previousWeek.label} ${previousWeek.year}`}
            helper={`${previousWeek.numNc.toLocaleString("es-CO")} NC`}
          />
          <SummaryTile
            label="Cambio en NC"
            value={formatSignedCount(variation.ncDeltaCount)}
            helper={countMeta.label}
            toneClass={countMeta.className}
          />
          <SummaryTile
            label="Cambio en valor"
            value={formatCOP(variation.ncDeltaValue)}
            helper={valueMeta.label}
            toneClass={valueMeta.className}
          />
        </div>

        <div className="grid gap-4 2xl:grid-cols-2">
          <DeltaList
            title="Causas que empeoraron"
            items={variation.worseningCauses || []}
            emptyMessage="No hubo causas con deterioro visible frente a la semana anterior."
            selectedKey={selectedCauseKey}
            onSelect={onSelectCause}
          />
          <DeltaList
            title="Responsables que empeoraron"
            items={variation.worseningResponsibles || []}
            emptyMessage="No hubo responsables comerciales con deterioro visible frente a la semana anterior."
            selectedKey={selectedResponsibleKey}
            onSelect={onSelectResponsible}
          />
        </div>

        {improvingItems.length ? (
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--txt3)]">Mejoras visibles</div>
            <div className="flex flex-wrap gap-2">
              {improvingItems.map((item) => (
                <Badge key={`${item.kind}-${item.key}`} variant="success">
                  {item.kind}: {item.label} {formatSignedCount(item.deltaCount)}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
