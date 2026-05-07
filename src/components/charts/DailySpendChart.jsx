import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import ChartTooltip from "@/components/charts/ChartTooltip";
import { CHART_AXIS_TICK, CHART_GRID_STROKE } from "@/components/charts/chartTheme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCOP, formatCOPFull, getCurrencyTick } from "@/utils/formatters";

function formatDayLabel(value) {
  if (!value) {
    return "";
  }

  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) {
    return String(value);
  }

  return `${day}/${month}`;
}

function DailySpendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }

  return (
    <div className="chart-tooltip-panel min-w-[200px] rounded-[12px] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--txt3)]">Dia {label}</div>
      <div className="mt-2 space-y-2">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-[var(--txt2)]">{row.valueLabel || "Gasto del dia"}</span>
          <span className="chart-tooltip-value text-[var(--txt)]">{formatCOPFull(row.total)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-[var(--txt2)]">Documentos</span>
          <span className="chart-tooltip-value text-[var(--txt)]">{row.count.toLocaleString("es-CO")}</span>
        </div>
      </div>
    </div>
  );
}

export default function DailySpendChart({
  data = [],
  title = "Gasto por dia",
  subtitle = "Lectura diaria del mes activo.",
  embedded = false,
  valueLabel = "Gasto del dia",
}) {
  if (!data.length) {
    if (embedded) {
      return (
        <div className="flex min-h-[220px] items-center justify-center rounded-[8px] border border-dashed border-white/10 text-sm text-[var(--txt3)]">
          No hay dias para graficar en el mes activo.
        </div>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <p className="text-sm text-[var(--txt2)]">{subtitle}</p>
        </CardHeader>
        <CardContent className="pt-1 text-sm text-[var(--txt3)]">
          No hay dias para graficar en el mes activo.
        </CardContent>
      </Card>
    );
  }

  const chart = (
    <div className="h-[280px] overflow-hidden rounded-[10px] bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.035)_0px,rgba(255,255,255,0.035)_52px,transparent_52px,transparent_104px)]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data.map((row) => ({
            ...row,
            valueLabel,
          }))}
          margin={{ top: 8, right: 8, left: -8, bottom: 4 }}
        >
          <defs>
            <linearGradient id="dailySpendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(79, 142, 247, 0.5)" />
              <stop offset="100%" stopColor="rgba(79, 142, 247, 0.03)" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDayLabel}
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
            minTickGap={10}
          />
          <YAxis
            tick={CHART_AXIS_TICK}
            tickFormatter={getCurrencyTick}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <ChartTooltip
            cursor={{ fill: "rgba(79, 142, 247, 0.08)" }}
            labelFormatter={(value) => `Dia ${formatDayLabel(value)}`}
            content={<DailySpendTooltip />}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="rgba(79, 142, 247, 0.85)"
            strokeWidth={2}
            fill="url(#dailySpendGradient)"
            dot={false}
            activeDot={{ r: 4, fill: "var(--tec)", stroke: "var(--bg)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );

  if (embedded) {
    return chart;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-[var(--txt2)]">{subtitle}</p>
      </CardHeader>
      <CardContent className="pt-1">
        {chart}
      </CardContent>
    </Card>
  );
}
