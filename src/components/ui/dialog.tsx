"use client";

import * as React from "react";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-sm tw-backdrop-in"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="glass-modal w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-[var(--foreground)]">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xs sm:text-sm text-[var(--foreground-secondary)]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-xl p-1.5 text-[var(--muted)] hover:bg-[var(--warm)] hover:text-[var(--foreground)] transition cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
