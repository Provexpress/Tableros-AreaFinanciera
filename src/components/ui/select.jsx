import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

export function Select({ className, children, ...props }) {
  return (
    <div className="relative w-full">
      <select
        className={cn(
          "h-11 w-full appearance-none rounded-md border border-[rgba(26,43,107,0.12)] bg-white px-3 pr-10 text-[15px] text-[var(--txt)] outline-none transition-all duration-150 focus:border-[var(--tec)] focus:ring-2 focus:ring-[var(--tec)]/16",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--txt3)]" />
    </div>
  );
}
