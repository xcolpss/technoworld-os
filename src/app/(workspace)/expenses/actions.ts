"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AccountBucket =
  | "CASH_TILL"
  | "CASH_IN_HAND"
  | "EASYPAISA"
  | "JAZZCASH"
  | "BANK_TRANSFER";

export interface CreateExpensePayload {
  category: string;
  description: string;
  amountPaisa: number;
  paymentSource: AccountBucket;
  expenseDate: string;
  cashSessionId?: string | null;
  notes?: string;
}

export interface TransferAccountPayload {
  fromAccount: AccountBucket;
  toAccount: AccountBucket;
  amountPaisa: number;
  reason: string;
}

export interface AdjustAccountPayload {
  account: AccountBucket;
  currentCalculatedPaisa: number;
  actualCountedPaisa: number;
  reason: string;
}

export async function createExpenseAction(payload: CreateExpensePayload) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const amountPaisa = Math.round(Number(payload.amountPaisa) || 0);
  if (amountPaisa <= 0) {
    throw new Error("Expense amount must be greater than Rs. 0.");
  }

  const cleanDesc = String(payload.description || "").trim();
  if (!cleanDesc) {
    throw new Error("Please enter what this expense was for.");
  }

  const admin = createSupabaseAdminClient();
  const isTillPayout = payload.paymentSource === "CASH_TILL";

  let activeSession: { id: string; expected_closing_paisa: number } | null = null;
  if (isTillPayout) {
    const query = admin
      .from("cash_sessions")
      .select("id, expected_closing_paisa")
      .eq("business_id", ctx.businessId)
      .eq("status", "OPEN");

    const { data: session } = payload.cashSessionId
      ? await query.eq("id", payload.cashSessionId).maybeSingle()
      : await query.order("opened_at", { ascending: true }).limit(1).maybeSingle();

    if (session) {
      activeSession = {
        id: String(session.id),
        expected_closing_paisa: Number(session.expected_closing_paisa ?? 0),
      };
    }
  }

  const { data: inserted, error: insErr } = await admin
    .from("expenses")
    .insert({
      business_id: ctx.businessId,
      cash_session_id: isTillPayout && activeSession ? activeSession.id : null,
      category: payload.category || "Shop Expense",
      description: cleanDesc,
      amount_paisa: amountPaisa,
      payment_source: payload.paymentSource,
      expense_date: payload.expenseDate,
      recorded_by: ctx.userId,
      notes: payload.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    throw new Error(`Failed to save expense: ${insErr?.message}`);
  }

  if (isTillPayout && activeSession) {
    await admin
      .from("cash_sessions")
      .update({
        expected_closing_paisa: Math.max(
          0,
          activeSession.expected_closing_paisa - amountPaisa
        ),
      })
      .eq("id", activeSession.id);
  }

  await admin.from("audit_logs").insert({
    business_id: ctx.businessId,
    actor_profile_id: ctx.userId,
    action: "EXPENSE_RECORDED",
    entity_type: "expenses",
    entity_id: inserted.id,
    after_state: {
      category: payload.category,
      description: cleanDesc,
      amount_paisa: amountPaisa,
      payment_source: payload.paymentSource,
    },
  });

  revalidatePath("/expenses");
  revalidatePath("/pos");
  revalidatePath("/shifts");
  revalidatePath("/dashboard");
}

export async function deleteExpenseAction(expenseId: string) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const admin = createSupabaseAdminClient();

  const { data: exp } = await admin
    .from("expenses")
    .select("*")
    .eq("id", expenseId)
    .eq("business_id", ctx.businessId)
    .single();

  if (!exp) throw new Error("Expense record not found.");

  const sourceVal = String(exp.payment_source ?? "");
  const sessionId = exp.cash_session_id ? String(exp.cash_session_id) : null;
  const amountPaisa = Number(exp.amount_paisa ?? 0);

  await admin
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("business_id", ctx.businessId);

  if (
    (sourceVal === "CASH_TILL" || sourceVal === "CASH_DRAWER") &&
    sessionId &&
    amountPaisa > 0
  ) {
    const { data: session } = await admin
      .from("cash_sessions")
      .select("id, expected_closing_paisa, status")
      .eq("id", sessionId)
      .maybeSingle();

    if (session && session.status === "OPEN") {
      await admin
        .from("cash_sessions")
        .update({
          expected_closing_paisa:
            Number(session.expected_closing_paisa ?? 0) + amountPaisa,
        })
        .eq("id", session.id);
    }
  }

  await admin.from("audit_logs").insert({
    business_id: ctx.businessId,
    actor_profile_id: ctx.userId,
    action: "EXPENSE_DELETED",
    entity_type: "expenses",
    entity_id: expenseId,
    before_state: {
      description: exp.description,
      amount_paisa: amountPaisa,
      payment_source: sourceVal,
    },
  });

  revalidatePath("/expenses");
  revalidatePath("/pos");
  revalidatePath("/shifts");
  revalidatePath("/dashboard");
}

