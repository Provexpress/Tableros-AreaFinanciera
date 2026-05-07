import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceDot, ReferenceLine, XAxis, YAxis } from "recharts";
import ChartFrame from "@/components/charts/ChartFrame";
import ChartTooltip from "@/components/charts/ChartTooltip";
import { CHART_AXIS_TICK, CHART_GRID_STROKE } from "@/components/charts/chartTheme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/utils/cn";
import { formatCOPFull, formatDate, formatPeriod, formatPct, getCurrencyTick, MONTHS_SHORT } from "@/utils/formatters";

const YEAR_COLORS = {
  "2024": "var(--chart-year-2024)",
  "2025": "var(--chart-year-2025)",
  "2026": "var(--chart-year-2026)",
};

const FALLBACK_YEAR_COLORS = ["var(--tec)", "var(--pac)", "var(--gasto)", "var(--serv)", "var(--pactec)"];

function formatTickLabel(period) {
  if (!period || !/^\d{4}-\d{2}$/.test(String(period))) return String(period || "");
  const [year, month] = String(period).split("-");
  const monthLabel = MONTHS_SHORT[Number(month) - 1] || month;
  return `${monthLabel} ${String(year).slice(-2)}`;
}

function getYearColor(year, index) {
  return YEAR_COLORS[String(year)] || FALLBACK_YEAR_COLORS[index % FALLBACK_YEAR_COLORS.length];
}

