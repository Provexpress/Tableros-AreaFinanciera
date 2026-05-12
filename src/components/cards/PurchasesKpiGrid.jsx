import { Card, CardContent } from "@/components/ui/card";
import { formatCOP, formatCOPCompact, formatInteger, formatPct } from "@/utils/formatters";

function SummaryCard({ label, description, count, amount, helper = null, tone = "blue", accentColor = null, isLoading = false }) {
  const toneClass =
    accentColor
      ? ""
      : tone === "amber"
      ? "before:bg-[var(--gasto)]"
      : tone === "teal"
        ? "before:bg-[#1D9E75]"
      : tone === "salesGreen"
        ? "before:bg-[#639922]"
      : tone === "green"
        ? "before:bg-[var(--pac)]"
        : "before:bg-[var(--tec)]";

  return (
    <Card
      className={`relative overflow-hidden before:absolute before:right-0 before:top-0 before:h-full before:w-[3px] ${toneClass}`}
      style={accentColor ? { "--summary-accent": accentColor } : undefined}
    >
      {accentColor ? <span className="absolute right-0 top-0 h-full w-[3px]" style={{ backgroundColor: accentColor }} /> : null}
      <CardContent className="min-w-0 p-4 lg:p-5">
        {isLoading ? (
          <div className="space-y-3">
            <div className="skeleton h-3 w-24 rounded-full" />
            <div className="skeleton h-9 w-40 rounded-[8px]" />
            <div className="skeleton h-4 w-32 rounded-full" />
          </div>
        ) : (
          <div className="space-y-4">
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
            <div className="flex items-center justify-between gap-3 rounded-[8px] border border-white/5 bg-[var(--bg)] px-3 py-2 text-sm">
              <span className="min-w-0 text-[var(--txt2)]">Cantidad</span>
              <span className="shrink-0 font-mono text-[var(--txt)] [font-variant-numeric:tabular-nums]">
                {formatInteger(count)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PurchasesKpiGrid({
  summary,
  isLoading = false,
  labels = {
    invoice: "Facturas de compra (FC)",
    invoiceDescription: "Facturas de compra del periodo",
    credit: "Notas crédito de compras (NC)",
    creditDescription: "Notas crédito de compras del periodo",
    net: "Compra neta",
    netDescription: "Facturas de compra menos notas crédito de compras",
    fcHelper: "Total bruto de compras mostradas.",
    ncHelperSuffix: "sobre FC de compras.",
    netHelperSuffix: "queda frente a la compra bruta.",
  },
  tones = { invoice: "blue", credit: "amber", net: "green" },
}) {
  const purchaseNcRate =
    summary.purchaseInvoiceTotal > 0 ? (summary.creditNoteTotal / summary.purchaseInvoiceTotal) * 100 : 0;
  const purchaseNetRate =
    summary.purchaseInvoiceTotal > 0 ? (summary.netTotal / summary.purchaseInvoiceTotal) * 100 : 0;

  return (
    <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
      <SummaryCard
        label={labels.invoice}
        description={labels.invoiceDescription}
        count={summary.purchaseInvoiceCount}
        amount={summary.purchaseInvoiceTotal}
        helper={labels.fcHelper}
        tone={tones.invoice}
        accentColor={tones.invoiceColor}
        isLoading={isLoading}
      />
      <SummaryCard
        label={labels.credit}
        description={labels.creditDescription}
        count={summary.creditNoteCount}
        amount={summary.creditNoteTotal}
        helper={`${formatPct(purchaseNcRate, { signed: false })} ${labels.ncHelperSuffix}`}
        tone="amber"
        isLoading={isLoading}
      />
      <SummaryCard
        label={labels.net}
        description={labels.netDescription}
        count={summary.purchaseInvoiceCount - summary.creditNoteCount}
        amount={summary.netTotal}
        helper={`${formatPct(purchaseNetRate, { signed: false })} ${labels.netHelperSuffix}`}
        tone={tones.net}
        accentColor={tones.netColor}
        isLoading={isLoading}
      />
    </section>
  );
}
