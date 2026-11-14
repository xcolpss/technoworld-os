import * as React from "react";

type BadgeVariant = "brand" | "success" | "warning" | "danger" | "neutral";

const badgeStyles: Record<BadgeVariant, string> = {
  brand: "bg-brand-soft text-brand-dark border-brand/20",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/20",
  danger: "bg-danger-soft text-danger border-danger/20",
  neutral: "bg-warm text-muted border-border",
};

export function Badge({
  variant = "neutral",
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
