import * as React from "react";
import { twMerge } from "tailwind-merge";

type BadgeVariant = "brand" | "success" | "warning" | "danger" | "neutral";

const badgeStyles: Record<BadgeVariant, string> = {
  brand:
    "bg-[var(--brand-soft)] text-[var(--primary-hover)] dark:text-[var(--primary)] border-[var(--primary)]/25",
  success:
    "bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]/25",
  warning:
    "bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning)]/25",
  danger:
    "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/25",
  neutral:
    "bg-[var(--warm)] text-[var(--foreground-secondary)] border-[var(--border)]",
};

export function Badge({
  variant = "neutral",
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={twMerge(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight backdrop-blur-xs shadow-[inset_0_1px_0_var(--glass-highlight)]",
        badgeStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
