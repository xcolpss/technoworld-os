import * as React from "react";
import { twMerge } from "tailwind-merge";

export function Card({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        "glass-card glass-card-hover rounded-2xl",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        "flex flex-col gap-1 border-b border-[var(--border)] px-4 py-3.5 sm:px-6 sm:py-4.5",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={twMerge(
        "font-display text-base font-bold tracking-tight text-[var(--foreground)]",
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={twMerge(
        "text-xs sm:text-sm text-[var(--foreground-secondary)] leading-relaxed",
        className
      )}
      {...props}
    />
  );
}

export function CardContent({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge("p-4 sm:p-6", className)} {...props} />;
}
