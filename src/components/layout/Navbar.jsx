import { forwardRef, useRef } from "react";
import { NavLink } from "react-router-dom";
import { Menu, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

const Navbar = forwardRef(function Navbar({
  routes,
  title,
  isLoading,
  onUpload,
  onToggleSidebar,
}, ref) {
  const inputRef = useRef(null);

  return (
    <header
      ref={ref}
      role="banner"
      className="sticky top-0 z-30 border-b border-white/5 bg-[color:rgb(var(--bg-rgb)_/_0.92)] backdrop-blur"
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

            <div className={cn(
              "min-w-0 truncate text-sm font-medium text-[var(--txt)] sm:text-base",
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
                          ? "border-[var(--tec)]/35 bg-[color:rgb(79_142_247_/_0.12)] text-[var(--txt)] shadow-sm"
                          : "border-white/10 bg-[var(--surface)] text-[var(--txt2)] hover:border-white/20 hover:bg-[var(--surface-2)] hover:text-[var(--txt)] hover:shadow-sm"
                      )
                    }
                  >
                    {route.label}
                  </NavLink>
                ))}
              </div>
            </nav>

            {onUpload ? (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      onUpload(file);
                    }
                    event.target.value = "";
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                  disabled={isLoading}
                  className="disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {isLoading ? "Cargando..." : "Cargar"}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
});

export default Navbar;
