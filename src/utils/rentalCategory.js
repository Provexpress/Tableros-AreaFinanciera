export const RENTAL_ANALYTIC_CATEGORY = "Renta de Equipos";

const RENTAL_PATTERN = /\b(renta|alquiler|arrendamiento)\b/i;

export function containsRentalText(...values) {
  return values.some((value) =>
    RENTAL_PATTERN.test(
      String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
    )
  );
}

export function enrichRentalAnalytics(row = {}) {
  const esRenta =
    row.esRenta === true ||
    row.categoriaAnalitica === RENTAL_ANALYTIC_CATEGORY ||
    containsRentalText(
      row.categoriaOriginal,
      row.categoriaFuente,
      row.subCategoria,
      row.producto,
      row.observacion
    );

  return {
    ...row,
    categoriaOriginal: row.categoriaOriginal || null,
    categoriaAnalitica: esRenta ? RENTAL_ANALYTIC_CATEGORY : row.categoriaAnalitica || row.categoria || "Sin categoría",
    esRenta,
  };
}
