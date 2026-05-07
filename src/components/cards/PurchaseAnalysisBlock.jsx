import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableCell, TableHead } from "@/components/ui/table";
import { formatCOPFull, formatPct, getCategoryColor } from "@/utils/formatters";

function SupplierRanking({ rows = [], selectedCategory = null, onSelectProvider = null, entityLabel = "proveedor", title = "Ranking de compras por proveedor", subtitle = null }) {
  const visibleRows = rows.slice(0, 5);

  return (
    <Card className="h-full min-w-0">
      <CardHeader className="min-w-0">
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-[var(--txt2)]">
          {selectedCategory ? `Filtrado por categoria: ${selectedCategory}.` : subtitle || `Top ${entityLabel}s por monto total del corte.`}
        </p>
      </CardHeader>
      <CardContent>
        <div className="max-w-full overflow-x-auto rounded-[10px] border border-white/5">
          <Table className="min-w-[520px] table-fixed">
            <thead>
              <tr>
                <TableHead className="w-[72px]">Pos.</TableHead>
                    <TableHead>{entityLabel[0].toUpperCase() + entityLabel.slice(1)}</TableHead>
                <TableHead className="w-[160px] text-right">Monto total</TableHead>
              </tr>
            </thead>
            <tbody>
              {!visibleRows.length ? (
                <tr>
                  <TableCell colSpan={3} className="py-7 text-center text-sm text-[var(--txt3)]">
                    Sin {entityLabel}s para el corte activo.
                  </TableCell>
                </tr>
              ) : (
                visibleRows.map((row, index) => (
                  <tr
                    key={`${row.provider}-${index}`}
                    role={onSelectProvider ? "button" : undefined}
                    tabIndex={onSelectProvider ? 0 : undefined}
                    onClick={onSelectProvider ? () => onSelectProvider(row.provider) : undefined}
                    onKeyDown={
                      onSelectProvider
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onSelectProvider(row.provider);
                            }
                          }
                        : undefined
                    }
                    className={`bg-[var(--bg)] even:bg-white/[0.01] ${
                      onSelectProvider ? "cursor-pointer transition-colors hover:bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    <TableCell className="font-mono text-xs text-[var(--txt3)]">{index + 1}</TableCell>
                    <TableCell className="text-[var(--txt)]">
                      <div className="truncate" title={row.provider}>
                        {row.provider}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono text-[var(--txt)] [font-variant-numeric:tabular-nums]">
                      {formatCOPFull(row.total)}
                    </TableCell>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryMix({
  rows = [],
  selectedCategory = null,
  onSelectCategory = null,
  title = "Mix de gasto por categoria",
  subtitle = "Distribucion simple por categoria del corte.",
}) {
  const visibleRows = rows.slice(0, 5);

  return (
    <Card className="h-full min-w-0">
      <CardHeader className="min-w-0">
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-[var(--txt2)]">{subtitle}</p>
      </CardHeader>
      <CardContent className="min-w-0">
        {!visibleRows.length ? (
          <div className="rounded-[10px] border border-dashed border-white/10 px-4 py-7 text-sm text-[var(--txt3)]">
            Sin categorias para el corte activo.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleRows.map((row) => {
              const pct = Math.max(0, Math.min(100, Number(row.pct || 0)));
              const color = getCategoryColor(row.category);
              const active = selectedCategory === row.category;

              return (
                <button
                  key={row.category}
                  type="button"
                  onClick={() => onSelectCategory?.(active ? null : row.category)}
                  className={`w-full rounded-[8px] border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "border-[var(--tec)]/35 bg-[color:rgb(79_142_247_/_0.08)]"
                      : "border-white/5 bg-[var(--bg)] hover:border-white/12 hover:bg-[var(--surface-2)]/55"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      <span className="truncate text-sm font-medium text-[var(--txt)]">{row.category}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-xs text-[var(--txt)] [font-variant-numeric:tabular-nums]">
                        {formatCOPFull(row.total)}
                      </div>
                      <div className="text-[10px] text-[var(--txt3)]">{formatPct(row.pct, { signed: false })}</div>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/6">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PurchaseAnalysisBlock({
  providers = [],
  providersByCategory = {},
  categories = [],
  onSelectCategory = null,
  onSelectProvider = null,
  entityLabel = "proveedor",
  rankingTitle = "Ranking de compras por proveedor",
  rankingSubtitle = "Top proveedores por monto total del corte.",
  mixTitle = "Mix de gasto por categoria",
  mixSubtitle = "Distribucion simple por categoria del corte.",
}) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const providerRows = useMemo(() => {
    if (!selectedCategory) {
      return providers;
    }

    return providersByCategory[selectedCategory] || [];
  }, [providers, providersByCategory, selectedCategory]);

  return (
    <section className="grid gap-4 2xl:grid-cols-2">
      <SupplierRanking
        rows={providerRows}
        selectedCategory={selectedCategory}
        onSelectProvider={onSelectProvider}
        entityLabel={entityLabel}
        title={rankingTitle}
        subtitle={rankingSubtitle}
      />
      <CategoryMix
        rows={categories}
        selectedCategory={selectedCategory}
        title={mixTitle}
        subtitle={mixSubtitle}
        onSelectCategory={(category) => {
          setSelectedCategory(category);
          onSelectCategory?.(category);
        }}
      />
    </section>
  );
}
