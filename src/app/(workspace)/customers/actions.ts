"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

  const admin = createSupabaseAdminClient();

  // Duplicate Prevention: Check if customer with same phone already exists
  if (cleanPhone) {
    const { data: existing } = await admin
      .from("customers")
      .select("id, name, full_name")
      .eq("business_id", ctx.businessId)
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (existing) {
      throw new Error(
        `A customer with phone number ${cleanPhone} already exists (${existing.name || existing.full_name}).`
      );
    }
  }

  const { error } = await admin.from("customers").insert({
    business_id: ctx.businessId,
    name: cleanName,
    full_name: cleanName,
    phone: cleanPhone || null,
    address: payload.address?.trim() || null,
    customer_type: payload.customerType,
    credit_limit_paisa: Math.max(0, Number(payload.creditLimitPaisa) || 5000000),
    notes: payload.notes?.trim() || null,
  });

  if (error) {
    throw new Error(`Failed to create customer: ${error.message}`);
  }

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

  const admin = createSupabaseAdminClient();

  const { error: ledgerErr } = await admin.from("customer_ledger").insert({
    business_id: ctx.businessId,
    customer_id: payload.customerId,
    entry_type: "REPAYMENT",
    amount_paisa: amountPaisa,
    payment_method: payload.paymentMethod,
    notes: payload.notes?.trim() || "Customer Udhaar Repayment",
    recorded_by: ctx.userId,
  });

  if (ledgerErr) {
    throw new Error(`Failed to record repayment: ${ledgerErr.message}`);
  }

  if (payload.paymentMethod === "CASH") {
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
    action: "CUSTOMER_REPAYMENT_RECORDED",
    entity_type: "customers",
    entity_id: payload.customerId,
    after_state: {
      amount_paisa: amountPaisa,
      payment_method: payload.paymentMethod,
    },
  });

  revalidatePath("/customers");
  revalidatePath("/pos");
  revalidatePath("/dashboard");
}