import * as React from "react";
import { twMerge } from "tailwind-merge";

export function Label({
  className = "",
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={twMerge(
        "block text-xs font-semibold tracking-tight text-[var(--foreground-secondary)] mb-1.5",
        className
      )}
      {...props}
    />
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className = "", ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={twMerge(
        "h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)]/80 dark:bg-[var(--surface-secondary)]/70 px-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/75 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-150 focus:border-[var(--primary)] focus:bg-[var(--surface-solid)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 disabled:cursor-not-allowed disabled:opacity-65",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
