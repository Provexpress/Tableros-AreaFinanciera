import { Minus, MoveRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/utils/cn";
import { formatCOPCompact, formatCOPFull, formatDate, formatInteger } from "@/utils/formatters";

function FormulaStep({ label, value, helper, tone = "default" }) {
  const toneClass =
    tone === "danger"
      ? "text-[var(--danger)]"
      : tone === "green"
        ? "text-[var(--success)]"
        : tone === "amber"
          ? "text-[var(--gasto)]"
          : "text-[var(--txt)]";

  return (
    <div className="min-w-0 flex-1 rounded-[8px] border border-white/8 bg-white/[0.03] p-3">
      <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--txt3)]">{label}</div>
      <div className={cn("mt-1 font-mono text-lg font-medium [font-variant-numeric:tabular-nums]", toneClass)}>
        {value}
      </div>
      <div className="mt-1 text-xs text-[var(--txt2)]">{helper}</div>
    </div>
  );
}

function FormulaRow({ title, first, second, result }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
          <FormulaStep {...first} />
          <div className="flex items-center justify-center text-[var(--txt3)] md:w-7">
            <Minus className="h-4 w-4" />
          </div>
          <FormulaStep {...second} />
          <div className="flex items-center justify-center text-[var(--txt3)] md:w-7">
            <MoveRight className="h-4 w-4" />
          </div>
          <FormulaStep {...result} />
        </div>
      </CardContent>
    </Card>
  );
}

function buildClientRanking(rows = []) {
  const totals = new Map();

  rows.forEach((row) => {
    const key = row.cliente || row.proveedor || "Sin cliente";
    if (!totals.has(key)) {
      totals.set(key, {
        key,
        label: key,
        total: 0,
        count: 0,
      });
    }

    const bucket = totals.get(key);
    bucket.total += Number(row.total || row.valor || 0);
    bucket.count += 1;
  });

  return [...totals.values()]
    .sort((a, b) => b.total - a.total || b.count - a.count);
}

function buildPurchaseEntities(rows = [], fallbackRanking = []) {
  if (rows.length) {
    const totals = new Map();

    rows.forEach((row) => {
      const key = row.proveedor || "Sin proveedor";
      if (!totals.has(key)) {
        totals.set(key, {
          key,
          label: key,
          total: 0,
          count: 0,
          purchaseInvoiceCount: 0,
          creditNoteCount: 0,
        });
      }

      const value = Number(row.total || 0);
      const type = String(row.tipoDocNormalizado || row.tipoDoc || "").toLowerCase();
      const isCredit = Number(row.signoDocumento || 1) < 0 || type.includes("nota de cr");
      const bucket = totals.get(key);

      bucket.total += value;
      bucket.count += 1;
      if (isCredit) {
        bucket.creditNoteCount += 1;
      } else {
        bucket.purchaseInvoiceCount += 1;
      }
    });

    return [...totals.values()].sort((a, b) => b.total - a.total || b.count - a.count);
  }

  return fallbackRanking.map((row) => ({
    key: row.provider || "Sin proveedor",
    label: row.provider || "Sin proveedor",
    total: Number(row.total || 0),
    count: Number(row.count || 0),
    purchaseInvoiceCount: Number(row.purchaseInvoiceCount || 0),
    creditNoteCount: Number(row.creditNoteCount || 0),
  }));
}

function buildSalesEntities(rows = []) {
  return buildClientRanking(rows).map((row) => ({
    ...row,
    purchaseInvoiceCount: row.count,
    creditNoteCount: 0,
  }));
}

function buildCategoryBreakdown({ rows = [], selected, type }) {
  if (!selected) {
    return [];
  }

  const totals = new Map();

  rows.forEach((row) => {
    const entityKey = type === "purchase" ? row.proveedor || "Sin proveedor" : row.cliente || row.proveedor || "Sin cliente";
    if (entityKey !== selected.key) {
      return;
    }

    const category = type === "purchase" ? row.categoria || "Sin categoría" : row.categoria || row.causa || row.concepto || "Sin categoría";
    const value = Number(row.total || row.valor || 0);
    const docValue = Math.abs(Number(row.totalOriginal ?? row.total ?? row.valor ?? 0));
    const typeText = String(row.tipoDocNormalizado || row.tipoDoc || "").toLowerCase();
    const isCredit = Number(row.signoDocumento || 1) < 0 || typeText.includes("nota de cr");

    if (!totals.has(category)) {
      totals.set(category, {
        key: category,
        category,
        total: 0,
        grossTotal: 0,
        creditTotal: 0,
        count: 0,
      });
    }

    const bucket = totals.get(category);
    bucket.total += value;
    bucket.count += 1;
    if (isCredit) {
      bucket.creditTotal += docValue;
    } else {
      bucket.grossTotal += docValue;
    }
  });

  return [...totals.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total) || b.count - a.count);
}

