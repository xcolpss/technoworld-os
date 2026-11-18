"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { SectionRefreshButton } from "@/components/ui/section-refresh-button";
import { WorkspaceSectionSkeleton } from "@/components/ui/workspace-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AccessRestricted } from "@/components/auth/access-restricted";
import { hasRequiredRole } from "@/lib/auth/permissions";
import { useWorkspaceUser } from "@/lib/workspace/context";
import { fetchWorkspaceApi, workspaceQueryKeys } from "@/lib/query/cache-keys";
import { Activity, History, Lock, ShieldCheck } from "lucide-react";

interface AuditLogEntry {
  id: string;
  actor_name: string | null;
  action_type: string | null;
  description: string | null;
  created_at: string;
}

interface AuditPayload {
  logs: AuditLogEntry[];
}

export function AuditCachedView() {
  const user = useWorkspaceUser();
  const allowed = hasRequiredRole(user.role, ["OWNER"]);
  const queryClient = useQueryClient();
  const queryKey = workspaceQueryKeys.audit(100);

  const { data, isPending, isFetching, dataUpdatedAt } =
    useQuery<AuditPayload>({
      queryKey,
      queryFn: () => fetchWorkspaceApi<AuditPayload>("audit?limit=100"),
      enabled: allowed,
    });

  if (!allowed) {
    return (
      <AccessRestricted
        currentRole={user.role}
        requiredRoles={["OWNER"]}
        sectionName="Audit Trail & Immutable Logs"
      />
    );
  }

  const handleForceRefresh = async () => {
    const fresh = await queryClient.fetchQuery({
      queryKey,
      queryFn: () => fetchWorkspaceApi<AuditPayload>("audit?limit=100", { fresh: true }),
      staleTime: 0,
    });
    queryClient.setQueryData(queryKey, fresh);
  };

  const logs = data?.logs ?? [];

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto px-0 sm:px-6">
      <PageHeader
        eyebrow="TechnoWorld OS • Security & Compliance"
        title="Audit Trail & Immutable Logs"
        description="Secure chronological ledger tracking sensitive actions, owner capital inputs, household withdrawals, and financial transfers."
        actions={
          <SectionRefreshButton
            onRefresh={handleForceRefresh}
            isFetching={isFetching}
            lastUpdatedAt={dataUpdatedAt}
          />
        }
      />

      <Card className="border-brand/30 bg-brand-soft/10 shadow-xs">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-xs">
              <Lock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h4 className="font-display text-xs font-extrabold text-ink">
                Strict Immutability Enforced
              </h4>
              <p className="text-[11px] text-muted">
                Audit records cannot be modified or deleted by any user account, ensuring complete non-repudiation.
              </p>
            </div>
          </div>
          <Badge variant="success" className="font-mono text-xs px-3 py-1 shrink-0">
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5 inline" /> Secure Ledger Active
          </Badge>
        </CardContent>
      </Card>

      {isPending && !data ? (
        <WorkspaceSectionSkeleton cards={0} rows={8} />
      ) : (
        <Card className="border-border bg-surface shadow-sm">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <History className="h-5 w-5 text-brand shrink-0" />
                <h3 className="font-display text-sm sm:text-base font-extrabold text-ink">
                  System &amp; Financial Action Log
                </h3>
              </div>
              <Badge className="font-mono text-xs px-3 py-1">
                {logs.length} Log Entries
              </Badge>
            </div>

            <div className="md:hidden space-y-2.5">
              {logs.map((log, idx) => (
                <div
                  key={log.id || idx}
                  className="rounded-xl border border-border bg-warm/40 p-3 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-ink">
                      {log.actor_name || "System Admin"}
                    </span>
                    <Badge variant={log.action_type === "SYSTEM_INIT" ? "success" : "brand"}>
                      {log.action_type || "ACTIVITY"}
                    </Badge>
                  </div>
                  <p className="text-ink font-medium break-words">
                    {log.description || "Action recorded in ledger."}
                  </p>
                  <p className="font-mono text-[10px] text-muted pt-1 border-t border-border/60">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="py-10 text-center text-xs text-muted">
                  <Activity className="h-8 w-8 mx-auto text-muted/40 mb-2" />
                  No audit logs recorded yet. Sensitive actions will appear here automatically.
                </div>
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-warm/60 text-muted uppercase tracking-wider">
                    <th className="py-3 px-4 font-bold">Timestamp (PKT)</th>
                    <th className="py-3 px-4 font-bold">Actor / User</th>
                    <th className="py-3 px-4 font-bold">Action Type</th>
                    <th className="py-3 px-4 font-bold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log, idx) => (
                    <tr key={log.id || idx} className="hover:bg-warm/50 transition">
                      <td className="py-3.5 px-4 font-mono text-muted whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-ink whitespace-nowrap">
                        {log.actor_name || "System Admin"}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge variant={log.action_type === "SYSTEM_INIT" ? "success" : "brand"}>
                          {log.action_type || "ACTIVITY"}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-ink font-medium">
                        {log.description || "Action recorded in ledger."}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-muted">
                        <Activity className="h-8 w-8 mx-auto text-muted/40 mb-2" />
                        No audit logs recorded yet. Sensitive actions will appear here automatically.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
