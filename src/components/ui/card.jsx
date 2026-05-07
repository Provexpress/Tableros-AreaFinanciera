import { cn } from "@/utils/cn";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-[8px] border border-white/6 bg-[var(--surface)] shadow-panel",
        "transition-all duration-200 hover:border-white/10 hover:shadow-[0_2px_8px_rgba(0,0,0,0.18)]",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("flex flex-col gap-2 px-4 py-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn("text-sm font-medium text-[var(--txt)]", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn("min-w-0 px-4 pb-4", className)} {...props} />;
}
