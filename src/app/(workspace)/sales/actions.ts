"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface EditableSaleLine {
  kind: "PRODUCT" | "SERVICE";
  product_id: string | null;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price_paisa: number;
  unit_cost_paisa: number;
}

export interface UpdateSalePayload {
  saleId: string;
  customerName: string;
  paymentMethod: "CASH" | "JAZZCASH" | "EASYPAISA" | "BANK_TRANSFER";
  discountPaisa: number;
  lines: EditableSaleLine[];
}

export async function voidSaleAction(saleId: string) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  if (!saleId) throw new Error("Sale ID is required.");

  const admin = createSupabaseAdminClient();

  const { data: sale, error: saleErr } = await admin
    .from("sales")
    .select("*")
    .eq("id", saleId)
    .eq("business_id", ctx.businessId)
    .single();

  if (saleErr || !sale) {
    throw new Error("Sale record not found.");
  }

  if (String(sale.status) === "VOIDED") {
    throw new Error("This bill is already voided.");
  }

  const { error: updateErr } = await admin
    .from("sales")
    .update({ status: "VOIDED" })
    .eq("id", saleId)
    .eq("business_id", ctx.businessId);

  if (updateErr) {
    throw new Error(`Failed to void bill: ${updateErr.message}`);
  }

  const { data: items } = await admin
    .from("sale_items")
    .select("*")
    .eq("sale_id", saleId)
    .eq("business_id", ctx.businessId);

  for (const item of (items ?? []) as Array<Record<string, unknown>>) {
    const productId = item.product_id ? String(item.product_id) : null;
    const qty = Number(item.quantity ?? 0);
    if (productId && qty > 0) {
      const { data: latestLot } = await admin
        .from("inventory_lots")
        .select("id, remaining_qty, unit_cost_paisa")
        .eq("business_id", ctx.businessId)
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestLot) {
        const nextRem =
          Number((latestLot as Record<string, unknown>)["remaining_qty"] ?? 0) + qty;
        await admin
          .from("inventory_lots")
          .update({ remaining_qty: nextRem })
          .eq("id", latestLot.id);

        await admin.from("stock_movements").insert({
          business_id: ctx.businessId,
          product_id: productId,
          inventory_lot_id: latestLot.id,
          movement_type: "ADJUSTMENT_IN",
          quantity_delta: qty,
          unit_cost_paisa: Number(latestLot.unit_cost_paisa ?? 0),
          reference_type: "sales",
          reference_id: saleId,
          created_by: ctx.userId,
          notes: "Stock restored from voided POS bill",
        });
      }
    }
  }

  const { data: payment } = await admin
    .from("payments")
    .select("method, amount_paisa")
    .eq("sale_id", saleId)
    .eq("business_id", ctx.businessId)
    .maybeSingle();

  const sessionId = (sale as Record<string, unknown>).cash_session_id
    ? String((sale as Record<string, unknown>).cash_session_id)
    : null;

  if (payment?.method === "CASH" && sessionId) {
    const { data: session } = await admin
      .from("cash_sessions")
      .select("id, expected_closing_paisa, status")
      .eq("id", sessionId)
      .maybeSingle();

    if (session && session.status === "OPEN") {
      const nextExpected = Math.max(
        0,
        Number(session.expected_closing_paisa ?? 0) - Number(payment.amount_paisa ?? 0)
      );
      await admin
        .from("cash_sessions")
        .update({ expected_closing_paisa: nextExpected })
        .eq("id", session.id);
    }
  }

  await admin.from("audit_logs").insert({
    business_id: ctx.businessId,
    actor_profile_id: ctx.userId,
    action: "SALE_VOIDED",
    entity_type: "sales",
    entity_id: saleId,
    before_state: { total_paisa: sale.total_paisa, status: sale.status },
    after_state: { status: "VOIDED" },
  });

  revalidatePath("/sales");
  revalidatePath("/sales-history");
  revalidatePath("/pos");
  revalidatePath("/inventory");
  revalidatePath("/shifts");
  revalidatePath("/dashboard");
}

