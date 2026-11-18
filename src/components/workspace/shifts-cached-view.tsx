"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { SectionRefreshButton } from "@/components/ui/section-refresh-button";
import { WorkspaceSectionSkeleton } from "@/components/ui/workspace-skeleton";
import {
  ShiftsManager,
  type ShiftSessionRecord,
  type TerminalOption,
} from "@/components/shifts/shifts-manager";
import { closeShiftAction, openShiftAction } from "@/app/(workspace)/shifts/actions";
import {
  fetchWorkspaceApi,
  invalidateWorkspaceCaches,
  workspaceQueryKeys,
} from "@/lib/query/cache-keys";

interface ShiftsSectionPayload {
  terminals: TerminalOption[];
  sessions: ShiftSessionRecord[];
}

export function ShiftsCachedView() {
  const queryClient = useQueryClient();
  const queryKey = workspaceQueryKeys.shifts();

  const { data, isPending, isFetching, dataUpdatedAt } =
    useQuery<ShiftsSectionPayload>({
      queryKey,
      queryFn: () => fetchWorkspaceApi<ShiftsSectionPayload>("shifts"),
    });

  const handleForceRefresh = async () => {
    const fresh = await queryClient.fetchQuery({
      queryKey,
      queryFn: () =>
        fetchWorkspaceApi<ShiftsSectionPayload>("shifts", { fresh: true }),
      staleTime: 0,
    });
    queryClient.setQueryData(queryKey, fresh);
  };

  const withRefresh =
    <Args extends unknown[]>(fn: (...args: Args) => Promise<void>) =>
    async (...args: Args) => {
      await fn(...args);
      await invalidateWorkspaceCaches(queryClient, "shift");
    };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Register Handoffs & Cash Audit"
        title="Shifts & Cash Drawer Reconciliation"
        description="Optional shift handoffs (08:00–16:00 and 16:00–00:00) with complete earnings, till cash, and bank breakdown."
        actions={
          <SectionRefreshButton
            onRefresh={handleForceRefresh}
            isFetching={isFetching}
            lastUpdatedAt={dataUpdatedAt}
          />
        }
      />

      {isPending && !data ? (
        <WorkspaceSectionSkeleton cards={3} rows={6} />
      ) : data ? (
        <ShiftsManager
          terminals={data.terminals}
          sessions={data.sessions}
          onOpenShift={withRefresh(openShiftAction)}
          onCloseShift={withRefresh(closeShiftAction)}
        />
      ) : null}
    </div>
  );
}
