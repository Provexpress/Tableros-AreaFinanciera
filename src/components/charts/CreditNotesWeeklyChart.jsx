import { useMemo } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ChartFrame from "@/components/charts/ChartFrame";
import ChartTooltip from "@/components/charts/ChartTooltip";
import { CHART_AXIS_TICK, CHART_GRID_STROKE, CHART_LEGEND_STYLE } from "@/components/charts/chartTheme";
import { formatCOPCompact, formatPct, getCurrencyTick } from "@/utils/formatters";

function buildTickConfig(data, width, selectedWeek) {
  const denseMode = data.length > 20;

  if (!denseMode) {
    const angle = width < 640 ? -30 : width < 1024 ? -15 : 0;

    return {
      denseMode,
      angle,
      height: width < 640 ? 68 : width < 1024 ? 60 : 42,
      textAnchor: angle === 0 ? "middle" : "end",
      formatter: (_value, index) => data[index]?.displayLabel || "",
    };
  }

  const monthStartIndexes = data.reduce((acc, entry, index) => {
    if (index === 0 || entry.monthKey !== data[index - 1]?.monthKey) {
      acc.push(index);
    }
    return acc;
  }, []);

  const maxLabels = width < 640 ? 4 : width < 1024 ? 6 : 8;
  const step = Math.max(1, Math.ceil(monthStartIndexes.length / maxLabels));
  const visibleIndexes = new Set(monthStartIndexes.filter((_item, index) => index % step === 0));

  if (monthStartIndexes.length) {
    visibleIndexes.add(monthStartIndexes[0]);
    visibleIndexes.add(monthStartIndexes[monthStartIndexes.length - 1]);
  }

  if (selectedWeek) {
    const selectedIndex = data.findIndex((entry) => entry.llave === selectedWeek);
    if (selectedIndex >= 0) {
      visibleIndexes.add(selectedIndex);
    }
  }

  return {
    denseMode,
    angle: 0,
    height: width < 640 ? 34 : 38,
    textAnchor: "middle",
    formatter: (_value, index) => {
      const entry = data[index];
      if (!entry || !visibleIndexes.has(index)) {
        return "";
      }

      if (entry.llave === selectedWeek) {
        return entry.displayLabel;
      }

      return `${entry.monthLabel} ${entry.year}`;
    },
  };
}

