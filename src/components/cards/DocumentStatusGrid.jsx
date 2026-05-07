import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCOPFull, formatInteger, formatPct } from "@/utils/formatters";

const STATUS_META = {
  Rechazado: {
    label: "Rechazado",
    variant: "danger",
    accent: "bg-[var(--danger)]",
    helper: "Rechazadas por el cliente/proveedor",
  },
  "En revision": {
    label: "Pendiente",
    variant: "warning",
    accent: "bg-[var(--warning)]",
    helper: "Pendiente de validación",
  },
  Aprobado: {
    label: "Aceptado",
    variant: "success",
    accent: "bg-[var(--success)]",
    helper: "Facturación aceptada",
  },
};

function findStatus(rows, status) {
  return rows.find((row) => row.status === status) || { status, count: 0, total: 0, pct: 0 };
}

export default function DocumentStatusGrid({
  rows = [],
  isLoading = false,
  showBlockedValue = false,
  selectedStatus = "Rechazado",
  onSelectStatus,
  labels = {},
}) {
  const resolvedStatusMeta = {
    Rechazado: { ...STATUS_META.Rechazado, ...(labels.Rechazado || {}) },
    "En revision": { ...STATUS_META["En revision"], ...(labels["En revision"] || {}) },
    Aprobado: { ...STATUS_META.Aprobado, ...(labels.Aprobado || {}) },
  };
  const safeRows = rows.length
    ? rows
    : Object.keys(resolvedStatusMeta).map((status) => ({ status, count: 0, total: 0, pct: 0 }));
  const rejected = findStatus(safeRows, "Rechazado");
  const review = findStatus(safeRows, "En revision");
  const blockedValue = Number(rejected.total || 0) + Number(review.total || 0);
  const blockedCount = Number(rejected.count || 0) + Number(review.count || 0);
  const isInteractive = Boolean(onSelectStatus) && !isLoading;

  return (
    <section className={`grid gap-3 md:grid-cols-2 ${showBlockedValue ? "2xl:grid-cols-4" : "2xl:grid-cols-3"}`}>
      {safeRows.map((row) => {
        const meta = resolvedStatusMeta[row.status] || resolvedStatusMeta["En revision"];
        const isSelected = selectedStatus === row.status;

        return (
          <Card
            key={row.status}
            role={isInteractive ? "button" : undefined}
            tabIndex={isInteractive ? 0 : undefined}
            aria-pressed={isInteractive ? isSelected : undefined}
            onClick={isInteractive ? () => onSelectStatus(row.status) : undefined}
            onKeyDown={
              isInteractive
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectStatus(row.status);
                    }
                  }
                : undefined
            }
            className={`relative overflow-hidden ${
              isInteractive ? "cursor-pointer select-none" : ""
            } ${
              isSelected
                ? "border-[var(--tec)]/35 bg-[color:rgb(79_142_247_/_0.06)] shadow-[0_0_0_1px_rgba(79,142,247,0.12)]"
                : ""
            }`}
          >
            <span className={`absolute left-0 top-0 h-full w-[3px] ${meta.accent}`} />
            <CardContent className="min-w-0 space-y-3 p-3.5 lg:p-4">
              {isLoading ? (
                <>
                  <div className="skeleton h-3 w-24 rounded-full" />
                  <div className="skeleton h-8 w-32 rounded-[8px]" />
                  <div className="skeleton h-3 w-40 rounded-full" />
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--txt3)]">
                      {formatPct(row.pct, { signed: false })}
                    </span>
                  </div>
                  <div className="min-w-0 font-mono text-[clamp(1.25rem,1.9vw,1.625rem)] font-medium leading-none tracking-[-0.03em] text-[var(--txt)] [font-variant-numeric:tabular-nums]">
                    {formatInteger(row.count)}
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 text-[var(--txt2)]">{meta.helper}</span>
                    <span className="shrink-0 font-mono text-[var(--txt)] [font-variant-numeric:tabular-nums]">
                      {formatCOPFull(row.total)}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
      {showBlockedValue ? (
        <Card className="relative overflow-hidden border-[var(--warning)]/18 bg-[color:rgb(245_166_35_/_0.05)]">
          <span className="absolute left-0 top-0 h-full w-[3px] bg-[var(--warning)]" />
          <CardContent className="min-w-0 space-y-3 p-3.5 lg:p-4">
            {isLoading ? (
              <>
                <div className="skeleton h-3 w-24 rounded-full" />
                <div className="skeleton h-8 w-32 rounded-[8px]" />
                <div className="skeleton h-3 w-40 rounded-full" />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="warning">Valor pendiente</Badge>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--txt3)]">
                    Revisión + rechazo
                  </span>
                </div>
                <div className="min-w-0 font-mono text-[clamp(1.1rem,1.6vw,1.5rem)] font-medium leading-tight tracking-[-0.03em] text-[var(--txt)] [font-variant-numeric:tabular-nums]">
                  {formatCOPFull(blockedValue)}
                </div>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 text-[var(--txt2)]">Documentos pendientes</span>
                  <span className="shrink-0 font-mono text-[var(--txt)] [font-variant-numeric:tabular-nums]">
                    {formatInteger(blockedCount)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
