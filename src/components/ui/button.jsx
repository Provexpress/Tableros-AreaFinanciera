import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--tec)] focus:ring-offset-2 focus:ring-offset-[var(--bg)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-[rgba(26,43,107,0.12)] bg-white text-[var(--txt)] shadow-[0_8px_20px_rgba(26,43,107,0.06)] hover:border-[rgba(21,101,192,0.22)] hover:bg-[var(--surface-2)]",
        secondary:
          "border-[rgba(26,43,107,0.1)] bg-[var(--surface-3)] text-[var(--txt2)] hover:border-[rgba(21,101,192,0.18)] hover:bg-[var(--surface-2)] hover:text-[var(--txt)]",
        ghost: "border-transparent bg-transparent text-[var(--txt2)] hover:bg-[var(--surface-2)] hover:text-[var(--txt)]",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export function Button({ className, variant, size, ...props }) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
