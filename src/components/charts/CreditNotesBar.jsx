import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_BAR_DEFAULT } from "@/components/charts/chartTheme";
import { cn } from "@/utils/cn";

function getMaxValue(data) {
  return data.reduce((max, item) => Math.max(max, Number(item.value || 0)), 0) || 1;
}

export default function CreditNotesBar({
  title,
  subtitle,
  data,
  valueFormatter,
  selectedKey,
  onSelect,
  emptyMessage = "No hay datos para este corte.",
  noteFormatter,
  isLoading = false,
}) {
  const maxValue = getMaxValue(data);

  return (
    <Card className="h-full min-w-0">
      <CardHeader className="min-w-0 gap-1.5">
        <CardTitle>{title}</CardTitle>
        {subtitle ? <p className="text-sm text-[var(--txt2)]">{subtitle}</p> : null}
      </CardHeader>
      <CardContent className="min-w-0 space-y-2.5">
        {isLoading ? (
          <div className="skeleton h-[180px] rounded-[10px]" />
        ) : data.length === 0 ? (
          <div className="flex min-h-[140px] items-center justify-center rounded-[10px] border border-dashed border-white/10 text-sm text-[var(--txt3)]">
            {emptyMessage}
          </div>
        ) : (
          data.map((item) => {
            const isActive = selectedKey != null && selectedKey === item.key;
            const width = Math.max(6, Math.round((Number(item.value || 0) / maxValue) * 100));

            return (
              <button
                key={item.key}
                type="button"
                onClick={onSelect ? () => onSelect(item.key) : undefined}
                className={cn(
                  "w-full rounded-[10px] border px-3 py-3.5 text-left transition-all duration-150",
                  onSelect ? "cursor-pointer border-white/5 hover:border-white/8 hover:bg-[var(--surface-2)]/65" : "cursor-default border-white/5 bg-[var(--surface)]/18",
                  isActive ? "border-[var(--tec)]/30 bg-[color:rgb(79_142_247_/_0.08)]" : "bg-transparent"
                )}
              >
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--txt)]" title={item.label}>
                      {item.label}
                    </div>
                    {item.note ? (
                      <div className="mt-1 text-[11px] text-[var(--txt3)]">
                        {noteFormatter ? noteFormatter(item.note, item) : item.note}
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 font-mono text-sm text-[var(--txt)]">
                    {valueFormatter ? valueFormatter(item.value, item) : item.value}
                  </div>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${width}%`,
                      background: item.color || CHART_BAR_DEFAULT,
                    }}
                  />
                </div>
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
