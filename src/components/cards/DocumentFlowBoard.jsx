import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableCell, TableHead } from "@/components/ui/table";
import { formatCOPFull, formatDate } from "@/utils/formatters";

const STATUS_CONFIG = {
  Rechazado: { title: "Rechazadas", label: "Rechazado", variant: "danger" },
  "En revision": { title: "En revision", label: "En revision", variant: "warning" },
  Aprobado: { title: "Aprobadas", label: "Aprobado", variant: "success" },
  ALL: { title: "todos los estados", label: "Todos", variant: "default" },
};

export default function DocumentFlowBoard({
  rowsByStatus = { Rechazado: [], "En revision": [], Aprobado: [] },
  selectedStatus = "Rechazado",
  entityLabel = "Proveedor",
  layout = "default",
}) {
  const resolvedStatus = selectedStatus || "ALL";
  const config = STATUS_CONFIG[resolvedStatus] || STATUS_CONFIG.ALL;
  const selectedRows = selectedStatus
    ? rowsByStatus[selectedStatus] || []
    : Object.values(rowsByStatus).flat();
  const isSalesLayout = layout === "ventas";

  return (
    <Card className="min-w-0">
      <CardHeader className="gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <CardTitle>Detalle de {config.title.toLowerCase()}</CardTitle>
          <p className="text-sm text-[var(--txt2)]">
            Haz clic en una tarjeta de estado para cambiar el detalle operativo; repite el clic para ver todos.
          </p>
        </div>
        <Badge variant={config.variant} className="self-start lg:self-auto">
          {config.label}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="relative max-h-[360px] max-w-full overflow-hidden rounded-[10px] border border-white/5">
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-10 bg-gradient-to-l from-[var(--bg)] to-transparent" />
          <div className="max-h-[360px] max-w-full overflow-auto">
          <Table className={isSalesLayout ? "min-w-[1040px] table-fixed" : "min-w-[860px] table-fixed"}>
            <thead>
              {isSalesLayout ? (
                <tr>
                  <TableHead className="w-[104px]">Fecha</TableHead>
                  <TableHead className="w-[150px]">Doc. factura</TableHead>
                  <TableHead className="w-[136px]">Nota credito</TableHead>
                  <TableHead className="w-[24%]">{entityLabel}</TableHead>
                  <TableHead className="w-[148px] text-right">Monto factura</TableHead>
                  <TableHead className="w-[132px] text-right">Monto NC</TableHead>
                  <TableHead className="w-[132px] text-right">Total</TableHead>
                </tr>
              ) : (
                <tr>
                  <TableHead className="w-[136px]">Doc</TableHead>
                  <TableHead className="w-[28%]">{entityLabel}</TableHead>
                  <TableHead className="w-[100px]">Fecha</TableHead>
                  <TableHead className="w-[148px] text-right">Monto</TableHead>
                  <TableHead className="w-[34%]">Motivo / obs.</TableHead>
                </tr>
              )}
            </thead>
            <tbody>
              {!selectedRows.length ? (
                <tr>
                  <TableCell colSpan={isSalesLayout ? 7 : 5} className="py-8 text-center text-sm text-[var(--txt3)]">
                    Sin documentos en este estado.
                  </TableCell>
                </tr>
              ) : (
                selectedRows.map((row) => {
                  const isCredit = Number(row.signoDocumento || 1) < 0;
                  const documentValue = Math.abs(Number(row.totalOriginal ?? row.total ?? 0));
                  const invoiceNumber = isCredit ? row.validacion || row.factura || "-" : row.numeroDocumento || row.folio || "-";
                  const creditNumber = isCredit ? row.numeroDocumento || row.folio || "-" : "-";
                  const invoiceAmount = isCredit ? 0 : documentValue;
                  const creditAmount = isCredit ? documentValue : 0;

                  return (
                    <tr key={row.id} className="bg-[var(--bg)] even:bg-white/[0.01] hover:bg-[var(--surface-2)]">
                      {isSalesLayout ? (
                        <>
                          <TableCell className="whitespace-nowrap">{formatDate(row.fecha)}</TableCell>
                          <TableCell>
                            <div className="truncate text-xs text-[var(--txt)]" title={invoiceNumber}>
                              {invoiceNumber}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="truncate text-xs text-[var(--txt)]" title={creditNumber}>
                              {creditNumber}
                            </div>
                          </TableCell>
                          <TableCell className="text-[var(--txt)]">
                            <div className="truncate" title={row.proveedor}>
                              {row.proveedor}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right font-mono text-[var(--txt)] [font-variant-numeric:tabular-nums]">
                            {formatCOPFull(invoiceAmount)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right font-mono text-[var(--danger)] [font-variant-numeric:tabular-nums]">
                            {formatCOPFull(creditAmount)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right font-mono font-semibold text-[var(--txt)] [font-variant-numeric:tabular-nums]">
                            {formatCOPFull(row.total)}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <div className="space-y-1">
                              <div
                                className="truncate text-xs text-[var(--txt)]"
                                title={row.numeroDocumento || row.folio || "-"}
                              >
                                {row.numeroDocumento || row.folio || "-"}
                              </div>
                              <div
                                className="truncate text-[10px] text-[var(--txt3)]"
                                title={row.tipoDocNormalizado || row.tipoDoc || "-"}
                              >
                                {row.tipoDocNormalizado || row.tipoDoc || "-"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-[var(--txt)]">
                            <div className="truncate" title={row.proveedor}>
                              {row.proveedor}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{formatDate(row.fecha)}</TableCell>
                          <TableCell className="whitespace-nowrap text-right font-mono text-[var(--txt)] [font-variant-numeric:tabular-nums]">
                            {formatCOPFull(row.totalOriginal ?? row.total)}
                          </TableCell>
                          <TableCell>
                            <div className="truncate" title={row.motivoRechazo || row.observacion}>
                              {row.motivoRechazo || row.observacion || "-"}
                            </div>
                          </TableCell>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
