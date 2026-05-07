import { FilterX, Focus, X } from "lucide-react";
import FacturasCalendarBoard from "@/components/filters/FacturasCalendarBoard";
import NotasCalendarBoard from "@/components/filters/NotasCalendarBoard";
import VentasCalendarBoard from "@/components/filters/VentasCalendarBoard";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

function SidebarContent({
  datasetType,
  onClose,
  mobile = false,
  hasActiveFilters = false,
  focusLabel = null,
  onClearFilters = null,
  onClearFocus = null,
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {mobile ? (
        <div className="flex items-center justify-between border-b border-white/6 px-3 py-3">
          <span className="text-sm font-medium text-[var(--txt)]">Filtros</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={onClose}
            aria-label="Cerrar filtros"
            className="transition-colors duration-150"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="filter-sidebar-scroll flex-1 overflow-y-auto px-2.5 py-2.5">
        {datasetType === "comparativo" ? (
          <div className="space-y-1">
            <div className="px-1 text-[11px] uppercase tracking-[0.12em] text-[var(--txt3)]">Calendario consolidado</div>
            <FacturasCalendarBoard fixedYear="2026" />
          </div>
        ) : datasetType === "ventas" ? (
          <VentasCalendarBoard />
        ) : datasetType === "notas" ? (
          <NotasCalendarBoard />
        ) : (
          <FacturasCalendarBoard />
        )}
      </div>

      {!mobile && (hasActiveFilters || focusLabel) ? (
        <div className="border-t border-white/6 px-2.5 py-2.5">
          <div className="flex flex-wrap gap-2">
            {hasActiveFilters && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onClearFilters}
                className="text-xs transition-colors duration-150"
              >
                <FilterX className="h-3.5 w-3.5" />
                Limpiar filtros
              </Button>
            )}
            {focusLabel && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onClearFocus}
                className="text-xs transition-colors duration-150"
              >
                <Focus className="h-3.5 w-3.5" />
                Limpiar foco
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function FilterSidebar({
  datasetType = "facturas",
  mobileOpen = false,
  onClose,
  hasActiveFilters = false,
  focusLabel = null,
  onClearFilters = null,
  onClearFocus = null,
}) {
  return (
    <>
      <aside className="hidden lg:block lg:sticky lg:top-0 lg:w-[208px] lg:shrink-0 lg:self-start xl:w-[224px] 2xl:w-[248px]">
        <div className="flex h-[calc(100vh-var(--navbar-height)-20px)] max-h-[calc(100vh-var(--navbar-height)-20px)] overflow-hidden rounded-[8px] border border-white/8 bg-[var(--bg)]/82 shadow-panel backdrop-blur">
          <SidebarContent
            datasetType={datasetType}
            hasActiveFilters={hasActiveFilters}
            focusLabel={focusLabel}
            onClearFilters={onClearFilters}
            onClearFocus={onClearFocus}
          />
        </div>
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/45 backdrop-blur-[4px] transition-all duration-200 lg:hidden",
          mobileOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden={!mobileOpen}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Panel de filtros"
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(92vw,320px)] border-r border-white/8 bg-[var(--bg)] shadow-2xl transition-transform duration-300 ease-out lg:hidden sm:w-[304px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent
          datasetType={datasetType}
          onClose={onClose}
          mobile
          hasActiveFilters={hasActiveFilters}
          focusLabel={focusLabel}
          onClearFilters={onClearFilters}
          onClearFocus={onClearFocus}
        />
      </aside>
    </>
  );
}
