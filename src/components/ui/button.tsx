import * as React from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-dark shadow-sm focus-visible:ring-2 focus-visible:ring-brand/40",
  secondary:
    "bg-brand-soft text-brand-dark hover:bg-brand/15 focus-visible:ring-2 focus-visible:ring-brand/30",
  outline:
    "border border-border bg-surface text-ink hover:bg-warm focus-visible:ring-2 focus-visible:ring-brand/30",
  ghost:
    "bg-transparent text-ink hover:bg-brand-soft/70 focus-visible:ring-2 focus-visible:ring-brand/30",
  danger:
    "bg-danger text-white hover:bg-danger/90 shadow-sm focus-visible:ring-2 focus-visible:ring-danger/40",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm rounded-lg",
  md: "h-11 px-4.5 text-sm font-medium rounded-xl",
  lg: "h-12 px-6 text-base font-semibold rounded-xl",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none select-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
