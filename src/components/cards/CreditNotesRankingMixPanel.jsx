import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableCell, TableHead } from "@/components/ui/table";
import CreditNotesBar from "@/components/charts/CreditNotesBar";
import { formatCOPFull, formatDate, formatInteger } from "@/utils/formatters";

function sumBy(rows, field) {
  return rows.reduce((acc, row) => acc + Number(row[field] || 0), 0);
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

function ScopeCard({
  title,
  amount,
  totalCount,
  count,
  countLabel,
  helper,
  variant = "default",
  accentClass = "bg-[var(--tec)]",
  active = false,
  isLoading = false,
  onClick,
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
      className={`relative overflow-hidden cursor-pointer select-none transition-all ${
        active
          ? "border-[var(--tec)]/35 bg-[color:rgb(79_142_247_/_0.06)] shadow-[0_0_0_1px_rgba(79,142,247,0.12)]"
          : "hover:border-white/12 hover:bg-[var(--surface-2)]/45"
      }`}
    >
      <span className={`absolute left-0 top-0 h-full w-[3px] ${accentClass}`} />
      <CardContent className="min-w-0 space-y-3 p-3.5 lg:p-4">
        {isLoading ? (
          <>
            <div className="skeleton h-3 w-24 rounded-full" />
            <div className="skeleton h-8 w-40 rounded-[8px]" />
            <div className="skeleton h-3 w-36 rounded-full" />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <Badge variant={variant}>{title}</Badge>
              <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--txt3)]">
                {formatInteger(totalCount)} NC
              </span>
            </div>
            <div className="min-w-0 font-mono text-[clamp(1.1rem,1.7vw,1.5rem)] font-medium leading-tight tracking-[-0.03em] text-[var(--txt)] [font-variant-numeric:tabular-nums]">
              {formatCOPFull(amount)}
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 text-[var(--txt2)]">{countLabel}</span>
              <span className="shrink-0 font-mono text-[var(--txt)] [font-variant-numeric:tabular-nums]">
                {formatInteger(count)}
              </span>
            </div>
            {helper ? <div className="text-[11px] text-[var(--txt3)]">{helper}</div> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DetailTable({ title, selectedLabel, rows = [], totalValue = 0, isLoading = false, emptyMessage }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <p className="text-sm text-[var(--txt2)]">
            {selectedLabel ? `Detalle de ${selectedLabel}.` : "Selecciona una barra para ver el detalle asociado."}
          </p>
        </div>
        {selectedLabel ? <Badge variant="tech">{selectedLabel}</Badge> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--txt3)]">
          <span className="rounded-full border border-white/8 bg-[var(--surface)] px-2.5 py-1">
            {formatInteger(rows.length)} NC
          </span>
          <span className="rounded-full border border-white/8 bg-[var(--surface)] px-2.5 py-1">
            {formatCOPFull(totalValue)}
          </span>
        </div>

        <div className="max-h-[360px] max-w-full overflow-auto rounded-[10px] border border-white/5">
          <Table className="min-w-[880px] table-fixed">
            <thead>
              <tr>
                <TableHead className="w-[120px]">Fecha</TableHead>
                <TableHead className="w-[124px]">Semana</TableHead>
                <TableHead className="w-[120px]">NC</TableHead>
                <TableHead className="w-[148px]">Factura</TableHead>
                <TableHead className="w-[22%]">Cliente</TableHead>
                <TableHead className="w-[160px]">Asesor</TableHead>
                <TableHead className="w-[160px]">Causa</TableHead>
                <TableHead className="w-[148px] text-right">Valor</TableHead>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <TableCell colSpan={8} className="py-8">
                    <div className="skeleton h-24 rounded-[10px]" />
                  </TableCell>
                </tr>
              ) : !rows.length ? (
                <tr>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-[var(--txt3)]">
                    {emptyMessage}
                  </TableCell>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="bg-[var(--bg)] even:bg-white/[0.01] hover:bg-[var(--surface-2)]">
                    <TableCell className="whitespace-nowrap">{formatDate(row.fechaInicialIso || row.monthRef)}</TableCell>
                    <TableCell>
                      <div className="truncate" title={row.weekLabel || row.monthLabel}>
                        {row.weekLabel || row.monthLabel || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-[var(--txt)] [font-variant-numeric:tabular-nums]">
                      {row.nc || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="truncate text-[var(--txt)]" title={row.factura}>
                        {row.factura || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="truncate" title={row.cliente}>
                        {row.cliente || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="truncate" title={row.asesor}>
                        {row.asesor || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="truncate" title={row.causa}>
                        {row.causa || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono text-[var(--txt)] [font-variant-numeric:tabular-nums]">
                      {formatCOPFull(row.valor)}
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

export default function CreditNotesRankingMixPanel({
  rows = [],
  causeSummary = [],
  clientSummary = [],
  responsibleSummary = [],
  selectedWeekLabel = null,
  isLoading = false,
}) {
  const [activeScope, setActiveScope] = useState("causes");
  const [selectedItemKey, setSelectedItemKey] = useState(null);

  const scopeConfigs = useMemo(() => {
    const totalNcValue = sumBy(rows, "valor");
    const totalNcCount = rows.length;
    const uniqueClients = new Set(rows.map((row) => row.cliente || "Sin cliente")).size;
    const commercialRows = rows.filter((row) => row.origen === "Comercial");
    const commercialValue = sumBy(commercialRows, "valor");
    const commercialNcCount = commercialRows.length;
    const uniqueResponsibles = new Set(
      commercialRows.map((row) => row.asesor || "Sin responsable")
    ).size;

    return {
      causes: {
        key: "causes",
        title: "Causas con NC de ventas",
        amount: totalNcValue,
        totalCount: totalNcCount,
        count: causeSummary.length,
        countLabel: "Cantidad de causas",
        helper: selectedWeekLabel ? `Lectura de ${selectedWeekLabel}` : "Corte visible de notas credito de ventas",
        variant: "danger",
        accentClass: "bg-[var(--danger)]",
        chartTitle: "Causas de NC de ventas",
        chartSubtitle: "Conteo de notas credito de ventas por causa agrupada.",
        chartData: causeSummary.map((item) => ({ ...item, note: item.totalValue })),
        valueFormatter: (value) => `${formatInteger(value)} NC`,
        noteFormatter: (value) => `Valor asociado: ${formatCOPFull(value)}`,
        emptyMessage: "No hay causas con notas credito de ventas en el corte actual.",
        detailTitle: "Detalle de notas credito de ventas por causa",
        resolveRows: (selectedKey) =>
          rows
            .filter(buildCauseMatcher(selectedKey))
            .sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0)),
        resolveLabel: (selectedKey) =>
          causeSummary.find((item) => item.key === selectedKey)?.label || null,
      },
      clients: {
        key: "clients",
        title: "Clientes con NC de ventas",
        amount: totalNcValue,
        totalCount: totalNcCount,
        count: uniqueClients,
        countLabel: "Cantidad de clientes",
        helper: selectedWeekLabel ? `Lectura de ${selectedWeekLabel}` : "Corte visible de notas credito de ventas",
        variant: "tech",
        accentClass: "bg-[var(--tec)]",
        chartTitle: "Clientes con mas NC de ventas",
        chartSubtitle: "Ranking por cantidad de notas credito de ventas del periodo.",
        chartData: clientSummary.map((item) => ({ ...item, note: item.totalValue })),
        valueFormatter: (value) => `${formatInteger(value)} NC`,
        noteFormatter: (value) => `Valor asociado: ${formatCOPFull(value)}`,
        emptyMessage: "No hay clientes con notas credito de ventas en el corte actual.",
        detailTitle: "Detalle de notas credito de ventas por cliente",
        resolveRows: (selectedKey) =>
          rows
            .filter((row) => (row.cliente || "Sin cliente") === selectedKey)
            .sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0)),
        resolveLabel: (selectedKey) =>
          clientSummary.find((item) => item.key === selectedKey)?.label || null,
      },
      responsibles: {
        key: "responsibles",
        title: "Comerciales con NC de ventas",
        amount: commercialValue,
        totalCount: commercialNcCount,
        count: uniqueResponsibles,
        countLabel: "Cantidad de comerciales",
        helper: "Solo notas credito de ventas con causa comercial",
        variant: "warning",
        accentClass: "bg-[var(--warning)]",
        chartTitle: "Comerciales con mas NC de ventas",
        chartSubtitle: "Solo notas credito de ventas con origen comercial.",
        chartData: responsibleSummary.map((item) => ({ ...item, note: item.totalValue })),
        valueFormatter: (value) => `${formatInteger(value)} NC`,
        noteFormatter: (value) => `Valor asociado: ${formatCOPFull(value)}`,
        emptyMessage: "No hay comerciales con notas credito de ventas en el corte actual.",
        detailTitle: "Detalle de notas credito de ventas por comercial",
        resolveRows: (selectedKey) =>
          rows
            .filter(
              (row) =>
                row.origen === "Comercial" && (row.asesor || "Sin responsable") === selectedKey
            )
            .sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0)),
        resolveLabel: (selectedKey) =>
          responsibleSummary.find((item) => item.key === selectedKey)?.label || null,
      },
    };
  }, [rows, causeSummary, clientSummary, responsibleSummary, selectedWeekLabel]);

  const activeConfig = scopeConfigs[activeScope];

  useEffect(() => {
    const availableKeys = activeConfig?.chartData?.map((item) => item.key) || [];
    if (!availableKeys.length) {
      if (selectedItemKey !== null) {
        setSelectedItemKey(null);
      }
      return;
    }

    if (selectedItemKey && !availableKeys.includes(selectedItemKey)) {
      setSelectedItemKey(null);
    }
  }, [activeConfig, selectedItemKey]);

  const detailRows = useMemo(() => {
    if (!activeConfig || !selectedItemKey) {
      return [];
    }

    return activeConfig.resolveRows(selectedItemKey);
  }, [activeConfig, selectedItemKey]);

  const selectedLabel = activeConfig?.resolveLabel(selectedItemKey) || null;
  const detailTotalValue = useMemo(() => sumBy(detailRows, "valor"), [detailRows]);

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {Object.values(scopeConfigs).map((scope) => (
          <ScopeCard
            key={scope.key}
            title={scope.title}
            amount={scope.amount}
            totalCount={scope.totalCount}
            count={scope.count}
            countLabel={scope.countLabel}
            helper={scope.helper}
            variant={scope.variant}
            accentClass={scope.accentClass}
            active={activeScope === scope.key}
            isLoading={isLoading}
            onClick={() => {
              setActiveScope(scope.key);
              setSelectedItemKey(null);
            }}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <CreditNotesBar
          title={activeConfig.chartTitle}
          subtitle={activeConfig.chartSubtitle}
          data={activeConfig.chartData}
          isLoading={isLoading}
          selectedKey={selectedItemKey}
          onSelect={(key) => setSelectedItemKey((current) => (current === key ? null : key))}
          valueFormatter={activeConfig.valueFormatter}
          noteFormatter={activeConfig.noteFormatter}
          emptyMessage={activeConfig.emptyMessage}
        />

        <DetailTable
          title={activeConfig.detailTitle}
          selectedLabel={selectedLabel}
          rows={detailRows}
          totalValue={detailTotalValue}
          isLoading={isLoading}
          emptyMessage="No hay notas credito para el elemento seleccionado."
        />
      </div>
    </section>
  );
}
