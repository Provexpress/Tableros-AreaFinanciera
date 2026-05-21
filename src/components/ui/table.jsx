import { cn } from "@/utils/cn";

export function Table({ className, ...props }) {
  return <table className={cn("w-full border-collapse", className)} {...props} />;
}

export function TableHead({ className, ...props }) {
  return (
    <th
      className={cn(
        "sticky top-0 bg-[var(--surface-2)] px-3 py-2 text-left text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--txt3)]",
        className
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }) {
  return (
    <td
      className={cn("border-t border-[rgba(26,43,107,0.08)] px-3 py-2.5 text-sm text-[var(--txt2)]", className)}
      {...props}
    />
  );
}
