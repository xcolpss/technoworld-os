"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { DailyClosingClient } from "@/components/dashboard/daily-closing-client";
import { WorkspaceSectionSkeleton } from "@/components/ui/workspace-skeleton";
import { useWorkspaceUser } from "@/lib/workspace/context";
import {
  fetchWorkspaceApi,
  invalidateWorkspaceCaches,
  workspaceQueryKeys,
} from "@/lib/query/cache-keys";
import type {
  ClosingHistorySummary,
  DailyClosingRecord,
} from "@/app/(workspace)/dashboard/closing/actions";

interface ClosingPayload {
  record: DailyClosingRecord;
  history: ClosingHistorySummary[];
}

export function ClosingCachedView() {
  const sp = useSearchParams();
  const queryClient = useQueryClient();
  const user = useWorkspaceUser();
  const dateParam = sp.get("date") || "";
  const shiftParam = sp.get("shift") || "";
  const queryKey = workspaceQueryKeys.closing(dateParam || undefined, shiftParam || undefined);

  const closingQueryString = React.useMemo(() => {
    const params = new URLSearchParams();
    if (dateParam) params.set("date", dateParam);
    if (shiftParam) params.set("shift", shiftParam);
    const qs = params.toString();
    return qs ? `closing?${qs}` : "closing";
  }, [dateParam, shiftParam]);

  const { data, isPending, isFetching, dataUpdatedAt } = useQuery<ClosingPayload>({
    queryKey,
    queryFn: () => fetchWorkspaceApi<ClosingPayload>(closingQueryString),
    placeholderData: keepPreviousData,
  });

  const handleForceRefresh = async () => {
    const freshData = await queryClient.fetchQuery({
      queryKey,
      queryFn: () => fetchWorkspaceApi<ClosingPayload>(closingQueryString, { fresh: true }),
      staleTime: 0,
    });
    queryClient.setQueryData(queryKey, freshData);
  };

  if (isPending && !data) {
    return <WorkspaceSectionSkeleton cards={4} rows={6} />;
  }

  if (!data) return null;

  return (
    <DailyClosingClient
      key={`${data.record.closingDate}-${data.record.shiftLabel}-${dataUpdatedAt}`}
      initialRecord={data.record}
      initialHistory={data.history}
      businessName={user.businessName}
      userRole={user.role}
      onSavedClosing={() => invalidateWorkspaceCaches(queryClient, "closing")}
      onForceRefresh={handleForceRefresh}
      isRefreshing={isFetching}
      lastUpdatedAt={dataUpdatedAt}
    />
  );
}
