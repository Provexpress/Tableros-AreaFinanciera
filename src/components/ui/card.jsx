import { cn } from "@/utils/cn";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-[8px] border border-[rgba(26,43,107,0.12)] bg-[var(--surface)] shadow-panel",
        "transition-all duration-200 hover:border-[rgba(21,101,192,0.2)] hover:shadow-[0_16px_36px_rgba(26,43,107,0.1)]",
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
