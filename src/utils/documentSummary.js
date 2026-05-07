export function calcularResumen(docs = []) {
  return docs.reduce(
    (summary, row) => {
      const docValue = Math.abs(Number(row.totalOriginal ?? row.total ?? 0));
      const netValue = Number(row.total ?? 0);
      const typeText = String(row.tipoDocNormalizado || row.tipoDoc || "").toLowerCase();
      const isCredit = Number(row.signoDocumento || 1) < 0 || typeText.includes("nota de cr");
      const isDebit = typeText.includes("nota de d");

      summary.totalNeto += netValue;

      if (isCredit) {
        summary.totalNC += docValue;
        summary.cantidadNC += 1;
      } else if (!isDebit) {
        summary.totalBruto += docValue;
        summary.cantidadFC += 1;
      }

      summary.cantidadNeta = summary.cantidadFC - summary.cantidadNC;
      return summary;
    },
    {
      totalBruto: 0,
      totalNC: 0,
      totalNeto: 0,
      cantidadFC: 0,
      cantidadNC: 0,
      cantidadNeta: 0,
    }
  );
}