export default function CreditNotesWeeklyChart({
  data,
  selectedWeek,
  onSelectWeek,
  isLoading = false,
  title = "Tendencia semanal de NC",
  subtitle = "Ultimas semanas del periodo con facturacion bruta, notas credito, refacturacion y porcentaje NC.",
}) {
  const activeWeekIndex = useMemo(() => {
    if (!data.length) {
      return -1;
    }

    if (selectedWeek) {
      const selectedIndex = data.findIndex((entry) => entry.llave === selectedWeek);
      if (selectedIndex >= 0) {
        return selectedIndex;
      }
    }

    return data.length - 1;
  }, [data, selectedWeek]);

  const activeWeek = activeWeekIndex >= 0 ? data[activeWeekIndex] : null;
  const activeWeekKey = activeWeek?.llave || null;

  return (
    <Card className="h-full min-w-0">
      <CardHeader className="gap-2.5">
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-[var(--txt2)]">{subtitle}</p>
      </CardHeader>
      <CardContent className="h-[280px] min-h-[260px] sm:h-[320px] sm:min-h-[280px] lg:h-[340px]">
        {isLoading ? (
          <div className="skeleton h-full rounded-[10px]" />
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-[10px] border border-dashed border-white/10 text-sm text-[var(--txt3)]">
            No hay semanas dentro del periodo actual.
          </div>
        ) : (
          <ChartFrame zebra>
            {({ width }) => {
              const tickConfig = buildTickConfig(data, width, selectedWeek);
              const maxBarSize = tickConfig.denseMode ? 8 : 14;

              return (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_GRID_STROKE} horizontal vertical={false} />
                    <XAxis
                      dataKey="displayLabel"
                      tickLine={false}
                      axisLine={false}
                      tick={CHART_AXIS_TICK}
                      interval={0}
                      angle={tickConfig.angle}
                      textAnchor={tickConfig.textAnchor}
                      height={tickConfig.height}
                      tickFormatter={tickConfig.formatter}
                    />
                    <YAxis yAxisId="value" tickLine={false} axisLine={false} tick={CHART_AXIS_TICK} tickFormatter={getCurrencyTick} />
                    <YAxis
                      yAxisId="pct"
                      orientation="right"
                      tickLine={false}
                      axisLine={false}
                      tick={CHART_AXIS_TICK}
                      tickFormatter={(value) => `${Math.round(value)}%`}
                    />
                    <ChartTooltip
                      formatter={(value, name, props) => {
                        if (name === "% NC") {
                          return [formatPct(value, { signed: false }), name];
                        }

                        const notaCelda = props?.notaCelda;
                        const base = [formatCOPCompact(value), name];
                        if (notaCelda) {
                          return [...base, notaCelda];
                        }
                        return base;
                      }}
                      labelFormatter={(label, props) => {
                        const notaCelda = props?.[0]?.notaCelda;
                        const weekLabel = props?.[0]?.displayLabel || label;
                        if (notaCelda) {
                          return `${weekLabel}\n${notaCelda}`;
                        }
                        return weekLabel;
                      }}
                    />
                    {activeWeek ? (
                      <ReferenceLine
                        x={activeWeek.displayLabel}
                        stroke="rgba(255,255,255,0.14)"
                        strokeDasharray="4 4"
                      />
                    ) : null}
                    <Legend wrapperStyle={CHART_LEGEND_STYLE} />
                    <Bar
                      yAxisId="value"
                      dataKey="valorBruto"
                      name="Facturacion bruta"
                      fill="var(--tec)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={maxBarSize}
                      onClick={(payload) => onSelectWeek?.(payload?.llave)}
                      cursor="pointer"
                    >
                      {data.map((entry) => (
                        <Cell
                          key={`gross-${entry.llave}`}
                          fill="var(--tec)"
                          opacity={entry.llave === activeWeekKey ? 1 : 0.48}
                          stroke={entry.llave === activeWeekKey ? "rgba(255,255,255,0.32)" : "transparent"}
                          strokeWidth={entry.llave === activeWeekKey ? 1.2 : 0}
                        />
                      ))}
                    </Bar>
                    <Bar
                      yAxisId="value"
                      dataKey="valorNc"
                      name="Notas credito"
                      fill="var(--danger)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={maxBarSize}
                      onClick={(payload) => onSelectWeek?.(payload?.llave)}
                      cursor="pointer"
                    >
                      {data.map((entry) => (
                        <Cell
                          key={`nc-${entry.llave}`}
                          fill="var(--danger)"
                          opacity={entry.llave === activeWeekKey ? 1 : 0.48}
                          stroke={entry.llave === activeWeekKey ? "rgba(255,255,255,0.32)" : "transparent"}
                          strokeWidth={entry.llave === activeWeekKey ? 1.2 : 0}
                        />
                      ))}
                    </Bar>
                    <Bar
                      yAxisId="value"
                      dataKey="valorRefact"
                      name="Refacturacion"
                      fill="var(--success)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={maxBarSize}
                      onClick={(payload) => onSelectWeek?.(payload?.llave)}
                      cursor="pointer"
                    >
                      {data.map((entry) => (
                        <Cell
                          key={`refact-${entry.llave}`}
                          fill="var(--success)"
                          opacity={entry.llave === activeWeekKey ? 1 : 0.48}
                          stroke={entry.llave === activeWeekKey ? "rgba(255,255,255,0.32)" : "transparent"}
                          strokeWidth={entry.llave === activeWeekKey ? 1.2 : 0}
                        />
                      ))}
                    </Bar>
                    <Line
                      yAxisId="pct"
                      type="monotone"
                      dataKey="pctNcPercent"
                      name="% NC"
                      stroke="var(--gasto)"
                      strokeWidth={2.35}
                      dot={{ r: 2.2, fill: "var(--gasto)", stroke: "var(--bg)", strokeWidth: 1.2 }}
                      activeDot={{ r: 5, fill: "var(--gasto)", stroke: "var(--bg)", strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              );
            }}
          </ChartFrame>
        )}
      </CardContent>
    </Card>
  );
}
