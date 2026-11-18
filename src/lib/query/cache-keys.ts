import type { QueryClient } from "@tanstack/react-query";

export type WorkspaceSection =
  | "dashboard"
  | "closing"
  | "pos"
  | "sales"
  | "inventory"
  | "expenses"
  | "finance"
  | "employees"
  | "staff"
  | "shifts"
  | "customers"
  | "reports"
  | "audit";

export const workspaceQueryKeys = {
  all: ["workspace"] as const,
  section: (section: WorkspaceSection) => ["workspace", section] as const,
  dashboard: (period?: string, start?: string, end?: string) =>
    ["workspace", "dashboard", period || "last_30_days", start || "", end || ""] as const,
  closing: (date?: string, shift?: string) =>
    ["workspace", "closing", date || "today", shift || "FULL_DAY"] as const,
  employees: (date?: string) => ["workspace", "employees", date || "today"] as const,
  sales: (limit = 200) => ["workspace", "sales", limit] as const,
  pos: () => ["workspace", "pos"] as const,
  inventory: () => ["workspace", "inventory"] as const,
  expenses: () => ["workspace", "expenses"] as const,
  finance: () => ["workspace", "finance"] as const,
  shifts: () => ["workspace", "shifts"] as const,
  customers: () => ["workspace", "customers"] as const,
  reports: (period = "this_month", start = "", end = "") =>
    ["workspace", "reports", period, start, end] as const,
  audit: (limit = 100) => ["workspace", "audit", limit] as const,
};

export type MutationDomain =
  | "sale"
  | "pos-catalog"
  | "inventory"
  | "expense"
  | "shift"
  | "customer"
  | "employee"
  | "finance"
  | "closing"
  | "all";

const INVALIDATION_GRAPH: Record<MutationDomain, WorkspaceSection[]> = {
  sale: ["sales", "dashboard", "inventory", "pos", "expenses", "shifts", "closing", "reports", "finance", "audit"],
  "pos-catalog": ["pos"],
  inventory: ["inventory", "pos", "dashboard", "reports", "audit"],
  expense: ["expenses", "shifts", "dashboard", "closing", "reports", "finance", "audit"],
  shift: ["shifts", "expenses", "pos", "dashboard", "audit"],
  customer: ["customers", "expenses", "shifts", "dashboard", "audit"],
  employee: ["employees", "staff", "closing", "dashboard", "audit"],
  finance: ["finance", "reports", "dashboard", "audit"],
  closing: ["closing", "sales", "dashboard", "reports", "audit"],
  all: [
    "dashboard",
    "closing",
    "pos",
    "sales",
    "inventory",
    "expenses",
    "finance",
    "employees",
    "staff",
    "shifts",
    "customers",
    "reports",
    "audit",
  ],
};

export async function invalidateWorkspaceCaches(
  queryClient: QueryClient,
  domain: MutationDomain
) {
  const targets = INVALIDATION_GRAPH[domain] ?? INVALIDATION_GRAPH.all;
  await Promise.all(
    targets.map((sec) =>
      queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.section(sec),
      })
    )
  );
}

export async function fetchWorkspaceApi<T>(
  path: string,
  options?: { fresh?: boolean }
): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = options?.fresh
    ? `/api/workspace/${path}${sep}fresh=1&_ts=${Date.now()}`
    : `/api/workspace/${path}`;

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
  });

  if (res.status === 401) {
    throw new Error("Authentication required.");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data as { error?: string } | null)?.error || `Request failed (${res.status})`);
  }

  return data as T;
}