function getRowCategory(row, type) {
  return type === "purchase" ? row.categoria || "Sin categoría" : row.categoria || row.causa || row.concepto || "Sin categoría";
}

function buildCategoryRows({ rows = [], selectedEntity, selectedCategory, type }) {
  if (!selectedEntity || !selectedCategory) {
    return [];
  }

  return rows
    .filter((row) => {
      const entityKey = type === "purchase" ? row.proveedor || "Sin proveedor" : row.cliente || row.proveedor || "Sin cliente";
      return entityKey === selectedEntity.key && getRowCategory(row, type) === selectedCategory.key;
    })
    .map((row) => {
      if (type === "purchase") {
        const typeText = String(row.tipoDocNormalizado || row.tipoDoc || "").toLowerCase();
        const isCredit = Number(row.signoDocumento || 1) < 0 || typeText.includes("nota de cr");

        return {
          key: row.id || `${row.numeroDocumento || row.folio}-${row.fechaIso}`,
          date: row.fechaIso,
          document: row.numeroDocumento || row.folio || row.prefijo || "-",
          description: row.tipoDocNormalizado || row.tipoDoc || "Documento",
          reference: row.oc || row.estado || "-",
          quantityLabel: isCredit ? "NC" : "FC",
          value: Number(row.total || 0),
        };
      }

      return {
        key: row.id || row.nc || `${row.factura}-${row.valor}`,
        date: row.fechaIso || row.monthRef || row.fechaInicialIso,
        document: row.numeroDocumento || row.nc || "-",
        description: row.tipoDocNormalizado || row.concepto || row.causa || "Movimiento",
        reference: row.estado || row.factura || row.reemplazadaPor || row.asesor || "-",
        quantityLabel: Number(row.signoDocumento || 1) < 0 ? "NC" : "FV",
        value: Number(row.total || row.valor || 0),
      };
    })
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

function EntityRow({ index, label, value, helper, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[8px] border px-3 py-2.5 text-left transition",
        active
          ? "border-[var(--tec)] bg-[var(--tec)]/10"
          : "border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]"
      )}
    >
      <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-white/[0.05] text-xs font-medium text-[var(--txt2)]">
        {index}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-[var(--txt)]" title={label}>
          {label}
        </div>
        <div className="text-xs text-[var(--txt3)]">{helper}</div>
      </div>
      <div className="font-mono text-sm font-medium text-[var(--txt)] [font-variant-numeric:tabular-nums]">
        {value}
      </div>
    </button>
  );
}

