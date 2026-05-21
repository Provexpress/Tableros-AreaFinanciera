import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] transition-all duration-150",
  {
    variants: {
      variant: {
        default: "border-[rgba(26,43,107,0.12)] bg-[var(--surface-3)] text-[var(--txt2)] hover:bg-[var(--surface-2)]",
        tech: "border-[var(--tec)]/30 bg-[color:rgb(79_142_247_/_0.12)] text-[var(--tec)] hover:border-[var(--tec)]/45",
        pac: "border-[var(--pac)]/30 bg-[color:rgb(52_200_138_/_0.12)] text-[var(--pac)] hover:border-[var(--pac)]/45",
        gasto: "border-[var(--gasto)]/30 bg-[color:rgb(245_166_35_/_0.12)] text-[var(--gasto)] hover:border-[var(--gasto)]/45",
        servicios: "border-[var(--serv)]/30 bg-[color:rgb(167_139_250_/_0.12)] text-[var(--serv)] hover:border-[var(--serv)]/45",
        pactec: "border-[var(--pactec)]/30 bg-[color:rgb(31_203_203_/_0.12)] text-[var(--pactec)] hover:border-[var(--pactec)]/45",
        nocat: "border-[var(--warning)]/30 bg-[color:rgb(245_166_35_/_0.12)] text-[var(--warning)] hover:border-[var(--warning)]/45",
        success: "border-[var(--success)]/30 bg-[color:rgb(52_200_138_/_0.12)] text-[var(--success)] hover:border-[var(--success)]/45",
        warning: "border-[var(--warning)]/30 bg-[color:rgb(245_166_35_/_0.12)] text-[var(--warning)] hover:border-[var(--warning)]/45",
        danger: "border-[var(--danger)]/30 bg-[color:rgb(224_92_92_/_0.12)] text-[var(--danger)] hover:border-[var(--danger)]/45",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
