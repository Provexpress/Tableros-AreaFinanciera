import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/utils/cn";

const toneMap = {
  blue: "before:bg-[var(--tec)]",
  green: "before:bg-[var(--pac)]",
  amber: "before:bg-[var(--gasto)]",
  purple: "before:bg-[var(--serv)]",
};

function resolveTrendTone(trend, trendDirection) {
  if (trend == null || trend === 0 || trendDirection === "neutral") {
    return "text-[var(--txt3)]";
  }

  if (trendDirection === "higher-is-better") {
    return trend > 0 ? "text-[var(--success)]" : "text-[var(--danger)]";
  }

  if (trendDirection === "lower-is-better") {
    return trend < 0 ? "text-[var(--success)]" : "text-[var(--danger)]";
  }

  return trend > 0 ? "text-[var(--success)]" : "text-[var(--danger)]";
}

export default function KpiCard({
  label,
  value,
  sub,
  trend,
  accentColor = "blue",
  trendDirection = "neutral",
  size = "default",
  className,
  isLoading = false,
}) {
  const TrendIcon =
    trend == null ? Minus : trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : Minus;
  const trendColor = resolveTrendTone(trend, trendDirection);
  const [isUpdated, setIsUpdated] = useState(false);
  const previousValueRef = useRef(value);

  useEffect(() => {
    if (previousValueRef.current == null) {
      previousValueRef.current = value;
      return;
    }

    if (previousValueRef.current !== value) {
      previousValueRef.current = value;
      setIsUpdated(true);

      const timeout = window.setTimeout(() => setIsUpdated(false), 700);
      return () => window.clearTimeout(timeout);
    }

    return undefined;
  }, [value]);

  if (isLoading) {
    return (
      <Card
        className={cn(
          "relative overflow-hidden before:absolute before:right-0 before:top-0 before:h-full before:w-[3px]",
          toneMap[accentColor] || toneMap.blue,
          className
        )}
      >
        <CardContent className={cn("min-w-0 space-y-3", size === "hero" ? "p-5" : "p-4")}>
          <div className="skeleton h-3 w-28 rounded-full" />
          <div className={cn("skeleton rounded-[8px]", size === "hero" ? "h-10 w-3/4" : "h-8 w-2/3")} />
          <div className="skeleton h-3 w-32 rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "relative overflow-hidden before:absolute before:right-0 before:top-0 before:h-full before:w-[3px]",
        "transition-all duration-200 hover:translate-y-[-2px] hover:border-[rgba(21,101,192,0.2)] hover:shadow-[0_18px_38px_rgba(26,43,107,0.12)]",
        toneMap[accentColor] || toneMap.blue,
        className
      )}
    >
      <CardContent className={cn("min-w-0 space-y-2", size === "hero" ? "p-5 md:p-6" : "p-4")}>
        <div className="truncate text-[11px] uppercase tracking-[0.08em] text-[var(--txt3)]" title={label}>
          {label}
        </div>
        <div
          className={cn(
            size === "hero"
              ? "break-words font-mono text-[clamp(1.6rem,2.5vw,2.25rem)] font-medium leading-tight tracking-[-0.04em] text-[var(--txt)] [font-variant-numeric:tabular-nums]"
              : "break-words font-mono text-[clamp(1.3rem,1.8vw,1.75rem)] font-medium leading-tight tracking-[-0.04em] text-[var(--txt)] [font-variant-numeric:tabular-nums]",
            isUpdated && "value-updated"
          )}
        >
          {value}
        </div>
        <div className={cn("flex min-w-0 items-start gap-1.5", size === "hero" ? "text-xs" : "text-[11px]", trendColor)}>
          {trend != null && <TrendIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          <span className="min-w-0 leading-snug">{sub}</span>
        </div>
      </CardContent>
    </Card>
  );
}
