import * as React from "react";
import { twMerge } from "tailwind-merge";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={twMerge(
        "text-xs font-semibold tracking-tight text-[var(--foreground-secondary)] cursor-pointer select-none",
        className
      )}
      {...props}
    />
  )
);
Label.displayName = "Label";
