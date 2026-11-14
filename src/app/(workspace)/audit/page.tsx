import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ShieldCheck, History, Lock, Activity } from "lucide-react";

export default async function AuditPage() {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const admin = createSupabaseAdminClient();

  const { data: rawLogs } = await admin
    .from("audit_logs")
    .select("*")
    .eq("business_id", ctx.businessId)
    .order("created_at", { ascending: false })
    .range(0, 49);

  const logs = rawLogs ?? [];

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6">
      <PageHeader
        eyebrow="TechnoWorld OS • Security &amp; Compliance"
        title="Audit Trail &amp; Immutable Logs"
        description="Secure chronological ledger tracking sensitive actions, owner capital inputs, household withdrawals, and financial transfers."
      />

      {/* Security Status Banner */}
      <Card className="border-brand/30 bg-brand-soft/10 shadow-xs">
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-xs">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-display text-xs font-extrabold text-ink">Strict Immutability Enforced</h4>
              <p className="text-[11px] text-muted">Audit records cannot be modified or deleted by any user account, ensuring complete non-repudiation.</p>
            </div>
          </div>
          <Badge variant="success" className="font-mono text-xs px-3 py-1">
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5 inline" /> Secure Ledger Active
          </Badge>
        </CardContent>
      </Card>

      {/* Audit Logs Table Card */}
      <Card className="border-border bg-surface shadow-sm">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2.5">
              <History className="h-5 w-5 text-brand" />
              <h3 className="font-display text-base font-extrabold text-ink">System &amp; Financial Action Log</h3>
            </div>
            <Badge variant="secondary" className="font-mono text-xs px-3 py-1">{logs.length} Log Entries</Badge>
          </div>

          <div className="overflow-x-auto">
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
                  <tr key={idx} className="hover:bg-warm/50 transition">
                    <td className="py-3.5 px-4 font-mono text-muted whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="py-3.5 px-4 font-bold text-ink whitespace-nowrap">{log.actor_name || "System Admin"}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <Badge variant={log.action_type === 'SYSTEM_INIT' ? 'success' : 'brand'}>
                        {log.action_type || "ACTIVITY"}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-ink font-medium">{log.description || "Action recorded in ledger."}</td>
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
    </div>
  );
}