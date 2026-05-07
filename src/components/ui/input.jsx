import { cn } from "@/utils/cn";

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md border border-white/10 bg-[var(--surface-2)] px-3 text-[15px] text-[var(--txt)] outline-none transition-all duration-150 focus:border-[var(--tec)] focus:ring-2 focus:ring-[var(--tec)]/20",
        className
      )}
      {...props}
    />
  );
}
