import { dbQuery } from "@/lib/db/pool";

export interface AuditLogInput {
  businessId: string;
  actorName: string;
  actionType: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await dbQuery(
      `INSERT INTO public.audit_logs (business_id, actor_name, action_type, description, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        input.businessId,
        input.actorName,
        input.actionType,
        input.description,
        JSON.stringify(input.metadata ?? {}),
      ]
    );
  } catch {
    // Non-blocking audit trail write
  }
}
