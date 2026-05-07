import { useEffect, useState } from "react";
import KpiCard from "@/components/cards/KpiCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import DetailTable from "@/components/tables/DetailTable";
import { useFacturasStore } from "@/store/useFacturasStore";
import { formatCOP } from "@/utils/formatters";

export default function DetalleFacturas() {
  const analysisData = useFacturasStore((state) => state.analysisData);
  const periods = useFacturasStore((state) => state.periods);
  const detailSummary = useFacturasStore((state) => state.detailSummary);
  const filters = useFacturasStore((state) => state.filters);
  const focusPeriod = useFacturasStore((state) => state.focusPeriod);
  const setFilters = useFacturasStore((state) => state.setFilters);
  const setFocusPeriod = useFacturasStore((state) => state.setFocusPeriod);
  const clearFilters = useFacturasStore((state) => state.clearFilters);

  const [searchInput, setSearchInput] = useState(filters.provider);

  useEffect(() => {
    setSearchInput(filters.provider);
  }, [filters.provider]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput !== filters.provider) {
        setFilters({ provider: searchInput });
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [filters.provider, searchInput, setFilters]);

  return (
    <div className="space-y-6">
      <div className="stagger-item stagger-delay-1">
        <Card>
          <CardContent className="grid gap-3 pt-5 lg:grid-cols-2 2xl:grid-cols-[1.2fr_1fr_1fr_auto]">
            <Select value={filters.category} onChange={(event) => setFilters({ category: event.target.value })}>
              <option value="ALL">Todas las categorias</option>
              <option value="Tecnología">Tecnología</option>
              <option value="PAC">PAC</option>
              <option value="Gasto">Gasto</option>
              <option value="Servicios">Servicios</option>
              <option value="Pac/tec">Pac/tec</option>
              <option value="No categorizado">No categorizado</option>
            </Select>

            <Select value={filters.status} onChange={(event) => setFilters({ status: event.target.value })}>
              <option value="ALL">Todos los estados</option>
              <option value="Aprobado">Aprobado</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Rechazado">Rechazado</option>
              <option value="En revisión">En revisión</option>
            </Select>

            <Select value={focusPeriod} onChange={(event) => setFocusPeriod(event.target.value)}>
              <option value="ALL">Todos los periodos</option>
              {periods.map((period) => (
                <option key={period} value={period}>
                  {period}
                </option>
              ))}
            </Select>

            <Button variant="secondary" onClick={clearFilters} className="w-full 2xl:w-auto">
              Limpiar filtros
            </Button>
          </CardContent>
        </Card>
      </div>

      <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3 stagger-item stagger-delay-2">
        <KpiCard
          label="Base auditable de compras"
          value={detailSummary.count.toLocaleString("es-CO")}
          sub="Registros del drill-down actual de compras"
          accentColor="blue"
        />
        <KpiCard
          label="Total neto de compras"
          value={formatCOP(detailSummary.total)}
          sub="Monto ajustado de la base filtrada de compras"
          accentColor="green"
        />
        <KpiCard
          label="Aprobacion de compras"
          value={`${detailSummary.approvalRate.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`}
          sub="Lectura rapida de compras antes de entrar al detalle"
          accentColor="purple"
        />
      </section>

      <div className="stagger-item stagger-delay-3">
        <DetailTable rows={analysisData} search={searchInput} onSearchChange={setSearchInput} />
      </div>
    </div>
  );
}