export async function transferBetweenAccountsAction(
  payload: TransferAccountPayload
) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const amountPaisa = Math.round(Number(payload.amountPaisa) || 0);
  if (amountPaisa <= 0) {
    throw new Error("Transfer amount must be greater than Rs. 0.");
  }
  if (payload.fromAccount === payload.toAccount) {
    throw new Error("Source and destination accounts must be different.");
  }

  const admin = createSupabaseAdminClient();
  const reason =
    payload.reason.trim() ||
    `Transfer ${payload.fromAccount} → ${payload.toAccount}`;

  const { data: mov, error: movErr } = await admin
    .from("account_movements")
    .insert({
      business_id: ctx.businessId,
      movement_kind: "TRANSFER",
      from_account: payload.fromAccount,
      to_account: payload.toAccount,
      amount_paisa: amountPaisa,
      reason,
      recorded_by: ctx.userId,
    })
    .select("id")
    .single();

  if (movErr || !mov) {
    throw new Error(`Transfer failed: ${movErr?.message}`);
  }

  // Sync open cash_session drawer if CASH_TILL is involved
  if (
    payload.fromAccount === "CASH_TILL" ||
    payload.toAccount === "CASH_TILL"
  ) {
    const { data: session } = await admin
      .from("cash_sessions")
      .select("id, expected_closing_paisa")
      .eq("business_id", ctx.businessId)
      .eq("status", "OPEN")
      .order("opened_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (session) {
      const delta =
        payload.toAccount === "CASH_TILL" ? amountPaisa : -amountPaisa;
      await admin
        .from("cash_sessions")
        .update({
          expected_closing_paisa: Math.max(
            0,
            Number(session.expected_closing_paisa ?? 0) + delta
          ),
        })
        .eq("id", session.id);
    }
  }

  await admin.from("audit_logs").insert({
    business_id: ctx.businessId,
    actor_profile_id: ctx.userId,
    action: "ACCOUNT_TRANSFER",
    entity_type: "account_movements",
    entity_id: mov.id,
    after_state: {
      from: payload.fromAccount,
      to: payload.toAccount,
      amount_paisa: amountPaisa,
      reason,
    },
  });

  revalidatePath("/expenses");
  revalidatePath("/pos");
  revalidatePath("/shifts");
  revalidatePath("/dashboard");
}

export async function adjustAccountBalanceAction(payload: AdjustAccountPayload) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const actualPaisa = Math.max(
    0,
    Math.round(Number(payload.actualCountedPaisa) || 0)
  );
  const currentPaisa = Math.round(Number(payload.currentCalculatedPaisa) || 0);
  const deltaPaisa = actualPaisa - currentPaisa;

  if (deltaPaisa === 0) {
    throw new Error("Actual balance is already equal to the system balance.");
  }

  const admin = createSupabaseAdminClient();
  const reason =
    payload.reason.trim() || "Manual balance reconciliation / computer correction";

  const { data: mov, error: movErr } = await admin
    .from("account_movements")
    .insert({
      business_id: ctx.businessId,
      movement_kind: "ADJUSTMENT",
      from_account: deltaPaisa < 0 ? payload.account : null,
      to_account: deltaPaisa > 0 ? payload.account : null,
      amount_paisa: Math.abs(deltaPaisa),
      reason,
      recorded_by: ctx.userId,
    })
    .select("id")
    .single();

  if (movErr || !mov) {
    throw new Error(`Adjustment failed: ${movErr?.message}`);
  }

  if (payload.account === "CASH_TILL") {
    const { data: session } = await admin
      .from("cash_sessions")
      .select("id, expected_closing_paisa")
      .eq("business_id", ctx.businessId)
      .eq("status", "OPEN")
      .order("opened_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (session) {
      await admin
        .from("cash_sessions")
        .update({ expected_closing_paisa: actualPaisa })
        .eq("id", session.id);
    }
  }

  await admin.from("audit_logs").insert({
    business_id: ctx.businessId,
    actor_profile_id: ctx.userId,
    action: "ACCOUNT_MANUAL_ADJUSTMENT",
    entity_type: "account_movements",
    entity_id: mov.id,
    before_state: {
      account: payload.account,
      previous_paisa: currentPaisa,
    },
    after_state: {
      account: payload.account,
      actual_paisa: actualPaisa,
      delta_paisa: deltaPaisa,
      reason,
    },
  });

  revalidatePath("/expenses");
  revalidatePath("/pos");
  revalidatePath("/shifts");
  revalidatePath("/dashboard");
}