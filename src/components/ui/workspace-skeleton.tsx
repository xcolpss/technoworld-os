"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";

export function WorkspaceSectionSkeleton({
  cards = 4,
  rows = 6,
}: {
  cards?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Loading section">
      {cards > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: cards }).map((_, i) => (
            <Card key={i} className="border-[var(--border)] bg-[var(--surface)]">
              <CardContent className="p-4 sm:p-5 space-y-2.5">
                <div className="h-3 w-24 rounded-md bg-[var(--surface-secondary)]" />
                <div className="h-7 w-32 rounded-lg bg-[var(--surface-secondary)]" />
                <div className="h-2.5 w-20 rounded-md bg-[var(--surface-secondary)]/70" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-[var(--border)] bg-[var(--surface)]">
        <CardContent className="p-4 sm:p-6 space-y-3">
          <div className="h-5 w-48 rounded-lg bg-[var(--surface-secondary)]" />
          <div className="space-y-2.5 pt-2">
            {Array.from({ length: rows }).map((_, idx) => (
              <div
                key={idx}
                className="h-11 w-full rounded-xl bg-[var(--surface-secondary)]/75"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
