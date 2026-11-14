import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  Loader2,
} from "lucide-react";

export function LoadingState({
  label = "Loading TechnoWorld OS...",
}: {
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface px-6 py-12 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-brand" />
      <p className="mt-3 text-sm font-medium text-ink">{label}</p>
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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Inbox className="h-6 w-6" />
      </div>
      <h4 className="mt-4 text-base font-semibold text-ink">{title}</h4>
      <p className="mt-1 max-w-md text-sm text-muted">{description}</p>
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
      className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm ${
        isSuccess
          ? "border-success/25 bg-success-soft text-success"
          : "border-danger/25 bg-danger-soft text-danger"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
      ) : (
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
      )}
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 opacity-90">{message}</p>
      </div>
    </div>
  );
}
