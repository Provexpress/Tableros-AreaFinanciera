import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFacturasStore } from "@/store/useFacturasStore";
import DetalleFacturas from "@/views/DetalleFacturas";
import ResumenEjecutivo from "@/views/ResumenEjecutivo";

export default function Dashboard({ isLoading = false }) {
  const [showDetail, setShowDetail] = useState(false);
  const [shouldScrollDetail, setShouldScrollDetail] = useState(false);
  const detailRef = useRef(null);
  const filters = useFacturasStore((state) => state.filters);
  const setFilters = useFacturasStore((state) => state.setFilters);

  useEffect(() => {
    if (!showDetail || !shouldScrollDetail) {
      return;
    }
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setShouldScrollDetail(false);
  }, [showDetail, shouldScrollDetail]);

  function handleSelectCategory(category) {
    setFilters({ category: filters.category === category ? "ALL" : category, provider: "" });
  }

  function handleSelectProvider(provider) {
    setFilters({ provider: filters.provider === provider ? "" : provider });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-[var(--txt)]">Compras</h1>
      </div>

      <ResumenEjecutivo
        isLoading={isLoading}
        onSelectCategory={handleSelectCategory}
        onSelectProvider={handleSelectProvider}
      />

      <section ref={detailRef} className="stagger-item stagger-delay-3">
        {showDetail ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-[8px] border border-white/8 bg-[var(--surface)]/60 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[var(--tec)]" />
                <span className="text-sm font-medium text-[var(--txt)]">Detalle auditable de compras</span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setShowDetail(false)}>
                Ocultar
              </Button>
            </div>
            <DetalleFacturas />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDetail(true)}
            className="flex w-full items-center justify-between rounded-[8px] border border-dashed border-white/12 bg-[var(--surface)]/40 px-4 py-3 text-left transition-all hover:border-white/20 hover:bg-[var(--surface)]/60"
          >
            <span className="text-sm text-[var(--txt2)]">Detalle auditable de compras</span>
            <span className="text-xs text-[var(--txt3)]">Opcional · expandir</span>
          </button>
        )}
      </section>
    </div>
  );
}
