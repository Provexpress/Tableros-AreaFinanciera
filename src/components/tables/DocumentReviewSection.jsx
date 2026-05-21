import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableCell, TableHead } from "@/components/ui/table";
import { formatCOPFull, formatDate, formatInteger } from "@/utils/formatters";

function getDocumentAmount(row) {
  return Math.abs(Number(row.totalOriginal ?? row.total ?? 0));
}

function getDocumentNumber(row) {
  return row.numeroDocumento || row.folio || "-";
}

const INITIAL_VISIBLE_ROWS = 8;
const LOAD_MORE_STEP = 50;

function DocumentTable({ title, subtitle, rows, numberLabel, entityLabel = "Proveedor" }) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ROWS);
  const visibleRows = rows.slice(0, visibleCount);
  const hasMoreRows = visibleCount < rows.length;

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_ROWS);
  }, [rows]);

  return (
    <Card className="h-full">
      <CardHeader className="gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <p className="text-sm text-[var(--txt2)]">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--txt3)]">
          <span className="shrink-0 font-mono text-[var(--txt2)]">
            {formatInteger(visibleRows.length)} / {formatInteger(rows.length)}
          </span>
          {hasMoreRows ? (
            <button
              type="button"
              onClick={() => setVisibleCount((current) => Math.min(current + LOAD_MORE_STEP, rows.length))}
              className="rounded-[8px] border border-[rgba(26,43,107,0.1)] bg-white px-3 py-1.5 text-[var(--txt2)] transition-colors hover:border-[rgba(21,101,192,0.2)] hover:bg-[var(--surface-2)] hover:text-[var(--txt)]"
            >
              Ver mas
            </button>
          ) : null}
          {visibleCount > INITIAL_VISIBLE_ROWS ? (
            <button
              type="button"
              onClick={() => setVisibleCount(INITIAL_VISIBLE_ROWS)}
              className="rounded-[8px] border border-[rgba(26,43,107,0.1)] bg-white px-3 py-1.5 text-[var(--txt2)] transition-colors hover:border-[rgba(21,101,192,0.2)] hover:bg-[var(--surface-2)] hover:text-[var(--txt)]"
            >
              Ver menos
            </button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[360px] max-w-full overflow-auto rounded-[10px] border border-[rgba(26,43,107,0.1)]">
          <Table className="min-w-[620px] table-fixed">
            <thead>
              <tr>
                <TableHead className="w-[92px]">Fecha</TableHead>
                <TableHead className="w-[38%]">{entityLabel}</TableHead>
                <TableHead className="w-[152px]">{numberLabel}</TableHead>
                <TableHead className="w-[148px] text-right">Monto</TableHead>
              </tr>
            </thead>
            <tbody>
              {!visibleRows.length ? (
                <tr>
                  <TableCell colSpan={4} className="py-7 text-center text-sm text-[var(--txt3)]">
                    Sin documentos para los filtros actuales.
                  </TableCell>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr key={row.id} className="bg-white even:bg-[var(--surface-3)] hover:bg-[var(--surface-2)]">
                    <TableCell className="whitespace-nowrap">{formatDate(row.fecha)}</TableCell>
                    <TableCell className="text-[var(--txt)]">
                      <div className="truncate" title={row.proveedor}>
                        {row.proveedor}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[var(--txt2)]">
                      <div className="truncate" title={getDocumentNumber(row)}>
                        {getDocumentNumber(row)}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono text-[var(--txt)] [font-variant-numeric:tabular-nums]">
                      {formatCOPFull(getDocumentAmount(row))}
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

export default function DocumentReviewSection({
  purchaseRows = [],
  creditRows = [],
  labels = {
    invoiceTitle: "Facturas de compra (FC)",
    invoiceSubtitle: "Facturas de proveedores registradas en el periodo.",
    creditTitle: "Notas crédito de compras (NC)",
    creditSubtitle: "Documentos de ajuste de compras registrados en el periodo.",
    entity: "Proveedor",
    invoiceNumber: "Número factura",
    creditNumber: "Número doc.",
  },
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 2xl:grid-cols-2">
        <DocumentTable
          title={labels.invoiceTitle}
          subtitle={labels.invoiceSubtitle}
          rows={purchaseRows}
          numberLabel={labels.invoiceNumber}
          entityLabel={labels.entity}
        />
        <DocumentTable
          title={labels.creditTitle}
          subtitle={labels.creditSubtitle}
          rows={creditRows}
          numberLabel={labels.creditNumber}
          entityLabel={labels.entity}
        />
      </div>
    </div>
  );
}
