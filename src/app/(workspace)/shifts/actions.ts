"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { withTransaction } from "@/lib/db/pool";

export interface OpenShiftPayload {
  terminalId: string;
  openingFloatPaisa: number;
}

export interface CloseShiftPayload {
  sessionId: string;
  actualClosingPaisa: number;
  notes?: string;
}

export async function openShiftAction(payload: OpenShiftPayload) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const floatPaisa = Math.max(0, Math.round(Number(payload.openingFloatPaisa) || 0));
  if (!payload.terminalId) throw new Error("Terminal is required.");

  await withTransaction(async (client) => {
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM cash_sessions
       WHERE business_id = $1 AND terminal_id = $2 AND status = 'OPEN'
       LIMIT 1 FOR UPDATE`,
      [ctx.businessId, payload.terminalId]
    );

    if (existing.rows[0]) {
      throw new Error("This terminal already has an active open shift.");
    }

    await client.query(
      `INSERT INTO cash_sessions (
         business_id, terminal_id, status,
         opening_float_paisa, expected_closing_paisa, opened_by
       )
       VALUES ($1, $2, 'OPEN', $3, $3, $4)`,
      [ctx.businessId, payload.terminalId, floatPaisa, ctx.userId]
    );
  });

  revalidatePath("/shifts");
  revalidatePath("/pos");
}

export async function closeShiftAction(payload: CloseShiftPayload) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const actualPaisa = Math.max(0, Math.round(Number(payload.actualClosingPaisa) || 0));
  if (!payload.sessionId) throw new Error("Session ID is required.");

  await withTransaction(async (client) => {
    const sessRes = await client.query<{
      id: string;
      status: string;
      expected_closing_paisa: string | number;
    }>(
      `SELECT id, status, expected_closing_paisa
       FROM cash_sessions
       WHERE id = $1 AND business_id = $2
       FOR UPDATE`,
      [payload.sessionId, ctx.businessId]
    );

    const session = sessRes.rows[0];
    if (!session) throw new Error("Shift session not found.");
    if (session.status !== "OPEN") throw new Error("This shift is already closed.");

    const expectedPaisa = Number(session.expected_closing_paisa ?? 0);
    const variancePaisa = actualPaisa - expectedPaisa;

    await client.query(
      `UPDATE cash_sessions
       SET status = 'CLOSED',
           actual_closing_paisa = $1,
           variance_paisa = $2,
           notes = $3,
           closed_by = $4,
           closed_at = NOW()
       WHERE id = $5 AND business_id = $6`,
      [
        actualPaisa,
        variancePaisa,
        payload.notes?.trim() || null,
        ctx.userId,
        payload.sessionId,
        ctx.businessId,
      ]
    );

    await client.query(
      `INSERT INTO audit_logs (business_id, actor_name, action_type, description, metadata)
       VALUES ($1, $2, 'SHIFT_CLOSED', $3, $4::jsonb)`,
      [
        ctx.businessId,
        ctx.fullName,
        `Closed shift session ${payload.sessionId.slice(0, 8)}`,
        JSON.stringify({
          entity_type: "cash_sessions",
          entity_id: payload.sessionId,
          after_state: {
            expected_closing_paisa: expectedPaisa,
            actual_closing_paisa: actualPaisa,
            variance_paisa: variancePaisa,
          },
        }),
      ]
    );
  });

  revalidatePath("/shifts");
  revalidatePath("/pos");
  revalidatePath("/dashboard");
}
