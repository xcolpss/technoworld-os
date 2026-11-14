"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface PosSaleItemPayload {
  productId?: string;
  name: string;
  category: string;
  quantity: number;
  retailPricePaisa: number;
  costPricePaisa: number;
}

export interface CompleteSalePayload {
  customerName: string;
  discountPaisa: number;
  paymentMethod: string;
  items: PosSaleItemPayload[];
}

// Print Papers CRUD
export async function createPrintPaperAction(payload: { name: string; bwPricePaisa: number; colorPricePaisa: number }) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const cleanName = payload.name.trim();
  if (!cleanName) throw new Error("Paper type name is required.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("pos_print_papers").insert({
    business_id: ctx.businessId,
    name: cleanName,
    bw_price_paisa: Math.max(0, payload.bwPricePaisa),
    color_price_paisa: Math.max(0, payload.colorPricePaisa),
  });

  if (error) throw new Error(`Failed to create paper type: ${error.message}`);
  revalidatePath("/pos");
}

export async function updatePrintPaperAction(id: string, payload: { name: string; bwPricePaisa: number; colorPricePaisa: number }) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const cleanName = payload.name.trim();
  if (!cleanName) throw new Error("Paper type name is required.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("pos_print_papers")
    .update({
      name: cleanName,
      bw_price_paisa: Math.max(0, payload.bwPricePaisa),
      color_price_paisa: Math.max(0, payload.colorPricePaisa),
    })
    .eq("id", id)
    .eq("business_id", ctx.businessId);

  if (error) throw new Error(`Failed to update paper type: ${error.message}`);
  revalidatePath("/pos");
}

export async function deletePrintPaperAction(id: string) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("pos_print_papers")
    .delete()
    .eq("id", id)
    .eq("business_id", ctx.businessId);

  if (error) throw new Error(`Failed to delete paper type: ${error.message}`);
  revalidatePath("/pos");
}

// Media Categories CRUD
export async function createMediaCategoryAction(payload: { type: string; name: string; defaultPricePaisa: number }) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const cleanName = payload.name.trim();
  if (!cleanName) throw new Error("Media category name is required.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("pos_media_categories").insert({
    business_id: ctx.businessId,
    type: payload.type.trim() || "MOVIE",
    name: cleanName,
    default_price_paisa: Math.max(0, payload.defaultPricePaisa),
  });

  if (error) throw new Error(`Failed to create media category: ${error.message}`);
  revalidatePath("/pos");
}

export async function updateMediaCategoryAction(id: string, payload: { type: string; name: string; defaultPricePaisa: number }) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const cleanName = payload.name.trim();
  if (!cleanName) throw new Error("Media category name is required.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("pos_media_categories")
    .update({
      type: payload.type.trim() || "MOVIE",
      name: cleanName,
      default_price_paisa: Math.max(0, payload.defaultPricePaisa),
    })
    .eq("id", id)
    .eq("business_id", ctx.businessId);

  if (error) throw new Error(`Failed to update media category: ${error.message}`);
  revalidatePath("/pos");
}

export async function deleteMediaCategoryAction(id: string) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("pos_media_categories")
    .delete()
    .eq("id", id)
    .eq("business_id", ctx.businessId);

  if (error) throw new Error(`Failed to delete media category: ${error.message}`);
  revalidatePath("/pos");
}

// Composing Services CRUD
export async function createComposingServiceAction(payload: { name: string; defaultPricePaisa: number }) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const cleanName = payload.name.trim();
  if (!cleanName) throw new Error("Service name is required.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("pos_composing_services").insert({
    business_id: ctx.businessId,
    name: cleanName,
    default_price_paisa: Math.max(0, payload.defaultPricePaisa),
  });

  if (error) throw new Error(`Failed to create composing service: ${error.message}`);
  revalidatePath("/pos");
}

export async function updateComposingServiceAction(id: string, payload: { name: string; defaultPricePaisa: number }) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const cleanName = payload.name.trim();
  if (!cleanName) throw new Error("Service name is required.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("pos_composing_services")
    .update({
      name: cleanName,
      default_price_paisa: Math.max(0, payload.defaultPricePaisa),
    })
    .eq("id", id)
    .eq("business_id", ctx.businessId);

  if (error) throw new Error(`Failed to update composing service: ${error.message}`);
  revalidatePath("/pos");
}

export async function deleteComposingServiceAction(id: string) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("pos_composing_services")
    .delete()
    .eq("id", id)
    .eq("business_id", ctx.businessId);

  if (error) throw new Error(`Failed to delete composing service: ${error.message}`);
  revalidatePath("/pos");
}

export async function completePosSaleAction(payload: CompleteSalePayload) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  if (!payload.items || payload.items.length === 0) {
    throw new Error("Cart is empty.");
  }

  const admin = createSupabaseAdminClient();

  const { data: activeSession } = await admin
    .from("cash_sessions")
    .select("id")
    .eq("business_id", ctx.businessId)
    .eq("status", "OPEN")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cashSessionId = activeSession?.id || null;

  const { data: activeTerminal } = await admin
    .from("terminals")
    .select("id")
    .eq("business_id", ctx.businessId)
    .limit(1)
    .maybeSingle();

  const terminalId = activeTerminal?.id || null;
  const soldBy = (ctx as any).userId || (ctx as any).user?.id || null;

  const { data: lastSale } = await admin
    .from("sales")
    .select("sale_number")
    .eq("business_id", ctx.businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSaleNum = Number(lastSale?.sale_number ?? 0) + 1;
  const receiptNumber = `REC-${String(nextSaleNum).padStart(5, '0')}`;

  const subtotalPaisa = payload.items.reduce((acc, i) => acc + i.retailPricePaisa * i.quantity, 0);
  const totalPaisa = Math.max(0, subtotalPaisa - payload.discountPaisa);

  const { data: saleRecord, error: saleErr } = await admin
    .from("sales")
    .insert({
      business_id: ctx.businessId,
      cash_session_id: cashSessionId,
      shift_id: cashSessionId,
      terminal_id: terminalId,
      sold_by: soldBy,
      sale_number: nextSaleNum,
      receipt_number: receiptNumber,
      customer_name: payload.customerName.trim() || "Walk-in Customer",
      subtotal_paisa: subtotalPaisa,
      total_paisa: totalPaisa,
      discount_paisa: payload.discountPaisa,
      status: "completed",
    })
    .select("id")
    .single();

  if (saleErr || !saleRecord) {
    throw new Error(`Failed to record sale: ${saleErr?.message}`);
  }

  const saleId = saleRecord.id;

  for (const item of payload.items) {
    await admin.from("sale_items").insert({
      business_id: ctx.businessId,
      sale_id: saleId,
      product_id: item.productId || null,
      item_name: item.name,
      category_name: item.category || "Accessories",
      quantity: item.quantity,
      total_paisa: item.retailPricePaisa * item.quantity,
      cost_price_paisa: item.costPricePaisa,
    });

    if (item.productId) {
      const { data: inv } = await admin
        .from("inventory_items")
        .select("stock_quantity")
        .eq("id", item.productId)
        .single();

      if (inv) {
        const newQty = Math.max(0, Number(inv.stock_quantity || 0) - item.quantity);
        await admin
          .from("inventory_items")
          .update({ stock_quantity: newQty })
          .eq("id", item.productId);
      }
    }
  }

  await admin.from("payments").insert({
    business_id: ctx.businessId,
    sale_id: saleId,
    method: payload.paymentMethod,
    amount_paisa: totalPaisa,
  });

  revalidatePath("/pos");
  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  revalidatePath("/sales-history");

  return { success: true, saleNumber: nextSaleNum };
}