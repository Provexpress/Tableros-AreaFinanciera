import { Tooltip } from "recharts";
import { CHART_TOOLTIP_STYLE } from "@/components/charts/chartTheme";

export default function ChartTooltip(props) {
  return (
    <Tooltip
      animationDuration={150}
      contentStyle={{ ...CHART_TOOLTIP_STYLE, ...(props.contentStyle || {}) }}
      {...props}
    />
  );
}
