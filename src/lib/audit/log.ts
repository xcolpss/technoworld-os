import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface AuditLogInput {
  businessId: string;
  actorName: string;
  actionType: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("audit_logs").insert({
      business_id: input.businessId,
      actor_name: input.actorName,
      action_type: input.actionType,
      description: input.description,
      metadata: input.metadata ?? {},
    });
  } catch {
    // Non-blocking audit trail write
  }
}