export async function updateExistingSaleAction(payload: UpdateSalePayload) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  if (!payload.saleId || !payload.lines || payload.lines.length === 0) {
    throw new Error("A bill must have at least one item.");
  }

  const admin = createSupabaseAdminClient();

  const [{ data: oldSale }, { data: oldItems }, { data: oldPayment }] =
    await Promise.all([
      admin
        .from("sales")
        .select("*")
        .eq("id", payload.saleId)
        .eq("business_id", ctx.businessId)
        .single(),
      admin
        .from("sale_items")
        .select("*")
        .eq("sale_id", payload.saleId)
        .eq("business_id", ctx.businessId),
      admin
        .from("payments")
        .select("id, method, amount_paisa")
        .eq("sale_id", payload.saleId)
        .eq("business_id", ctx.businessId)
        .maybeSingle(),
    ]);

  if (!oldSale) throw new Error("Original sale not found.");

  // 1. Restore stock from old product lines first
  for (const item of (oldItems ?? []) as Array<Record<string, unknown>>) {
    const productId = item.product_id ? String(item.product_id) : null;
    const qty = Number(item.quantity ?? 0);
    if (productId && qty > 0) {
      const { data: latestLot } = await admin
        .from("inventory_lots")
        .select("id, remaining_qty, unit_cost_paisa")
        .eq("business_id", ctx.businessId)
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestLot) {
        const nextRem =
          Number((latestLot as Record<string, unknown>)["remaining_qty"] ?? 0) + qty;
        await admin
          .from("inventory_lots")
          .update({ remaining_qty: nextRem })
          .eq("id", latestLot.id);
      }
    }
  }

  // 2. Ensure default print service exists for any custom/service line without service_id
  let defaultPrintServiceId: string | null = null;
  if (payload.lines.some((l) => l.kind !== "PRODUCT" && !l.service_id)) {
    const { data: existingSrv } = await admin
      .from("services")
      .select("id")
      .eq("business_id", ctx.businessId)
      .eq("name", "Print & Photocopy")
      .limit(1)
      .maybeSingle();

    if (existingSrv?.id) {
      defaultPrintServiceId = existingSrv.id;
    } else {
      const { data: createdSrv } = await admin
        .from("services")
        .insert({
          business_id: ctx.businessId,
          service_code: "print-custom",
          name: "Print & Photocopy",
          default_price_paisa: 0,
          currency: "PKR",
          status: "ACTIVE",
        })
        .select("id")
        .single();
      defaultPrintServiceId = createdSrv?.id ?? null;
    }
  }

  // 3. Replace sale_items with edited lines and deduct new stock
  await admin
    .from("sale_items")
    .delete()
    .eq("sale_id", payload.saleId)
    .eq("business_id", ctx.businessId);

  for (const line of payload.lines) {
    const lineTotalPaisa = Math.round(line.quantity * line.unit_price_paisa);
    const isProd = line.kind === "PRODUCT" && Boolean(line.product_id);

    const { error: insErr } = await admin.from("sale_items").insert({
      business_id: ctx.businessId,
      sale_id: payload.saleId,
      item_kind: isProd ? "PRODUCT" : "SERVICE",
      product_id: isProd ? line.product_id : null,
      service_id: isProd ? null : (line.service_id ?? defaultPrintServiceId),
      description: line.description,
      quantity: line.quantity,
      unit_price_paisa: line.unit_price_paisa,

      line_total_paisa: lineTotalPaisa,
      currency: "PKR",
    });

    if (insErr) {
      throw new Error(`Failed to save edited line "": ${insErr.message}`);
    }

    if (isProd && line.product_id && line.quantity > 0) {
      let remToDeduct = line.quantity;
      const { data: lots } = await admin
        .from("inventory_lots")
        .select("id, remaining_qty")
        .eq("business_id", ctx.businessId)
        .eq("product_id", line.product_id)
        .gt("remaining_qty", 0)
        .order("created_at", { ascending: true });

      for (const lot of (lots ?? []) as Array<Record<string, unknown>>) {
        if (remToDeduct <= 0) break;
        const lotRem = Number(lot["remaining_qty"] ?? 0);
        const take = Math.min(lotRem, remToDeduct);
        await admin
          .from("inventory_lots")
          .update({ remaining_qty: lotRem - take })
          .eq("id", String(lot.id));
        remToDeduct -= take;
      }
    }
  }

  // 4. Update sale header totals, customer name & payment record
  const subtotalPaisa = payload.lines.reduce(
    (sum, l) => sum + Math.round(l.quantity * l.unit_price_paisa),
    0
  );
  const discountPaisa = Math.max(
    0,
    Math.min(subtotalPaisa, Math.round(payload.discountPaisa || 0))
  );
  const newTotalPaisa = Math.max(0, subtotalPaisa - discountPaisa);

  await admin
    .from("sales")
    .update({
      notes: payload.customerName.trim() ? `Customer: ${payload.customerName.trim()}` : null,
      subtotal_paisa: subtotalPaisa,
      discount_paisa: discountPaisa,
      total_paisa: newTotalPaisa,
    })
    .eq("id", payload.saleId)
    .eq("business_id", ctx.businessId);

  if (oldPayment?.id) {
    await admin
      .from("payments")
      .update({
        method: payload.paymentMethod,
        amount_paisa: newTotalPaisa,
      })
      .eq("id", oldPayment.id);
  }

  // 5. Adjust open cash drawer if payment method or cash amount changed
  const sessionId = (oldSale as Record<string, unknown>).cash_session_id
    ? String((oldSale as Record<string, unknown>).cash_session_id)
    : null;

  if (sessionId) {
    const oldCash =
      oldPayment?.method === "CASH" ? Number(oldPayment.amount_paisa ?? 0) : 0;
    const newCash = payload.paymentMethod === "CASH" ? newTotalPaisa : 0;
    const cashDelta = newCash - oldCash;

    if (cashDelta !== 0) {
      const { data: session } = await admin
        .from("cash_sessions")
        .select("id, expected_closing_paisa, status")
        .eq("id", sessionId)
        .maybeSingle();

      if (session && session.status === "OPEN") {
        await admin
          .from("cash_sessions")
          .update({
            expected_closing_paisa: Math.max(
              0,
              Number(session.expected_closing_paisa ?? 0) + cashDelta
            ),
          })
          .eq("id", session.id);
      }
    }
  }

  // 6. Log permanent audit trail entry so owner can review every edited bill
  await admin.from("audit_logs").insert({
    business_id: ctx.businessId,
    actor_profile_id: ctx.userId,
    action: "SALE_EDITED",
    entity_type: "sales",
    entity_id: payload.saleId,
    before_state: {
      total_paisa: oldSale.total_paisa,
      payment_method: oldPayment?.method ?? "CASH",
      item_count: (oldItems ?? []).length,
    },
    after_state: {
      total_paisa: newTotalPaisa,
      payment_method: payload.paymentMethod,
      item_count: payload.lines.length,
    },
  });

  revalidatePath("/sales");
  revalidatePath("/sales-history");
  revalidatePath("/pos");
  revalidatePath("/inventory");
  revalidatePath("/shifts");
  revalidatePath("/dashboard");
}