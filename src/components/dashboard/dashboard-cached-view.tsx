"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { OwnerBiDashboard } from "@/components/dashboard/owner-bi-dashboard";
import { WorkspaceSectionSkeleton } from "@/components/ui/workspace-skeleton";
import { useWorkspaceUser } from "@/lib/workspace/context";
import { fetchWorkspaceApi, workspaceQueryKeys } from "@/lib/query/cache-keys";
import { prefetchDashboardPeriod } from "@/lib/workspace/prefetch";
import type { BiPeriodKey, OwnerBiPayload } from "@/lib/dashboard/bi-engine";

const WARM_PREFETCH_PERIODS: BiPeriodKey[] = [
  "today",
  "yesterday",
  "last_7_days",
  "this_month",
  "last_month",
  "lifetime",
];

export function DashboardCachedView() {
  const sp = useSearchParams();
  const queryClient = useQueryClient();
  const user = useWorkspaceUser();

  const [period, setPeriod] = React.useState<string>(
    sp.get("period") || "last_30_days"
  );
  const [start, setStart] = React.useState<string>(sp.get("start") || "");
  const [end, setEnd] = React.useState<string>(sp.get("end") || "");

  const buildApiPath = (p: string, s: string, e: string) => {
    const params = new URLSearchParams({ period: p || "last_30_days" });
    if (s) params.set("start", s);
    if (e) params.set("end", e);
    return `dashboard?${params.toString()}`;
  };

  const queryKey = workspaceQueryKeys.dashboard(period, start, end);

  const { data, isPending, isFetching, dataUpdatedAt, error } =
    useQuery<OwnerBiPayload>({
      queryKey,
      queryFn: () => fetchWorkspaceApi<OwnerBiPayload>(buildApiPath(period, start, end)),
      placeholderData: keepPreviousData,
    });

  // Warm adjacent period filters cleanly in background once active period finishes
  React.useEffect(() => {
    if (!data) return;
    const timer = setTimeout(() => {
      for (const p of WARM_PREFETCH_PERIODS) {
        if (p !== period) {
          prefetchDashboardPeriod(queryClient, p);
        }
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [data, period, queryClient]);

  const handlePeriodChange = (
    nextPeriod: BiPeriodKey,
    nextStart?: string,
    nextEnd?: string
  ) => {
    const cleanStart = nextStart || "";
    const cleanEnd = nextEnd || "";
    setPeriod(nextPeriod);
    setStart(cleanStart);
    setEnd(cleanEnd);

    const urlParams = new URLSearchParams({ period: nextPeriod });
    if (nextPeriod === "custom" && cleanStart && cleanEnd) {
      urlParams.set("start", cleanStart);
      urlParams.set("end", cleanEnd);
    }
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/dashboard?${urlParams.toString()}`);
    }
  };

  const handlePrefetchPeriod = (p: BiPeriodKey) => {
    if (p !== "custom") {
      prefetchDashboardPeriod(queryClient, p);
    }
  };

  const handleForceRefresh = async () => {
    const freshData = await queryClient.fetchQuery({
      queryKey,
      queryFn: () =>
        fetchWorkspaceApi<OwnerBiPayload>(buildApiPath(period, start, end), {
          fresh: true,
        }),
      staleTime: 0,
    });
    queryClient.setQueryData(queryKey, freshData);
    await queryClient.invalidateQueries({
      queryKey: workspaceQueryKeys.section("dashboard"),
      refetchType: "none",
    });
  };

  if (isPending && !data) {
    return <WorkspaceSectionSkeleton cards={4} rows={7} />;
  }

  if (!data) {
    return (
      <div className="p-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-sm text-rose-500 font-semibold">
        {error instanceof Error ? error.message : "Failed to load dashboard data."}
      </div>
    );
  }

  return (
    <OwnerBiDashboard
      data={data}
      userRole={user.role}
      businessName={user.businessName}
      onPeriodChange={handlePeriodChange}
      onPrefetchPeriod={handlePrefetchPeriod}
      onForceRefresh={handleForceRefresh}
      isRefreshing={isFetching}
      lastUpdatedAt={dataUpdatedAt}
    />
  );
}
