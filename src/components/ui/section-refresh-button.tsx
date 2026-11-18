"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SectionRefreshButtonProps {
  onRefresh: () => void | Promise<unknown>;
  isFetching?: boolean;
  label?: string;
  size?: "sm" | "md" | "lg";
  lastUpdatedAt?: number;
}

export function SectionRefreshButton({
  onRefresh,
  isFetching = false,
  label = "Refresh",
  size = "sm",
  lastUpdatedAt,
}: SectionRefreshButtonProps) {
  const [manualSpin, setManualSpin] = React.useState(false);
  const active = isFetching || manualSpin;

  const updatedLabel = React.useMemo(() => {
    if (!lastUpdatedAt) return null;
    try {
      return new Intl.DateTimeFormat("en-PK", {
        timeZone: "Asia/Karachi",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(new Date(lastUpdatedAt));
    } catch {
      return null;
    }
  }, [lastUpdatedAt]);

  const handleClick = async () => {
    setManualSpin(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setManualSpin(false), 250);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      {updatedLabel && (
        <span
          suppressHydrationWarning
          className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono text-[var(--muted)]"
        >
          {active ? (
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
          )}
          {active ? "Syncing..." : `Synced ${updatedLabel}`}
        </span>
      )}
      <Button
        type="button"
        variant="secondary"
        size={size}
        onClick={handleClick}
        aria-label="Fetch latest records from local database"
        className="gap-1.5 cursor-pointer"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${active ? "animate-spin text-[var(--primary)]" : ""}`} />
        <span>{active ? "Refreshing..." : label}</span>
      </Button>
    </div>
  );
}
