"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("cash_sessions")
    .select("id")
    .eq("business_id", ctx.businessId)
    .eq("terminal_id", payload.terminalId)
    .eq("status", "OPEN")
    .maybeSingle();

  if (existing) {
    throw new Error("This terminal already has an active open shift.");
  }

  const { error } = await admin.from("cash_sessions").insert({
    business_id: ctx.businessId,
    terminal_id: payload.terminalId,
    status: "OPEN",
    opening_float_paisa: floatPaisa,
    expected_closing_paisa: floatPaisa,
    opened_by: ctx.userId,
  });

  if (error) {
    throw new Error(`Failed to open shift: ${error.message}`);
  }

  revalidatePath("/shifts");
  revalidatePath("/pos");
}

export async function closeShiftAction(payload: CloseShiftPayload) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const actualPaisa = Math.max(0, Math.round(Number(payload.actualClosingPaisa) || 0));
  if (!payload.sessionId) throw new Error("Session ID is required.");

  const admin = createSupabaseAdminClient();

  const { data: session, error: sessErr } = await admin
    .from("cash_sessions")
    .select("*")
    .eq("id", payload.sessionId)
    .eq("business_id", ctx.businessId)
    .single();

  if (sessErr || !session) {
    throw new Error("Shift session not found.");
  }

  if (session.status !== "OPEN") {
    throw new Error("This shift is already closed.");
  }

  const expectedPaisa = Number(session.expected_closing_paisa ?? 0);
  const variancePaisa = actualPaisa - expectedPaisa;

  const { error: updateErr } = await admin
    .from("cash_sessions")
    .update({
      status: "CLOSED",
      actual_closing_paisa: actualPaisa,
      variance_paisa: variancePaisa,
      notes: payload.notes?.trim() || null,
      closed_by: ctx.userId,
      closed_at: new Date().toISOString(),
    })
    .eq("id", payload.sessionId)
    .eq("business_id", ctx.businessId);

  if (updateErr) {
    throw new Error(`Failed to close shift: ${updateErr.message}`);
  }

  await admin.from("audit_logs").insert({
    business_id: ctx.businessId,
    actor_profile_id: ctx.userId,
    action: "SHIFT_CLOSED",
    entity_type: "cash_sessions",
    entity_id: payload.sessionId,
    after_state: {
      expected_closing_paisa: expectedPaisa,
      actual_closing_paisa: actualPaisa,
      variance_paisa: variancePaisa,
    },
  });

  revalidatePath("/shifts");
  revalidatePath("/pos");
  revalidatePath("/dashboard");
}