function buildCompareTrend(byPeriod) {
  const visibleYears = [...new Set(byPeriod.map((item) => String(item.period || "").slice(0, 4)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const rows = MONTHS_SHORT.map((label, index) => {
    const month = String(index + 1).padStart(2, "0");
    const row = { month, monthLabel: label };
    visibleYears.forEach((year) => {
      const match = byPeriod.find((item) => item.period === `${year}-${month}`) || null;
      row[`year_${year}`] = match?.total ?? null;
      row[`period_${year}`] = match?.period ?? null;
    });
    return row;
  });
  return { rows, visibleYears };
}

function buildVisibleTrend(byPeriod, currentPeriod) {
  if (!byPeriod.length) return [];
  const activeIndex = byPeriod.findIndex((item) => item.period === currentPeriod);
  const endIndex = activeIndex >= 0 ? activeIndex : byPeriod.length - 1;
  const startIndex = Math.max(0, endIndex - 11);
  return byPeriod.slice(startIndex, endIndex + 1).map((item) => ({ ...item, tickLabel: formatTickLabel(item.period) }));
}

function getMonthShortLabel(month) {
  const monthIndex = Number(month) - 1;
  return MONTHS_SHORT[monthIndex] || `Mes ${month}`;
}

function DayTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="min-w-[180px] space-y-2 rounded-[12px] border border-white/12 bg-[var(--surface)] px-4 py-3 shadow-xl">
      <div className="text-sm font-medium text-[var(--txt)]">{row.dateLabel}</div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-[var(--txt2)]">{row.valueLabel || "Compra neta"}</span>
        <span className="font-mono text-[var(--txt)]">{formatCOPFull(row.total)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-[var(--txt2)]">Docs</span>
        <span className="font-mono text-[var(--txt)]">{row.count}</span>
      </div>
      {row.variationPct != null && (
        <div className="flex items-center justify-between gap-4 text-sm border-t border-white/8 pt-2">
          <span className="text-[var(--txt2)]">vs anterior</span>
          <span className={cn("font-mono", row.variationPct >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]")}>{formatPct(row.variationPct)}</span>
        </div>
      )}
    </div>
  );
}

function TrendTooltipContent({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="min-w-[200px] space-y-2 rounded-[12px] border border-white/12 bg-[var(--surface)] px-4 py-3 shadow-xl">
      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--txt3)]">{formatPeriod(row.period)}</div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-[var(--txt2)]">{row.valueLabel || "Compra neta"}</span>
        <span className="font-mono text-[var(--txt)]">{formatCOPFull(row.total)}</span>
      </div>
      {row.variationPct != null && (
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-[var(--txt2)]">vs anterior</span>
          <span className={cn("font-mono", row.variationPct >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]")}>{formatPct(row.variationPct)}</span>
        </div>
      )}
    </div>
  );
}

function CompareTooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((entry) => Number.isFinite(Number(entry?.value))).sort((a, b) => String(a.dataKey).localeCompare(String(b.dataKey)));
  if (!items.length) return null;
  return (
    <div className="min-w-[220px] space-y-2 rounded-[12px] border border-white/12 bg-[var(--surface)] px-4 py-3 shadow-xl">
      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--txt3)]">{label}</div>
      {items.map((item) => {
        const year = String(item.dataKey).replace("year_", "");
        return (
          <div key={item.dataKey} className="flex items-center justify-between gap-4 text-sm">
            <span className="inline-flex items-center gap-2 text-[var(--txt2)]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.stroke || getYearColor(year, 0) }} />
              {year}
            </span>
            <span className="font-mono text-[var(--txt)]">{formatCOPFull(item.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

function TrendCard({
  data = [],
  currentPeriod = null,
  summaryLabel = "",
  isLoading = false,
  compareMode = false,
  compareData = [],
  visibleYears = [],
  dailyData = [],
  dateRange = [null, null],
  selectedYear = "ALL",
  selectedMonth = "ALL",
  labels = { title: "Evolución de compra neta de compras", value: "Compra neta", daily: "Compra neta diaria", monthly: "Compra neta mensual - últimos 12 meses" },
  colors = { selected: "var(--tec)", up: "var(--success)", down: "var(--danger)", line: "var(--tec)" },
}) {
  const activeYear = currentPeriod ? String(currentPeriod).slice(0, 4) : null;
  const activeMonthLabel = currentPeriod ? MONTHS_SHORT[Number(String(currentPeriod).slice(5, 7)) - 1] || null : null;

  const isDayFilterActive = dateRange?.[0] && dateRange?.[1];
  const isSingleDaySelected = isDayFilterActive && dateRange[0] === dateRange[1];

  // Filtrar datos diarios según rango de fechas
  const filteredDailyData = useMemo(() => {
    if (!dailyData.length) return [];
    if (!isDayFilterActive) return dailyData;
    const [start, end] = dateRange;
    return dailyData.filter((d) => {
      if (start && end && start === end) return d.date === start;
      if (start && end) return d.date >= start && d.date <= end;
      if (start) return d.date >= start;
      if (end) return d.date <= end;
      return true;
    });
  }, [dailyData, dateRange, isDayFilterActive]);

  // Datos diarios con variación
  const dailyWithVariation = useMemo(() => {
    return filteredDailyData.map((item, index) => {
      const prev = filteredDailyData[index - 1];
      const prevTotal = prev?.total ?? 0;
      const variationPct = prevTotal !== 0 ? ((item.total - prevTotal) / prevTotal) * 100 : null;
      return { ...item, dateLabel: formatDate(item.date), variationPct, valueLabel: labels.value };
    });
  }, [filteredDailyData]);

  // Datos para tooltip mensual
  const tooltipData = useMemo(() =>
    data.map((item, index) => {
      const previousTotal = index > 0 ? Number(data[index - 1]?.total || 0) : null;
      return {
        ...item,
        valueLabel: labels.value,
        variationPct: previousTotal != null && previousTotal !== 0 ? ((Number(item.total || 0) - previousTotal) / previousTotal) * 100 : null,
      };
    }),
    [data]
  );

  // Determinar qué vista mostrar
  const hasMonthSelected = selectedMonth !== "ALL";
  const showDailyBars = hasMonthSelected && filteredDailyData.length > 0;
  const showSingleDay = showDailyBars && isSingleDaySelected;

  return (
    <Card className="h-full min-w-0">
      <CardHeader className="gap-1.5">
        <CardTitle>{labels.title}</CardTitle>
        <div className="text-sm text-[var(--txt2)]">
          {showSingleDay
            ? `Detalle del día ${formatDate(dateRange[0])}`
            : showDailyBars
              ? `${labels.daily} (${filteredDailyData.length} días)`
              : compareMode
                ? "Comparativo mensual por año"
                : labels.monthly}
        </div>
        <div className="break-words text-sm font-medium text-[var(--txt)]">{summaryLabel}</div>
      </CardHeader>
      <CardContent className="min-w-0">
        {isLoading ? (
          <div className="skeleton h-[320px] rounded-[8px]" />
        ) : !data.length && !filteredDailyData.length ? (
          <div className="flex h-[320px] items-center justify-center rounded-[8px] border border-dashed border-white/10 text-sm text-[var(--txt3)]">
            Sin datos para graficar en el corte activo.
          </div>
        ) : showDailyBars ? (
          <div className="space-y-3">
            {showSingleDay && filteredDailyData.length === 1 && (
              <div className="rounded-[8px] border border-[var(--tec)]/30 bg-[var(--tec)]/8 px-4 py-2">
                <span className="text-sm">Día: </span>
                <span className="font-medium">{formatDate(filteredDailyData[0].date)}</span>
                <span className="ml-3 text-sm text-[var(--txt2)]">{formatCOPFull(filteredDailyData[0].total)} ({filteredDailyData[0].count} docs)</span>
              </div>
            )}
            <div className="h-[280px] min-w-0">
              <ChartFrame zebra>
                {({ width, height }) => (
                  <BarChart width={width} height={height} data={dailyWithVariation} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                    <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 4" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => { const parts = String(v).split("-"); return parts[2] ? `${parts[2]}` : v; }}
                      tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--chart-axis)" }}
                      interval={Math.max(0, Math.floor(dailyWithVariation.length / 12) - 1)} height={30}
                    />
                    <YAxis tickLine={false} axisLine={false} tick={CHART_AXIS_TICK} tickFormatter={getCurrencyTick} width={72} />
                    <ChartTooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<DayTooltip />} />
                    <Bar dataKey="total" name={labels.value} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600}>
                      {dailyWithVariation.map((entry, index) => {
                        const isSelected = isSingleDaySelected && entry.date === dateRange[0];
                        return (
                          <Cell key={`day-${index}`}
                            fill={isSelected ? colors.selected : entry.variationPct >= 0 ? colors.up : colors.down}
                            fillOpacity={isSelected ? 1 : 0.75}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                )}
              </ChartFrame>
            </div>
            {!showSingleDay ? (
              <div className="flex items-center gap-4 text-xs text-[var(--txt3)]">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.selected }} /> Selected</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.up }} /> Up</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.down }} /> Down</span>
              </div>
            ) : null}
          </div>
        ) : compareMode ? (
          <div className="h-[320px] min-w-0">
            <ChartFrame zebra>
              {({ width, height }) => (
                <LineChart width={width} height={height} data={compareData} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 4" vertical={false} />
                  <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tick={CHART_AXIS_TICK} interval={0} height={34} />
                  <YAxis tickLine={false} axisLine={false} tick={CHART_AXIS_TICK} tickFormatter={getCurrencyTick} width={80} />
                  <ChartTooltip cursor={{ stroke: "rgba(255,255,255,0.12)", strokeDasharray: "4 4" }} content={<CompareTooltipContent />} />
                  {activeMonthLabel ? <ReferenceLine x={activeMonthLabel} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" /> : null}
                  {visibleYears.map((year, index) => (
                    <Line key={year} type="monotone" dataKey={`year_${year}`}
                      stroke={getYearColor(year, index)}
                      strokeWidth={activeYear === year ? 3 : 2.2}
                      strokeOpacity={activeYear === year ? 1 : 0.88}
                      dot={false} activeDot={{ r: 4.4, fill: getYearColor(year, index), stroke: "var(--bg)", strokeWidth: 2 }}
                      connectNulls={false} isAnimationActive animationDuration={650} animationEasing="ease-out"
                    />
                  ))}
                  {currentPeriod ? (
                    <ReferenceDot x={activeMonthLabel}
                      y={compareData.find((item) => item.monthLabel === activeMonthLabel)?.[`year_${activeYear}`]}
                      r={5} fill="var(--txt)" stroke={getYearColor(activeYear, 0)} strokeWidth={2}
                    />
                  ) : null}
                </LineChart>
              )}
            </ChartFrame>
          </div>
        ) : (
          <div className="h-[320px] min-w-0">
            <ChartFrame zebra>
              {({ width, height }) => (
                <LineChart width={width} height={height} data={tooltipData} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 4" vertical={false} />
                  <XAxis dataKey="tickLabel" tickLine={false} axisLine={false} tick={CHART_AXIS_TICK} interval="preserveStartEnd" height={34} />
                  <YAxis tickLine={false} axisLine={false} tick={CHART_AXIS_TICK} tickFormatter={getCurrencyTick} width={80} />
                  <ChartTooltip cursor={{ stroke: "rgba(255,255,255,0.12)", strokeDasharray: "4 4" }} content={<TrendTooltipContent />} />
                  <Line type="monotone" dataKey="total" stroke={colors.line} strokeWidth={2.6}
                    dot={{ r: 2.4, fill: colors.line, stroke: "var(--bg)", strokeWidth: 1.5 }}
                    activeDot={{ r: 4.4, fill: colors.line, stroke: "var(--bg)", strokeWidth: 2 }}
                    isAnimationActive animationDuration={650} animationEasing="ease-out"
                  />
                  {currentPeriod ? (
                    <ReferenceDot x={formatTickLabel(currentPeriod)}
                      y={tooltipData.find((item) => item.period === currentPeriod)?.total}
                      r={5} fill="var(--txt)" stroke={colors.line} strokeWidth={2}
                    />
                  ) : null}
                </LineChart>
              )}
            </ChartFrame>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PurchaseTrendComparison({
  byPeriod = [],
  currentPeriod = null,
  isLoading = false,
  selectedYear = "ALL",
  selectedMonth = "ALL",
  dailyTrend = [],
  dateRange = [null, null],
  labels = undefined,
  colors = undefined,
}) {
  const resolvedLabels = labels || { title: "Evolución de compra neta de compras", value: "Compra neta", daily: "Compra neta diaria", monthly: "Compra neta mensual - últimos 12 meses" };
  const resolvedColors = colors || { selected: "var(--tec)", up: "var(--success)", down: "var(--danger)", line: "var(--tec)" };
  const resolvedCurrentPeriod = currentPeriod && byPeriod.some((item) => item.period === currentPeriod)
    ? currentPeriod
    : byPeriod[byPeriod.length - 1]?.period || null;
  const compareMode = selectedYear === "ALL";
  const compareTrend = useMemo(() => buildCompareTrend(byPeriod), [byPeriod]);
  const visibleTrend = useMemo(() => buildVisibleTrend(byPeriod, resolvedCurrentPeriod), [byPeriod, resolvedCurrentPeriod]);

  const summaryLabel = useMemo(() => {
    if (!resolvedCurrentPeriod) return "Sin período activo";
    const current = byPeriod.find((p) => p.period === resolvedCurrentPeriod);
    if (!current) return "Sin datos";
    const base = `${formatPeriod(resolvedCurrentPeriod)}: ${getCurrencyTick(current.total)}`;

    if (selectedMonth !== "ALL") {
      const dayCount = dailyTrend.length;
      return `${base} | ${dayCount} días`;
    }

    const currentIndex = byPeriod.findIndex((p) => p.period === resolvedCurrentPeriod);
    const previous = currentIndex > 0 ? byPeriod[currentIndex - 1] : null;
    if (!previous) return base;
    const pct = ((current.total - previous.total) / previous.total) * 100;
    return `${base} | ${formatPct(pct)} vs ${formatPeriod(previous.period)}`;
  }, [byPeriod, resolvedCurrentPeriod, selectedMonth, dailyTrend]);

  return (
    <section className="space-y-4">
      <TrendCard
        data={visibleTrend}
        currentPeriod={resolvedCurrentPeriod}
        summaryLabel={summaryLabel}
        isLoading={isLoading}
        compareMode={compareMode}
        compareData={compareTrend.rows}
        visibleYears={compareTrend.visibleYears}
        dailyData={dailyTrend}
        dateRange={dateRange}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        labels={resolvedLabels}
        colors={resolvedColors}
      />
    </section>
  );
}
