import * as React from "react";
import { Badge } from "@/components/ui/badge";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  badge,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-1">
      <div className="space-y-1.5 min-w-0">
        {eyebrow && (
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/20 bg-[var(--brand-soft)] px-2.5 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--primary-hover)] dark:text-[var(--primary)] break-words">
              {eyebrow}
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <h1 className="font-display text-xl sm:text-2xl lg:text-[28px] font-extrabold tracking-[-0.025em] text-[var(--foreground)]">
            {title}
          </h1>
          {badge && <Badge variant="brand">{badge}</Badge>}
        </div>
        {description && (
          <p className="max-w-2xl text-xs sm:text-sm text-[var(--foreground-secondary)] leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
