import { cn } from "@/utils/cn";

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md border border-[rgba(26,43,107,0.12)] bg-white px-3 text-[15px] text-[var(--txt)] outline-none transition-all duration-150 placeholder:text-[var(--txt3)] focus:border-[var(--tec)] focus:ring-2 focus:ring-[var(--tec)]/16",
        className
      )}
      {...props}
    />
  );
}
