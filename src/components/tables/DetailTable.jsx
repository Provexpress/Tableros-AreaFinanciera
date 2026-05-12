import { useMemo, useState } from "react";
import { Download, MoveRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableCell, TableHead } from "@/components/ui/table";
import { formatCOPFull, formatDate } from "@/utils/formatters";

const PAGE_SIZE = 50;

function getCategoryVariant(category) {
  if (category === "Tecnologia" || category === "TecnologÃ­a" || category === "Tecnología") return "tech";
  if (category === "PAC") return "pac";
  if (category === "Gasto") return "gasto";
  if (category === "Servicios") return "servicios";
  if (category === "Pac/tec") return "pactec";
  return "nocat";
}

function getStatusVariant(status) {
  const text = String(status || "").toLowerCase();
  if (text.includes("aprob")) return "success";
  if (text.includes("rechaz")) return "danger";
  return "warning";
}

function getDocumentTypeVariant(row) {
  return Number(row.signoDocumento || 1) < 0 ? "warning" : "tech";
}

function getDocumentTypeLabel(row) {
  const normalized = row.tipoDocNormalizado || row.tipoDoc || "Sin clasificar";
  if (Number(row.signoDocumento || 1) < 0) return "NC";
  if (String(normalized).toLowerCase().includes("factura")) return "FC";
  return normalized;
}

function csvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function DetailTable({
  rows,
  search,
  onSearchChange,
  labels = {
    title: "Detalle de documentos de compras",
    subtitle: "Facturas de compra y notas crédito filtradas",
    searchPlaceholder: "Buscar proveedor",
    entity: "Proveedor",
    fileName: "detalle_facturas.csv",
  },
}) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "fecha", direction: "desc" });

  const sortedRows = useMemo(() => {
    const next = [...rows];
    next.sort((a, b) => {
      const direction = sort.direction === "asc" ? 1 : -1;
      if (sort.key === "total") {
        return (Number(a.total || 0) - Number(b.total || 0)) * direction;
      }
      if (sort.key === "fecha") {
        return String(a.fechaIso || "").localeCompare(String(b.fechaIso || "")) * direction;
      }
      return String(a[sort.key] || "").localeCompare(String(b[sort.key] || "")) * direction;
    });
    return next;
  }, [rows, sort]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [page, sortedRows]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));

  function toggleSort(key) {
    setPage(1);
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  }

  function exportCsv() {
    const header = [
      "Tipo_Documento",
      "Numero_Documento",
      "Fecha_Documento",
      "Fecha_Registro",
      "Proveedor",
      "Categoría",
      "Estado",
      "Monto",
      "Observacion",
      "Motivo_Rechazo",
    ];
    const lines = sortedRows.map((row) =>
      [
        row.tipoDocNormalizado || row.tipoDoc,
        row.numeroDocumento || row.folio,
        row.fechaIso,
        row.fechaRecepcionIso,
        row.proveedor,
        row.categoria,
        row.estado,
        row.total,
        row.observacion,
        row.motivoRechazo,
      ]
        .map(csvValue)
        .join(",")
    );

    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = labels.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader className="gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <CardTitle>{labels.title}</CardTitle>
          <p className="text-sm text-[var(--txt2)]">{labels.subtitle} · {rows.length} registros</p>
        </div>
        <div className="flex w-full flex-col gap-3 xl:w-auto xl:flex-row">
          <div className="relative w-full xl:min-w-[240px] 2xl:min-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--txt3)]" />
            <Input
              value={search}
              onChange={(event) => {
                setPage(1);
                onSearchChange(event.target.value);
              }}
              placeholder={labels.searchPlaceholder}
              className="pl-10"
            />
          </div>
          <Button onClick={exportCsv} className="w-full xl:w-auto">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-full overflow-hidden rounded-[10px] border border-white/5">
          <div className="pointer-events-none absolute right-0 top-0 z-10 flex h-full w-12 items-center justify-end bg-gradient-to-l from-[var(--bg)] to-transparent pr-2 text-[var(--txt3)]">
            <MoveRight className="h-4 w-4" />
          </div>
          <div className="max-w-full overflow-x-auto">
          <Table className="min-w-[1120px] table-fixed">
            <thead>
              <tr>
                <TableHead className="w-[84px]">Tipo</TableHead>
                <TableHead onClick={() => toggleSort("numeroDocumento")} className="w-[136px] cursor-pointer">
                  Número
                </TableHead>
                <TableHead onClick={() => toggleSort("fecha")} className="w-[104px] cursor-pointer">
                  Fecha doc.
                </TableHead>
                <TableHead className="w-[112px]">Fecha registro</TableHead>
                <TableHead onClick={() => toggleSort("proveedor")} className="w-[21%] cursor-pointer">
                  {labels.entity}
                </TableHead>
                <TableHead onClick={() => toggleSort("categoría")} className="w-[120px] cursor-pointer">
                  Categoría
                </TableHead>
                <TableHead onClick={() => toggleSort("estado")} className="w-[124px] cursor-pointer">
                  Estado
                </TableHead>
                <TableHead onClick={() => toggleSort("total")} className="w-[148px] cursor-pointer text-right">
                  Monto
                </TableHead>
                <TableHead className="w-[25%]">Observacion / motivo</TableHead>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-[var(--txt3)]">
                    No hay documentos para los filtros actuales.
                  </TableCell>
                </tr>
              )}
              {paginated.map((row) => (
                <tr
                  key={row.id}
                  className="bg-[var(--bg)] odd:bg-[var(--bg)] even:bg-white/[0.01] transition-colors duration-150 hover:bg-[var(--surface-2)]"
                >
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={getDocumentTypeVariant(row)}>{getDocumentTypeLabel(row)}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[var(--txt)]">
                    <div className="truncate" title={row.numeroDocumento || row.folio || "-"}>
                      {row.numeroDocumento || row.folio || "-"}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(row.fecha)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(row.fechaRecepcion)}</TableCell>
                  <TableCell className="text-[var(--txt)]">
                    <div className="truncate" title={row.proveedor}>
                      {row.proveedor}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={getCategoryVariant(row.categoria)}>{row.categoria}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={getStatusVariant(row.estado)}>{row.estado}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-mono text-[var(--txt)] [font-variant-numeric:tabular-nums]">
                    {formatCOPFull(row.total)}
                  </TableCell>
                  <TableCell>
                    <div className="truncate" title={row.motivoRechazo || row.observacion}>
                      {row.motivoRechazo || row.observacion || "-"}
                    </div>
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[var(--txt2)]">
            Pagina {page} de {totalPages}
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
