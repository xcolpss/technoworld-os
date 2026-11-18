"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { withTransaction } from "@/lib/db/pool";

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

  const isTillPayout = payload.paymentSource === "CASH_TILL";

  await withTransaction(async (client) => {
    let activeSession: { id: string; expected_closing_paisa: number } | null = null;
    if (isTillPayout) {
      const sessRes = payload.cashSessionId
        ? await client.query<{ id: string; expected_closing_paisa: string | number }>(
            `SELECT id, expected_closing_paisa
             FROM cash_sessions
             WHERE business_id = $1 AND status = 'OPEN' AND id = $2
             FOR UPDATE`,
            [ctx.businessId, payload.cashSessionId]
          )
        : await client.query<{ id: string; expected_closing_paisa: string | number }>(
            `SELECT id, expected_closing_paisa
             FROM cash_sessions
             WHERE business_id = $1 AND status = 'OPEN'
             ORDER BY opened_at ASC
             LIMIT 1
             FOR UPDATE`,
            [ctx.businessId]
          );

      if (sessRes.rows[0]) {
        activeSession = {
          id: String(sessRes.rows[0].id),
          expected_closing_paisa: Number(sessRes.rows[0].expected_closing_paisa ?? 0),
        };
      }
    }

    const insRes = await client.query<{ id: string }>(
      `INSERT INTO expenses (
         business_id, cash_session_id, category, description,
         amount_paisa, payment_source, expense_date, recorded_by, notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        ctx.businessId,
        isTillPayout && activeSession ? activeSession.id : null,
        payload.category || "Shop Expense",
        cleanDesc,
        amountPaisa,
        payload.paymentSource,
        payload.expenseDate,
        ctx.userId,
        payload.notes?.trim() || null,
      ]
    );

    const insertedId = insRes.rows[0]?.id;

    if (isTillPayout && activeSession) {
      await client.query(
        `UPDATE cash_sessions SET expected_closing_paisa = $1 WHERE id = $2`,
        [Math.max(0, activeSession.expected_closing_paisa - amountPaisa), activeSession.id]
      );
    }

    await client.query(
      `INSERT INTO audit_logs (business_id, actor_name, action_type, description, metadata)
       VALUES ($1, $2, 'EXPENSE_RECORDED', $3, $4::jsonb)`,
      [
        ctx.businessId,
        ctx.fullName,
        `Recorded expense: ${cleanDesc} (Rs. ${Math.round(amountPaisa / 100)})`,
        JSON.stringify({
          entity_type: "expenses",
          entity_id: insertedId,
          after_state: {
            category: payload.category,
            description: cleanDesc,
            amount_paisa: amountPaisa,
            payment_source: payload.paymentSource,
          },
        }),
      ]
    );
  });

  revalidatePath("/expenses");
  revalidatePath("/pos");
  revalidatePath("/shifts");
  revalidatePath("/dashboard");
}

export async function deleteExpenseAction(expenseId: string) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  await withTransaction(async (client) => {
    const expRes = await client.query<{
      id: string;
      description: string;
      amount_paisa: string | number;
      payment_source: string | null;
      cash_session_id: string | null;
    }>(
      `SELECT id, description, amount_paisa, payment_source, cash_session_id
       FROM expenses WHERE id = $1 AND business_id = $2 FOR UPDATE`,
      [expenseId, ctx.businessId]
    );

    const exp = expRes.rows[0];
    if (!exp) throw new Error("Expense record not found.");

    const sourceVal = String(exp.payment_source ?? "");
    const sessionId = exp.cash_session_id ? String(exp.cash_session_id) : null;
    const amountPaisa = Number(exp.amount_paisa ?? 0);

    await client.query(
      `DELETE FROM expenses WHERE id = $1 AND business_id = $2`,
      [expenseId, ctx.businessId]
    );

    if (
      (sourceVal === "CASH_TILL" || sourceVal === "CASH_DRAWER") &&
      sessionId &&
      amountPaisa > 0
    ) {
      const sessRes = await client.query<{
        id: string;
        expected_closing_paisa: string | number;
        status: string;
      }>(
        `SELECT id, expected_closing_paisa, status FROM cash_sessions WHERE id = $1 FOR UPDATE`,
        [sessionId]
      );
      const session = sessRes.rows[0];
      if (session && session.status === "OPEN") {
        await client.query(
          `UPDATE cash_sessions SET expected_closing_paisa = $1 WHERE id = $2`,
          [Number(session.expected_closing_paisa ?? 0) + amountPaisa, session.id]
        );
      }
    }

    await client.query(
      `INSERT INTO audit_logs (business_id, actor_name, action_type, description, metadata)
       VALUES ($1, $2, 'EXPENSE_DELETED', $3, $4::jsonb)`,
      [
        ctx.businessId,
        ctx.fullName,
        `Deleted expense: ${exp.description}`,
        JSON.stringify({
          entity_type: "expenses",
          entity_id: expenseId,
          before_state: {
            description: exp.description,
            amount_paisa: amountPaisa,
            payment_source: sourceVal,
          },
        }),
      ]
    );
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

  const reason =
    payload.reason.trim() ||
    `Transfer ${payload.fromAccount} → ${payload.toAccount}`;

  await withTransaction(async (client) => {
    const movRes = await client.query<{ id: string }>(
      `INSERT INTO account_movements (
         business_id, movement_kind, from_account, to_account,
         amount_paisa, reason, recorded_by
       )
       VALUES ($1, 'TRANSFER', $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        ctx.businessId,
        payload.fromAccount,
        payload.toAccount,
        amountPaisa,
        reason,
        ctx.userId,
      ]
    );

    const movId = movRes.rows[0]?.id;

    if (payload.fromAccount === "CASH_TILL" || payload.toAccount === "CASH_TILL") {
      const sessRes = await client.query<{
        id: string;
        expected_closing_paisa: string | number;
      }>(
        `SELECT id, expected_closing_paisa
         FROM cash_sessions
         WHERE business_id = $1 AND status = 'OPEN'
         ORDER BY opened_at ASC
         LIMIT 1
         FOR UPDATE`,
        [ctx.businessId]
      );
      const session = sessRes.rows[0];
      if (session) {
        const delta = payload.toAccount === "CASH_TILL" ? amountPaisa : -amountPaisa;
        await client.query(
          `UPDATE cash_sessions SET expected_closing_paisa = $1 WHERE id = $2`,
          [Math.max(0, Number(session.expected_closing_paisa ?? 0) + delta), session.id]
        );
      }
    }

    await client.query(
      `INSERT INTO audit_logs (business_id, actor_name, action_type, description, metadata)
       VALUES ($1, $2, 'ACCOUNT_TRANSFER', $3, $4::jsonb)`,
      [
        ctx.businessId,
        ctx.fullName,
        `Transferred Rs. ${Math.round(amountPaisa / 100)} from ${payload.fromAccount} to ${payload.toAccount}`,
        JSON.stringify({
          entity_type: "account_movements",
          entity_id: movId,
          after_state: {
            from: payload.fromAccount,
            to: payload.toAccount,
            amount_paisa: amountPaisa,
            reason,
          },
        }),
      ]
    );
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

  const reason =
    payload.reason.trim() || "Manual balance reconciliation / computer correction";

  await withTransaction(async (client) => {
    const movRes = await client.query<{ id: string }>(
      `INSERT INTO account_movements (
         business_id, movement_kind, from_account, to_account,
         amount_paisa, reason, recorded_by
       )
       VALUES ($1, 'ADJUSTMENT', $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        ctx.businessId,
        deltaPaisa < 0 ? payload.account : null,
        deltaPaisa > 0 ? payload.account : null,
        Math.abs(deltaPaisa),
        reason,
        ctx.userId,
      ]
    );
    const movId = movRes.rows[0]?.id;

    if (payload.account === "CASH_TILL") {
      const sessRes = await client.query<{ id: string }>(
        `SELECT id FROM cash_sessions
         WHERE business_id = $1 AND status = 'OPEN'
         ORDER BY opened_at ASC LIMIT 1 FOR UPDATE`,
        [ctx.businessId]
      );
      if (sessRes.rows[0]) {
        await client.query(
          `UPDATE cash_sessions SET expected_closing_paisa = $1 WHERE id = $2`,
          [actualPaisa, sessRes.rows[0].id]
        );
      }
    }

    await client.query(
      `INSERT INTO audit_logs (business_id, actor_name, action_type, description, metadata)
       VALUES ($1, $2, 'ACCOUNT_MANUAL_ADJUSTMENT', $3, $4::jsonb)`,
      [
        ctx.businessId,
        ctx.fullName,
        `Manual reconciliation adjustment on ${payload.account}`,
        JSON.stringify({
          entity_type: "account_movements",
          entity_id: movId,
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
        }),
      ]
    );
  });

  revalidatePath("/expenses");
  revalidatePath("/pos");
  revalidatePath("/shifts");
  revalidatePath("/dashboard");
}
