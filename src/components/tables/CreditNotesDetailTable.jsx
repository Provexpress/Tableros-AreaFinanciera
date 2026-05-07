import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableCell, TableHead } from "@/components/ui/table";
import { cn } from "@/utils/cn";
import { formatCOPFull, formatDate } from "@/utils/formatters";

const PAGE_SIZE = 25;

function getWeekToneClasses(pctNcPercent, isSelected) {
  if (isSelected) {
    return "border-[var(--tec)] bg-[color:rgb(79_142_247_/_0.14)] text-[var(--txt)] shadow-[0_0_0_1px_rgba(79,142,247,0.18)]";
  }
  if (pctNcPercent >= 8) {
    return "border-[color:rgb(224_92_92_/_0.22)] bg-[color:rgb(224_92_92_/_0.08)] text-[color:rgb(255_219_219)] hover:border-[color:rgb(224_92_92_/_0.35)]";
  }
  if (pctNcPercent >= 5) {
    return "border-[color:rgb(245_166_35_/_0.22)] bg-[color:rgb(245_166_35_/_0.08)] text-[color:rgb(255_232_195)] hover:border-[color:rgb(245_166_35_/_0.35)]";
  }
  return "border-[color:rgb(52_200_138_/_0.18)] bg-[color:rgb(52_200_138_/_0.08)] text-[color:rgb(210_255_230)] hover:border-[color:rgb(52_200_138_/_0.3)]";
}

function getSortableValue(row, key) {
  if (key === "fecha") {
    return row.fechaInicialIso || row.monthRef || "";
  }
  if (key === "valor") {
    return Number(row.valor || 0);
  }
  return String(row[key] || "");
}

