"use client";

import type { QueryClient } from "@tanstack/react-query";
import { fetchWorkspaceApi, workspaceQueryKeys } from "@/lib/query/cache-keys";

const ROUTE_PREFETCH_MAP: Record<
  string,
  { queryKey: readonly unknown[]; apiPath: string }
> = {
  "/dashboard": {
    queryKey: workspaceQueryKeys.dashboard("last_30_days"),
    apiPath: "dashboard?period=last_30_days",
  },
  "/dashboard/closing": {
    queryKey: workspaceQueryKeys.closing(),
    apiPath: "closing",
  },
  "/pos": {
    queryKey: workspaceQueryKeys.pos(),
    apiPath: "pos",
  },
  "/sales": {
    queryKey: workspaceQueryKeys.sales(200),
    apiPath: "sales?limit=200",
  },
  "/inventory": {
    queryKey: workspaceQueryKeys.inventory(),
    apiPath: "inventory",
  },
  "/expenses": {
    queryKey: workspaceQueryKeys.expenses(),
    apiPath: "expenses",
  },
  "/finance": {
    queryKey: workspaceQueryKeys.finance(),
    apiPath: "finance",
  },
  "/employees": {
    queryKey: workspaceQueryKeys.employees(),
    apiPath: "employees",
  },
  "/staff": {
    queryKey: workspaceQueryKeys.employees(),
    apiPath: "staff",
  },
  "/shifts": {
    queryKey: workspaceQueryKeys.shifts(),
    apiPath: "shifts",
  },
  "/customers": {
    queryKey: workspaceQueryKeys.customers(),
    apiPath: "customers",
  },
  "/reports": {
    queryKey: workspaceQueryKeys.reports("this_month"),
    apiPath: "reports?period=this_month",
  },
  "/audit": {
    queryKey: workspaceQueryKeys.audit(100),
    apiPath: "audit?limit=100",
  },
};

export function prefetchWorkspaceRoute(queryClient: QueryClient, href: string) {
  const entry = ROUTE_PREFETCH_MAP[href];
  if (!entry) return;
  void queryClient.prefetchQuery({
    queryKey: entry.queryKey,
    queryFn: () => fetchWorkspaceApi(entry.apiPath),
    staleTime: 60 * 1000,
  });
}

export function prefetchDashboardPeriod(
  queryClient: QueryClient,
  period: string,
  start?: string,
  end?: string
) {
  const params = new URLSearchParams({ period });
  if (start) params.set("start", start);
  if (end) params.set("end", end);

  void queryClient.prefetchQuery({
    queryKey: workspaceQueryKeys.dashboard(period, start, end),
    queryFn: () => fetchWorkspaceApi(`dashboard?${params.toString()}`),
    staleTime: 60 * 1000,
  });
}