function EntityCard({ title, subtitle, rows, selected, onSelect, emptyText }) {
  const [query, setQuery] = useState("");
  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => String(row.label || "").toLowerCase().includes(needle));
  }, [query, rows]);

  return (
    <Card>
      <CardHeader className="gap-1.5">
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-[var(--txt2)]">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <div className="space-y-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar"
              className="h-9 w-full rounded-[8px] border border-white/10 bg-white/[0.03] px-3 text-sm text-[var(--txt)] outline-none transition focus:border-[var(--tec)]/50"
            />
            <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
            {visibleRows.map((row, index) => (
              <EntityRow
                key={row.key || row.provider || row.label || index}
                index={index + 1}
                label={row.label}
                value={formatCOPCompact(row.total)}
                helper={`${formatInteger(row.count)} registros`}
                active={selected?.key === row.key}
                onClick={() => onSelect(row)}
              />
            ))}
            {!visibleRows.length ? (
              <div className="rounded-[8px] border border-white/8 bg-white/[0.03] px-3 py-4 text-sm text-[var(--txt2)]">
                Sin coincidencias para la búsqueda.
              </div>
            ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-[8px] border border-white/8 bg-white/[0.03] px-3 py-4 text-sm text-[var(--txt2)]">
            {emptyText}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ValueComparisonChart({ comprasSummary, ventasSummary }) {
  const rows = [
    {
      key: "compras",
      label: "Compras",
      color: "var(--tec)",
      gross: Number(comprasSummary.purchaseInvoiceTotal || 0),
      credit: Number(comprasSummary.creditNoteTotal || 0),
      net: Number(comprasSummary.netTotal || 0),
    },
    {
      key: "ventas",
      label: "Ventas",
      color: "#1D9E75",
      gross: Number(ventasSummary.purchaseInvoiceTotal || 0),
      credit: Number(ventasSummary.creditNoteTotal || 0),
      net: Number(ventasSummary.netTotal || 0),
    },
  ];
  const maxValue = Math.max(...rows.flatMap((row) => [row.gross, row.credit, Math.abs(row.net)]), 1);

  const metrics = [
    { key: "gross", label: "Bruto", tone: "text-[var(--txt)]" },
    { key: "credit", label: "NC", tone: "text-[var(--danger)]" },
    { key: "net", label: "Neto", tone: "text-[var(--success)]" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Diferencia entre compras y ventas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <div key={row.key} className="rounded-[8px] border border-white/8 bg-white/[0.03] p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                  <span className="text-sm font-semibold text-[var(--txt)]">{row.label}</span>
                </div>
                <span className="font-mono text-sm font-semibold text-[var(--txt)]">{formatCOPCompact(row.net)}</span>
              </div>
              <div className="space-y-2.5">
                {metrics.map((metric) => {
                  const value = Number(row[metric.key] || 0);
                  const width = Math.max(2, (Math.abs(value) / maxValue) * 100);
                  const barColor = metric.key === "credit" ? "var(--danger)" : metric.key === "net" ? row.color : "var(--txt3)";

                  return (
                    <div key={metric.key} className="grid grid-cols-[4.5rem_minmax(0,1fr)_6rem] items-center gap-2">
                      <span className="text-xs text-[var(--txt2)]">{metric.label}</span>
                      <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
                        <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: barColor }} />
                      </div>
                      <span className={cn("text-right font-mono text-xs [font-variant-numeric:tabular-nums]", metric.tone)}>
                        {formatCOPCompact(value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryDetailCard({ selected, type, rows, selectedCategory, onSelectCategory }) {
  const title = type === "purchase" ? "Detalle comprado por categoría" : "Detalle vendido o ajust?do por categoría";
  const helper =
    type === "purchase"
      ? "Selecciona una categoría para ver los documentos que componen el valor."
      : "Las ventas usan categoría cuando existe; las NC usan causa o concepto.";

  return (
    <Card>
      <CardHeader className="gap-1.5">
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-[var(--txt2)]">
          {selected
            ? `${selected.label} - ${formatCOPFull(selected.total)}. ${helper}`
            : "Selecciona un proveedor o cliente para ver el detalle."}
        </p>
      </CardHeader>
      <CardContent>
        {selected && rows.length ? (
          <div className="overflow-x-auto rounded-[8px] border border-white/8">
            <table className="min-w-[640px] w-full text-sm">
              <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-[0.08em] text-[var(--txt3)]">
                  <tr>
                    <th className="px-3 py-2">Categoría</th>
                  <th className="px-3 py-2 text-right">Registros</th>
                  <th className="px-3 py-2 text-right">FC / Bruto</th>
                  <th className="px-3 py-2 text-right">NC</th>
                  <th className="px-3 py-2 text-right">Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {rows.map((row) => (
                  <tr
                    key={row.key}
                    onClick={() => onSelectCategory(row)}
                    className={cn(
                      "cursor-pointer bg-white/[0.02] transition hover:bg-white/[0.05]",
                      selectedCategory?.key === row.key && "bg-[var(--tec)]/10"
                    )}
                  >
                    <td className="px-3 py-2 font-medium text-[var(--txt)]">
                      <button type="button" className="w-full truncate text-left" title={row.category}>
                        {row.category}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--txt2)]">{formatInteger(row.count)}</td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--txt)]">{formatCOPCompact(row.grossTotal)}</td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--danger)]">
                      {row.creditTotal ? formatCOPCompact(row.creditTotal) : "Sin NC"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-[var(--txt)]">{formatCOPCompact(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-[8px] border border-white/8 bg-white/[0.03] px-3 py-4 text-sm text-[var(--txt2)]">
            {selected ? "No hay detalle para esta selección." : "Elige un ítem de las tarjetas para abrir el detalle."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MovementDetailCard({ selectedEntity, selectedCategory, type, rows }) {
  const title = type === "purchase" ? "Qué se compró" : "Detalle de documentos de venta";

  return (
    <Card>
      <CardHeader className="gap-1.5">
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-[var(--txt2)]">
          {selectedEntity && selectedCategory
            ? `${selectedEntity.label} - ${selectedCategory.category} - ${formatInteger(rows.length)} movimientos`
            : "Selecciona una fila para ver los documentos."}
        </p>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <div className="max-h-[360px] overflow-x-auto rounded-[8px] border border-white/8">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="sticky top-0 bg-white/[0.05] text-left text-xs uppercase tracking-[0.08em] text-[var(--txt3)]">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Documento</th>
                  <th className="px-3 py-2">Detalle</th>
                  <th className="px-3 py-2">Referencia</th>
                  <th className="px-3 py-2 text-right">Tipo</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {rows.map((row) => (
                  <tr key={row.key} className="bg-white/[0.02]">
                    <td className="whitespace-nowrap px-3 py-2 text-[var(--txt2)]">{formatDate(row.date)}</td>
                    <td className="px-3 py-2 font-medium text-[var(--txt)]">{row.document}</td>
                    <td className="px-3 py-2 text-[var(--txt)]">
                      <div className="max-w-[260px] truncate" title={row.description}>
                        {row.description}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[var(--txt2)]">
                      <div className="max-w-[220px] truncate" title={row.reference}>
                        {row.reference}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--txt2)]">{row.quantityLabel}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-[var(--txt)]">
                      {formatCOPCompact(row.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-[8px] border border-white/8 bg-white/[0.03] px-3 py-4 text-sm text-[var(--txt2)]">
            {selectedCategory ? "No hay movimientos para esta selección." : "Selecciona una fila para ver el detalle."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SnapshotSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={`group-skeleton-${index}`}>
            <CardHeader className="gap-2">
              <div className="skeleton h-4 w-40 rounded-full" />
              <div className="skeleton h-3 w-52 rounded-full" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, itemIndex) => (
                  <div key={`tile-skeleton-${index}-${itemIndex}`} className="rounded-[12px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="skeleton h-3 w-24 rounded-full" />
                    <div className="mt-2 skeleton h-7 w-28 rounded-[8px]" />
                    <div className="mt-2 skeleton h-3 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`cross-skeleton-${index}`} className="rounded-[12px] border border-white/8 bg-white/[0.03] p-4">
            <div className="skeleton h-3 w-24 rounded-full" />
            <div className="mt-2 skeleton h-7 w-20 rounded-[8px]" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`status-skeleton-${index}`} className="rounded-[12px] border border-white/8 bg-white/[0.03] p-4">
            <div className="skeleton h-3 w-24 rounded-full" />
            <div className="mt-2 skeleton h-3 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ConsolidatedSnapshotPanel({
  comprasSummary,
  ventasSummary,
  purchaseRows = [],
  purchaseRanking = [],
  salesRows = [],
  purchaseStatus = [],
  salesStatus = [],
  isLoading = false,
  hasData = true,
}) {
  const purchaseEntities = useMemo(() => buildPurchaseEntities(purchaseRows, purchaseRanking), [purchaseRows, purchaseRanking]);
  const salesEntities = useMemo(() => buildSalesEntities(salesRows), [salesRows]);
  const [selectedPurchaseKey, setSelectedPurchaseKey] = useState(null);
  const [selectedSaleKey, setSelectedSaleKey] = useState(null);
  const [selectedPurchaseCategory, setSelectedPurchaseCategory] = useState(null);
  const [selectedSaleCategory, setSelectedSaleCategory] = useState(null);

  const activePurchase = selectedPurchaseKey
    ? purchaseEntities.find((row) => row.key === selectedPurchaseKey) || purchaseEntities[0] || null
    : purchaseEntities[0] || null;
  const activeSale = selectedSaleKey
    ? salesEntities.find((row) => row.key === selectedSaleKey) || salesEntities[0] || null
    : salesEntities[0] || null;
  const purchaseBreakdown = useMemo(
    () => buildCategoryBreakdown({ rows: purchaseRows, selected: activePurchase, type: "purchase" }),
    [purchaseRows, activePurchase]
  );
  const salesBreakdown = useMemo(
    () => buildCategoryBreakdown({ rows: salesRows, selected: activeSale, type: "sale" }),
    [salesRows, activeSale]
  );
  const activePurchaseCategory = selectedPurchaseCategory
    ? purchaseBreakdown.find((row) => row.key === selectedPurchaseCategory.key) || purchaseBreakdown[0] || null
    : purchaseBreakdown[0] || null;
  const activeSaleCategory = selectedSaleCategory
    ? salesBreakdown.find((row) => row.key === selectedSaleCategory.key) || salesBreakdown[0] || null
    : salesBreakdown[0] || null;
  const purchaseMovementRows = useMemo(
    () =>
      buildCategoryRows({
        rows: purchaseRows,
        selectedEntity: activePurchase,
        selectedCategory: activePurchaseCategory,
        type: "purchase",
      }),
    [purchaseRows, activePurchase, activePurchaseCategory]
  );
  const salesMovementRows = useMemo(
    () =>
      buildCategoryRows({
        rows: salesRows,
        selectedEntity: activeSale,
        selectedCategory: activeSaleCategory,
        type: "sale",
      }),
    [salesRows, activeSale, activeSaleCategory]
  );

  if (isLoading) {
    return <SnapshotSkeleton />;
  }

  if (!hasData) {
    return (
      <Card>
        <CardContent className="pt-5 text-sm text-[var(--txt2)]">
          El consolidado necesita datos de compras y ventas para mostrar el resumen.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <FormulaRow
          title="Cómo se lee compras"
          first={{
            label: "Facturas",
            value: formatCOPCompact(comprasSummary.purchaseInvoiceTotal),
            helper: `${formatInteger(comprasSummary.purchaseInvoiceCount)} documentos`,
            tone: "amber",
          }}
          second={{
            label: "Notas crédito",
            value: formatCOPCompact(comprasSummary.creditNoteTotal),
            helper: `${formatInteger(comprasSummary.creditNoteCount)} ajust?s`,
            tone: "danger",
          }}
          result={{
            label: "Compra neta",
            value: formatCOPCompact(comprasSummary.netTotal),
            helper: "Resultado mostrado",
            tone: "green",
          }}
        />
        <FormulaRow
          title="Cómo se lee ventas"
          first={{
            label: "Facturación bruta",
            value: formatCOPCompact(ventasSummary.purchaseInvoiceTotal),
            helper: `${formatInteger(ventasSummary.purchaseInvoiceCount)} facturas`,
            tone: "amber",
          }}
          second={{
            label: "Notas crédito",
            value: formatCOPCompact(ventasSummary.creditNoteTotal),
            helper: `${formatInteger(ventasSummary.creditNoteCount)} NC`,
            tone: "danger",
          }}
          result={{
            label: "Venta neta",
            value: formatCOPCompact(ventasSummary.netTotal),
            helper: "Resultado mostrado",
            tone: "green",
          }}
        />
      </div>

      <div className="grid gap-4">
        <ValueComparisonChart comprasSummary={comprasSummary} ventasSummary={ventasSummary} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <EntityCard
          title="Compras por proveedor"
          subtitle="Selecciona un proveedor para ver qué se compró."
          rows={purchaseEntities}
          selected={activePurchase}
          onSelect={(row) => {
            setSelectedPurchaseKey(row.key);
            setSelectedPurchaseCategory(null);
          }}
          emptyText="No hay proveedores para este periodo."
        />
        <EntityCard
          title="Ventas por cliente"
          subtitle="Selecciona un cliente para ver qué se vendió o ajustó."
          rows={salesEntities}
          selected={activeSale}
          onSelect={(row) => {
            setSelectedSaleKey(row.key);
            setSelectedSaleCategory(null);
          }}
          emptyText="No hay clientes para este periodo."
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CategoryDetailCard
          key={`purchase-category-${activePurchase?.key || "none"}`}
          selected={activePurchase}
          type="purchase"
          rows={purchaseBreakdown}
          selectedCategory={activePurchaseCategory}
          onSelectCategory={setSelectedPurchaseCategory}
        />
        <CategoryDetailCard
          key={`sale-category-${activeSale?.key || "none"}`}
          selected={activeSale}
          type="sale"
          rows={salesBreakdown}
          selectedCategory={activeSaleCategory}
          onSelectCategory={setSelectedSaleCategory}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <MovementDetailCard
          key={`purchase-movement-${activePurchase?.key || "none"}-${activePurchaseCategory?.key || "none"}`}
          selectedEntity={activePurchase}
          selectedCategory={activePurchaseCategory}
          type="purchase"
          rows={purchaseMovementRows}
        />
        <MovementDetailCard
          key={`sale-movement-${activeSale?.key || "none"}-${activeSaleCategory?.key || "none"}`}
          selectedEntity={activeSale}
          selectedCategory={activeSaleCategory}
          type="sale"
          rows={salesMovementRows}
        />
      </div>
    </div>
  );
}