export default function CreditNotesDetailTable({
  rows,
  hasDetailContext = false,
  selectedWeekLabel,
  activeInteractionLabel = null,
  detailInteractionLabel = null,
  selectedWeek = null,
  criticalWeeks = [],
  onSelectWeek = null,
  onClearSelectedWeek = null,
  hasTacticalFilters = false,
  onClearTacticalFilters = null,
  onClearInteractionFilter = null,
}) {
  const [search, setSearch] = useState("");
  const [causeFilter, setCauseFilter] = useState("ALL");
  const [responsibleFilter, setResponsibleFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "valor", direction: "desc" });

  const causeOptions = useMemo(
    () => [...new Set(rows.map((row) => row.causa).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows]
  );
  const responsibleOptions = useMemo(
    () => [...new Set(rows.map((row) => row.asesor).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  useEffect(() => {
    setPage(1);
  }, [rows, selectedWeekLabel]);

  useEffect(() => {
    if (causeFilter !== "ALL" && !causeOptions.includes(causeFilter)) {
      setCauseFilter("ALL");
    }
  }, [causeFilter, causeOptions]);

  useEffect(() => {
    if (responsibleFilter !== "ALL" && !responsibleOptions.includes(responsibleFilter)) {
      setResponsibleFilter("ALL");
    }
  }, [responsibleFilter, responsibleOptions]);

  const filteredRows = useMemo(() => {
    const query = search.toLowerCase().trim();

    return rows.filter((row) => {
      if (causeFilter !== "ALL" && row.causa !== causeFilter) {
        return false;
      }
      if (responsibleFilter !== "ALL" && row.asesor !== responsibleFilter) {
        return false;
      }
      if (!query) {
        return true;
      }

      return [
        row.nc,
        row.factura,
        row.cliente,
        row.asesor,
        row.causa,
        row.observacion,
        row.weekLabel,
        row.fechaInicialIso,
      ]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(query));
    });
  }, [causeFilter, responsibleFilter, rows, search]);

  const sortedRows = useMemo(() => {
    const next = [...filteredRows];
    const direction = sort.direction === "asc" ? 1 : -1;

    next.sort((a, b) => {
      const valueA = getSortableValue(a, sort.key);
      const valueB = getSortableValue(b, sort.key);

      if (sort.key === "valor") {
        return (valueA - valueB) * direction;
      }

      return String(valueA).localeCompare(String(valueB)) * direction;
    });

    return next;
  }, [filteredRows, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [page, sortedRows]);
  const hasLocalFilters = Boolean(search.trim()) || causeFilter !== "ALL" || responsibleFilter !== "ALL";

  function toggleSort(key) {
    setPage(1);
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  }

  function clearLocalFilters() {
    setSearch("");
    setCauseFilter("ALL");
    setResponsibleFilter("ALL");
    setPage(1);
  }

  function exportCsv() {
    const header = ["Fecha", "Semana", "NC", "Factura", "Cliente", "Asesor", "Causa", "Valor", "Observacion"];
    const lines = sortedRows.map((row) =>
      [
        row.fechaInicialIso,
        row.weekLabel,
        row.nc,
        row.factura,
        row.cliente,
        row.asesor,
        row.causa,
        row.valor,
        row.observacion,
      ]
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );

    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "detalle_notas_credito.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="space-y-2">
          <CardTitle>Detalle de notas crédito de ventas</CardTitle>
          <p className="text-sm text-[var(--txt2)]">
            {selectedWeekLabel
              ? `Semana activa: ${selectedWeekLabel}`
              : detailInteractionLabel
                ? `Detalle abierto por ${detailInteractionLabel}.`
                : activeInteractionLabel
                  ? `Detalle del filtro tactico: ${activeInteractionLabel}.`
                  : "Seleccióna una semana o toca una causa, cliente o responsable para abrir el detalle."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeInteractionLabel ? <Badge variant="warning">Filtro activo: {activeInteractionLabel}</Badge> : null}
          {detailInteractionLabel ? <Badge variant="tech">Detalle: {detailInteractionLabel}</Badge> : null}
          {selectedWeekLabel ? <Badge variant="tech">Semana activa: {selectedWeekLabel}</Badge> : null}
          {selectedWeek ? (
            <Button variant="secondary" size="sm" onClick={onClearSelectedWeek}>
              Limpiar semana
            </Button>
          ) : null}
          {detailInteractionLabel ? (
            <Button variant="secondary" size="sm" onClick={onClearInteractionFilter}>
              Cerrar detalle
            </Button>
          ) : null}
          {hasTacticalFilters ? (
            <Button variant="secondary" size="sm" onClick={onClearTacticalFilters}>
              Limpiar filtros tacticos
            </Button>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--txt3)]">Semanas criticas</div>
          {criticalWeeks.length ? (
            <div className="-mx-1 overflow-x-auto pb-1">
              <div className="flex w-max gap-2 px-1">
                {criticalWeeks.map((week) => (
                  <button
                    key={week.key}
                    type="button"
                    onClick={() => onSelectWeek?.(week.key)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-all duration-150",
                      getWeekToneClasses(Number(week.pctNcPercent || 0), selectedWeek === week.key)
                    )}
                  >
                    {week.label} <strong className="ml-1">{week.note}</strong>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-[var(--txt3)]">No hay semanas criticas para el periodo actual.</div>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-[1fr_1fr_1.2fr_auto]">
          <Select
            value={causeFilter}
            onChange={(event) => {
              setPage(1);
              setCauseFilter(event.target.value);
            }}
          >
            <option value="ALL">Todas las causas</option>
            {causeOptions.map((cause) => (
              <option key={cause} value={cause}>
                {cause}
              </option>
            ))}
          </Select>

          <Select
            value={responsibleFilter}
            onChange={(event) => {
              setPage(1);
              setResponsibleFilter(event.target.value);
            }}
          >
            <option value="ALL">Todos los responsables</option>
            {responsibleOptions.map((responsible) => (
              <option key={responsible} value={responsible}>
                {responsible}
              </option>
            ))}
          </Select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--txt3)]" />
            <Input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Buscar factura, cliente o asesor"
              className="pl-10"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row 2xl:flex-col">
            {hasLocalFilters ? (
              <Button variant="secondary" onClick={clearLocalFilters} className="w-full">
                Limpiar tabla
              </Button>
            ) : null}
            <Button onClick={exportCsv} disabled={!rows.length} className="w-full">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="max-w-full overflow-x-auto rounded-[10px] border border-white/5">
          <Table className="min-w-[980px] table-fixed">
            <thead>
              <tr>
                <TableHead onClick={() => toggleSort("fecha")} className="w-[118px] cursor-pointer">
                  Fecha
                </TableHead>
                <TableHead onClick={() => toggleSort("factura")} className="w-[172px] cursor-pointer">
                  Factura
                </TableHead>
                <TableHead onClick={() => toggleSort("cliente")} className="w-[19%] cursor-pointer">
                  Cliente
                </TableHead>
                <TableHead onClick={() => toggleSort("asesor")} className="w-[160px] cursor-pointer">
                  Asesor
                </TableHead>
                <TableHead onClick={() => toggleSort("causa")} className="w-[160px] cursor-pointer">
                  Causa
                </TableHead>
                <TableHead onClick={() => toggleSort("valor")} className="w-[148px] cursor-pointer text-right">
                  Valor
                </TableHead>
                <TableHead onClick={() => toggleSort("observacion")} className="w-[24%] cursor-pointer">
                  Observacion
                </TableHead>
              </tr>
            </thead>
            <tbody>
              {!hasDetailContext ? (
                <tr>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-[var(--txt3)]">
                    Seleccióna una semana desde la tendencia o toca una causa, cliente o responsable para abrir el detalle.
                  </TableCell>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-[var(--txt3)]">
                    No hay notas crédito para los filtros activos en esta selección.
                  </TableCell>
                </tr>
              ) : (
                paginatedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="bg-[var(--bg)] odd:bg-[var(--bg)] even:bg-white/[0.01] transition-colors duration-150 hover:bg-[var(--surface-2)]"
                  >
                    <TableCell>
                      <div className="whitespace-nowrap text-[var(--txt)]">
                        {formatDate(row.fechaInicialIso || row.monthRef)}
                      </div>
                      <div className="truncate text-[11px] text-[var(--txt3)]" title={row.weekLabel || row.monthLabel}>
                        {row.weekLabel || row.monthLabel || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-[var(--txt2)]">
                      <div className="truncate text-[var(--txt)]" title={row.factura}>
                        {row.factura || "-"}
                      </div>
                      <div className="truncate text-[11px] text-[var(--txt3)]" title={`NC ${row.nc || "-"}`}>
                        NC {row.nc || "-"}
                        {row.reemplazadaPor ? ` -> ${row.reemplazadaPor}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-[var(--txt)]">
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
                    <TableCell>
                      <div className="truncate" title={row.observacion}>
                        {row.observacion || "-"}
                      </div>
                    </TableCell>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>

        {hasDetailContext && rows.length > 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-[var(--txt2)]">
              Pagina {page} de {totalPages}
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
                Anterior
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page === totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
