import * as React from "react";
import { AlertCircle, CheckCircle2, Inbox, Loader2 } from "lucide-react";

export function LoadingState({
  label = "Loading TechnoWorld OS...",
}: {
  label?: string;
}) {
  return (
    <div className="glass-card flex flex-col items-center justify-center rounded-2xl px-6 py-12 text-center space-y-5">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--primary)] border border-[var(--primary)]/20 shadow-[inset_0_1px_0_var(--glass-highlight)]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-[var(--foreground)]">{label}</p>
        <p className="text-xs text-[var(--foreground-secondary)]">
          Synchronizing live ledger &amp; store telemetry
        </p>
      </div>
      <div className="w-full max-w-sm space-y-2 pt-1">
        <div className="tw-skeleton h-3 w-full rounded-full" />
        <div className="tw-skeleton h-3 w-4/5 mx-auto rounded-full" />
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass-card flex flex-col items-center justify-center rounded-2xl border-dashed px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--primary)] border border-[var(--primary)]/20 shadow-[inset_0_1px_0_var(--glass-highlight)]">
        <Inbox className="h-6 w-6" />
      </div>
      <h4 className="mt-4 font-display text-base font-bold text-[var(--foreground)]">
        {title}
      </h4>
      <p className="mt-1 max-w-md text-xs sm:text-sm text-[var(--foreground-secondary)]">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatusAlert({
  type,
  title,
  message,
}: {
  type: "success" | "error";
  title: string;
  message: string;
}) {
  const isSuccess = type === "success";
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-xs sm:text-sm backdrop-blur-md shadow-[inset_0_1px_0_var(--glass-highlight)] ${
        isSuccess
          ? "border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]"
          : "border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
      ) : (
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
      )}
      <div className="min-w-0">
        <p className="font-bold">{title}</p>
        <p className="mt-0.5 opacity-90 break-words">{message}</p>
      </div>
    </div>
  );
}
