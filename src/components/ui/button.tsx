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
    "bg-gradient-to-b from-[#FF7714] to-[#FF6A00] text-white hover:from-[#FF6A00] hover:to-[#E65300] shadow-[0_2px_8px_rgba(255,106,0,0.32)] active:translate-y-[0.5px] focus-visible:ring-2 focus-visible:ring-brand/40",
  secondary:
    "bg-brand-soft text-brand-dark hover:bg-brand/15 font-semibold focus-visible:ring-2 focus-visible:ring-brand/30",
  outline:
    "border border-border bg-surface text-ink hover:border-brand/40 hover:bg-warm shadow-2xs focus-visible:ring-2 focus-visible:ring-brand/30",
  ghost:
    "bg-transparent text-ink hover:bg-brand-soft/70 focus-visible:ring-2 focus-visible:ring-brand/30",
  danger:
    "bg-danger text-white hover:bg-danger/90 shadow-sm focus-visible:ring-2 focus-visible:ring-danger/40",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-xs font-semibold rounded-xl",
  md: "h-11 px-5 text-sm font-semibold rounded-xl",
  lg: "h-12 px-6 text-base font-bold rounded-xl",
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
        className={`inline-flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:pointer-events-none select-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
