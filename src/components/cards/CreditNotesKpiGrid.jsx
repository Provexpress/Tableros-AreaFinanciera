import { Card, CardContent } from "@/components/ui/card";
import { formatCOP, formatCOPCompact, formatInteger, formatPct } from "@/utils/formatters";

function SummaryCard({ label, description, helper = null, amount, tone = "blue", isLoading = false }) {
  const toneClass =
    tone === "danger"
      ? "before:bg-[var(--danger)]"
      : tone === "amber"
        ? "before:bg-[var(--gasto)]"
        : tone === "green"
          ? "before:bg-[var(--pac)]"
          : "before:bg-[var(--tec)]";

  return (
    <Card className={`relative overflow-hidden before:absolute before:right-0 before:top-0 before:h-full before:w-[3px] ${toneClass}`}>
      <CardContent className="min-w-0 p-4 lg:p-5">
        {isLoading ? (
          <div className="space-y-3">
            <div className="skeleton h-3 w-24 rounded-full" />
            <div className="skeleton h-9 w-40 rounded-[8px]" />
            <div className="skeleton h-4 w-32 rounded-full" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--txt3)]">{label}</div>
              <div className="mt-1 text-sm text-[var(--txt2)]">{description}</div>
            </div>
            <div
              className="min-w-0 font-mono text-[clamp(1.55rem,2.2vw,2.05rem)] font-medium leading-none tracking-[-0.04em] text-[var(--txt)] [font-variant-numeric:tabular-nums]"
              title={formatCOP(amount)}
            >
              {formatCOPCompact(amount)}
            </div>
            {helper ? <div className="text-xs text-[var(--txt3)]">{helper}</div> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CreditNotesKpiGrid({ summary, isLoading = false }) {
  const ncRate = summary.totalBruto > 0 ? (summary.totalNc / summary.totalBruto) * 100 : 0;
  const refactRate = summary.totalNc > 0 ? (summary.totalRefact / summary.totalNc) * 100 : 0;
  const netRate = summary.totalBruto > 0 ? (summary.totalNeto / summary.totalBruto) * 100 : 0;

  return (
    <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
      <SummaryCard
        label="Facturación bruta de ventas"
        description="Ventas brutas del periodo"
        helper={`${formatInteger(summary.totalFacturas)} facturas emitidas`}
        amount={summary.totalBruto}
        isLoading={isLoading}
      />
      <SummaryCard
        label="Notas crédito emitidas de ventas"
        description="Notas crédito de ventas del periodo"
        helper={`${formatInteger(summary.totalNcCount)} NC mostradas | ${formatPct(ncRate, { signed: false })} sobre la bruta`}
        amount={summary.totalNc}
        tone="danger"
        isLoading={isLoading}
      />
      <SummaryCard
        label="Refacturación asociada a NC de ventas"
        description="Notas crédito de ventas reemplazadas por nueva factura"
        helper={`${formatInteger(summary.totalRefactCount)} refacturadas | ${formatPct(refactRate, { signed: false })} recuperado frente a NC`}
        amount={summary.totalRefact}
        tone="amber"
        isLoading={isLoading}
      />
      <SummaryCard
        label="Facturación neta de ventas"
        description="Facturación neta de ventas despues de NC"
        helper={`${formatPct(netRate, { signed: false })} queda frente a la venta bruta`}
        amount={summary.totalNeto}
        tone="green"
        isLoading={isLoading}
      />
    </section>
  );
}
