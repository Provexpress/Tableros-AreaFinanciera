import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--tec)] focus:ring-offset-2 focus:ring-offset-[var(--bg)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-white/10 bg-[var(--surface)] text-[var(--txt)] hover:bg-[var(--surface-2)] hover:border-white/15",
        secondary:
          "border-white/10 bg-transparent text-[var(--txt2)] hover:bg-white/5 hover:text-[var(--txt)] hover:border-white/15",
        ghost: "border-transparent bg-transparent text-[var(--txt2)] hover:bg-white/5 hover:text-[var(--txt)]",
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
