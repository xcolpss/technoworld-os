"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { dbQuery, withTransaction } from "@/lib/db/pool";

export interface CreateCustomerPayload {
  name: string;
  phone?: string;
  address?: string;
  customerType: "REGULAR" | "CORPORATE" | "SCHOOL" | "VIP";
  creditLimitPaisa: number;
  notes?: string;
}

export interface RecordRepaymentPayload {
  customerId: string;
  amountPaisa: number;
  paymentMethod: "CASH" | "JAZZCASH" | "EASYPAISA" | "BANK_TRANSFER";
  notes?: string;
}

export async function createCustomerAction(payload: CreateCustomerPayload) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const cleanName = String(payload.name || "").trim() || "Walk-in Customer";
  const cleanPhone = String(payload.phone || "").trim();

  if (cleanPhone) {
    const existingRes = await dbQuery<{ id: string; name: string | null }>(
      `SELECT id, name FROM customers WHERE business_id = $1 AND phone = $2 LIMIT 1`,
      [ctx.businessId, cleanPhone]
    );
    const existing = existingRes.rows[0];
    if (existing) {
      throw new Error(
        `A customer with phone number ${cleanPhone} already exists (${existing.name || "Customer"}).`
      );
    }
  }

  await dbQuery(
    `INSERT INTO customers (
       business_id, name, phone, address, customer_type, credit_limit_paisa, notes
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      ctx.businessId,
      cleanName,
      cleanPhone || null,
      payload.address?.trim() || null,
      payload.customerType,
      Math.max(0, Number(payload.creditLimitPaisa) || 5000000),
      payload.notes?.trim() || null,
    ]
  );

  revalidatePath("/customers");
  revalidatePath("/pos");
}

export async function recordRepaymentAction(payload: RecordRepaymentPayload) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const amountPaisa = Math.round(Number(payload.amountPaisa) || 0);
  if (amountPaisa <= 0) {
    throw new Error("Repayment amount must be greater than Rs. 0.");
  }
  if (!payload.customerId) {
    throw new Error("Customer ID is required.");
  }

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO customer_ledger (
         business_id, customer_id, entry_type, amount_paisa,
         payment_method, notes, recorded_by
       )
       VALUES ($1, $2, 'REPAYMENT', $3, $4, $5, $6)`,
      [
        ctx.businessId,
        payload.customerId,
        amountPaisa,
        payload.paymentMethod,
        payload.notes?.trim() || "Customer Udhaar Repayment",
        ctx.userId,
      ]
    );

    if (payload.paymentMethod === "CASH") {
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
      if (sessRes.rows[0]) {
        await client.query(
          `UPDATE cash_sessions SET expected_closing_paisa = $1 WHERE id = $2`,
          [
            Number(sessRes.rows[0].expected_closing_paisa ?? 0) + amountPaisa,
            sessRes.rows[0].id,
          ]
        );
      }
    }

    await client.query(
      `INSERT INTO audit_logs (business_id, actor_name, action_type, description, metadata)
       VALUES ($1, $2, 'CUSTOMER_REPAYMENT_RECORDED', $3, $4::jsonb)`,
      [
        ctx.businessId,
        ctx.fullName,
        `Recorded Udhaar repayment Rs. ${Math.round(amountPaisa / 100)}`,
        JSON.stringify({
          entity_type: "customers",
          entity_id: payload.customerId,
          after_state: {
            amount_paisa: amountPaisa,
            payment_method: payload.paymentMethod,
          },
        }),
      ]
    );
  });

  revalidatePath("/customers");
  revalidatePath("/pos");
  revalidatePath("/dashboard");
}
