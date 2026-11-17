import * as React from "react";
import { Loader2 } from "lucide-react";
import { twMerge } from "tailwind-merge";

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
    "bg-gradient-to-b from-[#FF7B1C] to-[#FF6A00] text-white border border-white/15 hover:from-[#FF6A00] hover:to-[#E55800] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_2px_10px_-1px_rgba(255,106,0,0.36)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_6px_18px_-2px_rgba(255,106,0,0.42)] active:translate-y-[0.5px] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
  secondary:
    "bg-[var(--brand-soft)] text-[var(--primary-hover)] dark:text-[var(--primary)] border border-[var(--primary)]/20 hover:bg-[var(--primary)]/15 hover:border-[var(--primary)]/35 shadow-[inset_0_1px_0_var(--glass-highlight)] font-semibold active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35",
  outline:
    "border border-[var(--border-strong)] bg-[var(--surface)] backdrop-blur-md text-[var(--foreground)] hover:border-[var(--primary)]/45 hover:bg-[var(--surface-elevated)] shadow-[inset_0_1px_0_var(--glass-highlight),0_1px_2px_rgba(0,0,0,0.04)] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35",
  ghost:
    "bg-transparent text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--warm)] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30",
  danger:
    "bg-gradient-to-b from-[#EF4444] to-[#DC2626] text-white border border-white/15 hover:from-[#DC2626] hover:to-[#B91C1C] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_2px_10px_-1px_rgba(220,38,38,0.32)] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]/45",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-xs font-semibold rounded-xl",
  md: "h-10 sm:h-11 px-4 sm:px-5 text-xs sm:text-sm font-semibold rounded-xl",
  lg: "h-11 sm:h-12 px-5 sm:px-6 text-sm sm:text-base font-bold rounded-xl",
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
        className={twMerge(
          "inline-flex items-center justify-center gap-2 transition-all duration-200 ease-out cursor-pointer disabled:opacity-50 disabled:pointer-events-none select-none",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
