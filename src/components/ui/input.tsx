import * as React from "react";

export function Label({
  className = "",
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`block text-sm font-medium text-ink mb-1.5 ${className}`}
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
      className={`h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-ink placeholder:text-muted/70 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-warm ${className}`}
      {...props}
    />
  );
});
Input.displayName = "Input";
