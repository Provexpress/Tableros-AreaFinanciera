import { forwardRef } from "react";
import { NavLink } from "react-router-dom";
import { Clock, LogOut, Menu, UserCircle } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

const LAST_UPDATED_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const LAST_UPDATED_FULL_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  dateStyle: "medium",
  timeStyle: "short",
});

function formatLastUpdated(value, formatter) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) {
    return "";
  }

  return formatter.format(new Date(timestamp));
}

const Navbar = forwardRef(function Navbar({
  routes,
  title,
  isLoading,
  lastUpdatedAt,
  onToggleSidebar,
}, ref) {
  const { enabled: authEnabled, userEmail, signOut } = useAuth();
  const lastUpdatedLabel = formatLastUpdated(lastUpdatedAt, LAST_UPDATED_FORMATTER);
  const lastUpdatedTitle = formatLastUpdated(lastUpdatedAt, LAST_UPDATED_FULL_FORMATTER);

  return (
    <header
      ref={ref}
      role="banner"
      className="sticky top-0 z-30 border-b border-[rgba(26,43,107,0.1)] bg-[rgba(255,255,255,0.88)] shadow-[0_12px_28px_rgba(26,43,107,0.06)] backdrop-blur"
    >
      <div className="px-4 py-3 sm:px-5 lg:px-6 xl:px-8">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {onToggleSidebar ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="lg:hidden"
                onClick={onToggleSidebar}
                aria-label="Abrir filtros"
              >
                <Menu className="h-4 w-4" />
              </Button>
            ) : null}

            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-[rgba(26,43,107,0.1)] bg-white shadow-[0_8px_20px_rgba(26,43,107,0.08)]">
                <img src="/icons/provex_icon_32.png" alt="" className="h-6 w-6 object-contain" />
              </div>
              <div className={cn(
                "min-w-0 truncate text-sm font-semibold text-[var(--txt)] sm:text-base",
                isLoading && "opacity-70"
              )}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--tec)]" />
                    {title}
                  </span>
                ) : title}
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
            <nav aria-label="Navegacion principal" className="-mx-1 overflow-x-auto pb-0.5 hide-scrollbar">
              <div className="flex min-w-max gap-2 px-1">
                {routes.map((route) => (
                  <NavLink
                    key={route.to}
                    to={route.to}
                    className={({ isActive }) =>
                      cn(
                        "rounded-md border px-3 py-1.5 text-sm whitespace-nowrap transition-all duration-200",
                        isActive
                          ? "border-transparent bg-[linear-gradient(135deg,#1a2b6b_0%,#1565c0_55%,#6a3fa0_100%)] text-white shadow-[0_10px_22px_rgba(26,43,107,0.16)]"
                          : "border-[rgba(26,43,107,0.1)] bg-white text-[var(--txt2)] hover:border-[rgba(21,101,192,0.2)] hover:bg-[var(--surface-2)] hover:text-[var(--txt)] hover:shadow-sm"
                      )
                    }
                  >
                    {route.label}
                  </NavLink>
                ))}
              </div>
            </nav>

            {lastUpdatedLabel ? (
              <div
                className="flex min-w-0 items-center gap-1.5 rounded-md border border-[rgba(21,101,192,0.14)] bg-[rgba(21,101,192,0.06)] px-2 py-1.5 text-xs font-medium text-[var(--txt2)]"
                title={`Ultima actualizacion de datos: ${lastUpdatedTitle}`}
              >
                <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--tec)]" />
                <span className="whitespace-nowrap">Actualizado {lastUpdatedLabel}</span>
              </div>
            ) : null}

            {authEnabled && userEmail ? (
              <div className="flex min-w-0 items-center gap-2 rounded-md border border-[rgba(26,43,107,0.1)] bg-white px-2 py-1.5 text-sm text-[var(--txt2)] shadow-[0_8px_20px_rgba(26,43,107,0.05)]">
                <UserCircle className="h-4 w-4 shrink-0 text-[var(--tec)]" />
                <span className="max-w-[180px] truncate">{userEmail}</span>
                <button
                  type="button"
                  className="rounded-sm p-1 text-[var(--txt2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--txt)]"
                  onClick={signOut}
                  aria-label="Cerrar sesión"
                  title="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
});

export default Navbar;
