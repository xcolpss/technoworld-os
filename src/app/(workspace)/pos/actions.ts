"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/log";

const ALLOWED_PAYMENT_METHODS = new Set([
  "CASH",
  "BANK_TRANSFER",
  "JAZZCASH",
  "EASYPAISA",
  "CARD",
  "OTHER",
]);

function normalizePaymentMethod(method: string): string {
  const upper = String(method || "CASH").trim().toUpperCase();
  if (upper === "BANK" || upper === "NAYAPAY" || upper === "SADAPAY") {
    return "BANK_TRANSFER";
  }
  return ALLOWED_PAYMENT_METHODS.has(upper) ? upper : "OTHER";
}

function slugifyCategory(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "accessories";
}

async function resolveOrCreateProductCategoryId(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  businessId: string,
  categoryName: string
): Promise<string | null> {
  const clean = categoryName.trim() || "Accessories";
  const slug = slugifyCategory(clean);

  const { data: existing } = await admin
    .from("categories")
    .select("id")
    .eq("business_id", businessId)
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return String(existing.id);

  const { data: created, error: createErr } = await admin
    .from("categories")
    .insert({
      business_id: businessId,
      name: clean,
      slug,
      kind: "PRODUCT",
      sort_order: 0,
      status: "ACTIVE",
    })
    .select("id")
    .maybeSingle();

  if (createErr) {
    // Handle concurrent insert race cleanly
    const { data: retry } = await admin
      .from("categories")
      .select("id")
      .eq("business_id", businessId)
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();
    return retry?.id ? String(retry.id) : null;
  }

  return created?.id ? String(created.id) : null;
}

async function resolveOrCreateProductId(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  businessId: string,
  inventoryItem: {
    id: string;
    name: string;
    sku: string | null;
    category: string | null;
    cost_price_paisa: number;
    retail_price_paisa: number;
    min_stock_alert?: number | null;
    unit: string | null;
  }
): Promise<string> {
  // Use deterministic unique SKU bound to this inventory item so similar names never collide
  const deterministicSku =
    inventoryItem.sku?.trim() ||
    `INV-${inventoryItem.id.slice(0, 8).toUpperCase()}`;

  const { data: byDeterministicSku } = await admin
    .from("products")
    .select("id, name")
    .eq("business_id", businessId)
    .eq("sku", deterministicSku)
    .limit(1)
    .maybeSingle();
  if (byDeterministicSku?.id) {
    return String(byDeterministicSku.id);
  }

  // Fallback unique SKU per inventory UUID in case human SKU collided with an unrelated product
  const uniqueFallbackSku = `INV-${inventoryItem.id.slice(0, 12).toUpperCase()}`;
  const { data: byUniqueFallback } = await admin
    .from("products")
    .select("id")
    .eq("business_id", businessId)
    .eq("sku", uniqueFallbackSku)
    .limit(1)
    .maybeSingle();
  if (byUniqueFallback?.id) {
    return String(byUniqueFallback.id);
  }

  const categoryId = await resolveOrCreateProductCategoryId(
    admin,
    businessId,
    inventoryItem.category || "Accessories"
  );

  // Try inserting with deterministicSku first; if SKU conflict on existing unrelated product, use uniqueFallbackSku
  const insertPayload = (skuToUse: string) => ({
    business_id: businessId,
    category_id: categoryId,
    sku: skuToUse,
    name: inventoryItem.name,
    unit_label: inventoryItem.unit?.trim() || "pcs",
    cost_price_paisa: Math.max(0, Number(inventoryItem.cost_price_paisa ?? 0)),
    sale_price_paisa: Math.max(0, Number(inventoryItem.retail_price_paisa ?? 0)),
    currency: "PKR",
    low_stock_threshold: Math.max(0, Number(inventoryItem.min_stock_alert ?? 5)),
    track_inventory: true,
    status: "ACTIVE",
  });

  const { data: created, error: insertErr } = await admin
    .from("products")
    .insert(insertPayload(deterministicSku))
    .select("id")
    .maybeSingle();

  if (created?.id) {
    return String(created.id);
  }

  const { data: createdFallback, error: fallbackErr } = await admin
    .from("products")
    .insert(insertPayload(uniqueFallbackSku))
    .select("id")
    .maybeSingle();

  if (createdFallback?.id) {
    return String(createdFallback.id);
  }

  throw new Error(
    `Failed to link catalog product for ${inventoryItem.name}: ${
      fallbackErr?.message ?? insertErr?.message ?? "unknown error"
    }`
  );
}

async function resolveOrCreateServiceId(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  businessId: string,
  categoryName: string,
  serviceTitle: string
): Promise<string | null> {
  const code = `pos-${slugifyCategory(categoryName)}`.slice(0, 48);
  const { data: existing } = await admin
    .from("services")
    .select("id")
    .eq("business_id", businessId)
    .eq("service_code", code)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return String(existing.id);

  const { data: created } = await admin
    .from("services")
    .insert({
      business_id: businessId,
      service_code: code,
      name: categoryName.trim() || serviceTitle.trim() || "POS Service",
      pricing_mode: "CUSTOM_QUOTE",
      default_price_paisa: 0,
      currency: "PKR",
      status: "ACTIVE",
    })
    .select("id")
    .maybeSingle();

  if (created?.id) return String(created.id);

  const { data: retry } = await admin
    .from("services")
    .select("id")
    .eq("business_id", businessId)
    .eq("service_code", code)
    .limit(1)
    .maybeSingle();

  return retry?.id ? String(retry.id) : null;
}

interface LotSnapshot {
  lotId: string;
  prevRemainingQty: number;
  prevStatus: string;
}

async function consumeFifoLots(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  businessId: string,
  productId: string,
  quantity: number,
  fallbackUnitCostPaisa: number,
  lotSnapshots: LotSnapshot[]
): Promise<{ unitCostPaisa: number; firstLotId: string | null }> {
  const { data: lots } = await admin
    .from("inventory_lots")
    .select("id, remaining_qty, unit_cost_paisa, status")
    .eq("business_id", businessId)
    .eq("product_id", productId)
    .gt("remaining_qty", 0)
    .order("received_at", { ascending: true });

  if (!lots || lots.length === 0) {
    return { unitCostPaisa: fallbackUnitCostPaisa, firstLotId: null };
  }

  let remaining = quantity;
  let totalCost = 0;
  let firstLotId: string | null = null;

  for (const lot of lots) {
    if (remaining <= 0) break;
    const lotId = String(lot.id);
    if (!firstLotId) firstLotId = lotId;
    const lotQty = Number(lot.remaining_qty ?? 0);
    const take = Math.min(remaining, lotQty);
    totalCost += take * Number(lot.unit_cost_paisa ?? fallbackUnitCostPaisa);
    remaining -= take;

    const nextRemaining = Math.max(0, lotQty - take);
    lotSnapshots.push({
      lotId,
      prevRemainingQty: lotQty,
      prevStatus: String(lot.status ?? "ACTIVE"),
    });

    await admin
      .from("inventory_lots")
      .update({
        remaining_qty: nextRemaining,
        status: nextRemaining === 0 ? "DEPLETED" : String(lot.status ?? "ACTIVE"),
      })
      .eq("id", lotId);
  }

  if (remaining > 0) {
    totalCost += remaining * fallbackUnitCostPaisa;
  }

  return {
    unitCostPaisa: Math.round(totalCost / Math.max(1, quantity)),
    firstLotId,
  };
}

export interface PosSaleItemPayload {
  productId?: string;
  name: string;
  category: string;
  quantity: number;
  retailPricePaisa: number;
  costPricePaisa: number;
}

export interface CompleteSalePayload {
  clientTxId?: string;
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
  const normalizedMethod = normalizePaymentMethod(payload.paymentMethod);

  // Idempotency guard: prevent duplicate transactions on accidental double-click or retry
  const cleanClientTxId = payload.clientTxId?.trim() || null;
  if (cleanClientTxId) {
    const { data: existingSale } = await admin
      .from("sales")
      .select("id, sale_number, receipt_number")
      .eq("business_id", ctx.businessId)
      .eq("client_tx_id", cleanClientTxId)
      .maybeSingle();

    if (existingSale?.id) {
      return {
        success: true,
        saleNumber: Number(existingSale.sale_number ?? 1),
        saleId: String(existingSale.id),
        receiptNumber: String(existingSale.receipt_number ?? "REC-DUP"),
        duplicatePrevented: true,
      };
    }
  }

  const sanitizedItems = payload.items.map((item) => ({
    ...item,
    quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
    retailPricePaisa: Math.max(0, Math.round(Number(item.retailPricePaisa) || 0)),
    costPricePaisa: Math.max(0, Math.round(Number(item.costPricePaisa) || 0)),
  }));

  // Aggregate demanded stock per inventory_items.id before writing anything
  const demandedQtyByInvId = new Map<string, number>();
  for (const item of sanitizedItems) {
    if (item.productId) {
      demandedQtyByInvId.set(
        item.productId,
        (demandedQtyByInvId.get(item.productId) ?? 0) + item.quantity
      );
    }
  }

  const invById = new Map<
    string,
    {
      id: string;
      name: string;
      sku: string | null;
      category: string | null;
      stock_quantity: number;
      cost_price_paisa: number;
      retail_price_paisa: number;
      min_stock_alert: number;
      unit: string | null;
    }
  >();

  for (const [invId, demandedQty] of demandedQtyByInvId.entries()) {
    const { data: inv, error: invErr } = await admin
      .from("inventory_items")
      .select(
        "id, name, sku, category, stock_quantity, cost_price_paisa, retail_price_paisa, min_stock_alert, unit"
      )
      .eq("id", invId)
      .eq("business_id", ctx.businessId)
      .maybeSingle();

    if (invErr || !inv) {
      throw new Error("Selected inventory product no longer exists.");
    }
    const available = Number(inv.stock_quantity ?? 0);
    if (available < demandedQty) {
      throw new Error(
        `Insufficient stock for ${inv.name}: requested ${demandedQty}, only ${available} in stock.`
      );
    }
    invById.set(invId, {
      id: String(inv.id),
      name: String(inv.name),
      sku: inv.sku ? String(inv.sku) : null,
      category: inv.category ? String(inv.category) : "Accessories",
      stock_quantity: available,
      cost_price_paisa: Number(inv.cost_price_paisa ?? 0),
      retail_price_paisa: Number(inv.retail_price_paisa ?? 0),
      min_stock_alert: Number(inv.min_stock_alert ?? 5),
      unit: inv.unit ? String(inv.unit) : "pcs",
    });
  }

  const [{ data: activeSession }, { data: activeShift }, { data: activeTerminal }] =
    await Promise.all([
      admin
        .from("cash_sessions")
        .select("id, shift_id, expected_closing_paisa, status")
        .eq("business_id", ctx.businessId)
        .eq("status", "OPEN")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("shifts")
        .select("id")
        .eq("business_id", ctx.businessId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("terminals")
        .select("id")
        .eq("business_id", ctx.businessId)
        .limit(1)
        .maybeSingle(),
    ]);

  const cashSessionId = activeSession?.id ? String(activeSession.id) : null;
  const shiftId =
    (activeSession?.shift_id ? String(activeSession.shift_id) : null) ??
    (activeShift?.id ? String(activeShift.id) : null) ??
    cashSessionId;
  const terminalId = activeTerminal?.id ? String(activeTerminal.id) : null;
  const soldBy = ctx.userId;

  const { data: existingNums } = await admin
    .from("sales")
    .select("sale_number")
    .eq("business_id", ctx.businessId)
    .not("sale_number", "is", null)
    .order("sale_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSaleNum = Number(existingNums?.sale_number ?? 0) + 1;
  const receiptNumber = `REC-${String(nextSaleNum).padStart(5, "0")}`;

  const subtotalPaisa = sanitizedItems.reduce(
    (acc, i) => acc + i.retailPricePaisa * i.quantity,
    0
  );
  const rawDiscount = Math.max(0, Math.round(Number(payload.discountPaisa) || 0));
  const discountPaisa = Math.min(subtotalPaisa, rawDiscount);
  const totalPaisa = Math.max(0, subtotalPaisa - discountPaisa);

  // Track rollback state so any failure cleanly reverts all changes
  let createdSaleId: string | null = null;
  const stockSnapshots: Array<{ invId: string; prevQty: number }> = [];
  const lotSnapshots: LotSnapshot[] = [];

  try {
    const { data: saleRecord, error: saleErr } = await admin
      .from("sales")
      .insert({
        business_id: ctx.businessId,
        cash_session_id: cashSessionId,
        shift_id: shiftId,
        terminal_id: terminalId,
        sold_by: soldBy,
        client_tx_id: cleanClientTxId,
        sale_number: nextSaleNum,
        receipt_number: receiptNumber,
        customer_name: payload.customerName.trim() || "Walk-in Customer",
        subtotal_paisa: subtotalPaisa,
        discount_paisa: discountPaisa,
        tax_paisa: 0,
        total_paisa: totalPaisa,
        paid_paisa: totalPaisa,
        currency: "PKR",
        status: "POSTED",
      })
      .select("id")
      .single();

    if (saleErr || !saleRecord) {
      throw new Error(`Failed to record sale: ${saleErr?.message}`);
    }

    createdSaleId = String(saleRecord.id);

    // Prorate discount across items proportionally so sum(line_total_paisa) === totalPaisa
    let discountRemaining = discountPaisa;

    for (let idx = 0; idx < sanitizedItems.length; idx++) {
      const item = sanitizedItems[idx];
      const grossLine = item.retailPricePaisa * item.quantity;
      const isLast = idx === sanitizedItems.length - 1;
      const lineDiscount =
        subtotalPaisa > 0
          ? isLast
            ? discountRemaining
            : Math.min(
                discountRemaining,
                Math.round((grossLine / subtotalPaisa) * discountPaisa)
              )
          : 0;
      discountRemaining = Math.max(0, discountRemaining - lineDiscount);
      const lineTotal = Math.max(0, grossLine - lineDiscount);

      if (item.productId) {
        const inv = invById.get(item.productId)!;
        const linkedProductId = await resolveOrCreateProductId(
          admin,
          ctx.businessId,
          inv
        );

        const fifoRes = await consumeFifoLots(
          admin,
          ctx.businessId,
          linkedProductId,
          item.quantity,
          inv.cost_price_paisa || item.costPricePaisa,
          lotSnapshots
        );

        // Snapshot previous stock before deducting
        if (!stockSnapshots.some((s) => s.invId === inv.id)) {
          stockSnapshots.push({ invId: inv.id, prevQty: inv.stock_quantity });
        }
        const nextStockQty = Math.max(0, inv.stock_quantity - item.quantity);
        inv.stock_quantity = nextStockQty;

        const { error: stockErr } = await admin
          .from("inventory_items")
          .update({ stock_quantity: nextStockQty })
          .eq("id", inv.id)
          .eq("business_id", ctx.businessId);
        if (stockErr) {
          throw new Error(
            `Failed to update stock for ${item.name}: ${stockErr.message}`
          );
        }

        const { error: lineErr } = await admin.from("sale_items").insert({
          business_id: ctx.businessId,
          sale_id: createdSaleId,
          item_kind: "PRODUCT",
          product_id: linkedProductId,
          service_id: null,
          description: item.name,
          item_name: item.name,
          category_name: inv.category || item.category || "Accessories",
          quantity: item.quantity,
          unit_price_paisa: item.retailPricePaisa,
          discount_paisa: lineDiscount,
          line_total_paisa: lineTotal,
          total_paisa: lineTotal,
          unit_cost_snapshot_paisa: fifoRes.unitCostPaisa,
          cost_price_paisa: fifoRes.unitCostPaisa,
          currency: "PKR",
        });

        if (lineErr) {
          throw new Error(
            `Failed to record sale line (${item.name}): ${lineErr.message}`
          );
        }

        await admin.from("stock_movements").insert({
          business_id: ctx.businessId,
          product_id: linkedProductId,
          inventory_lot_id: fifoRes.firstLotId,
          movement_type: "SALE_OUT",
          quantity_delta: -item.quantity,
          unit_cost_paisa: fifoRes.unitCostPaisa,
          reference_type: "sales",
          reference_id: createdSaleId,
          created_by: soldBy,
        });
      } else {
        const resolvedServiceId = await resolveOrCreateServiceId(
          admin,
          ctx.businessId,
          item.category || "Services",
          item.name
        );

        const { error: lineErr } = await admin.from("sale_items").insert({
          business_id: ctx.businessId,
          sale_id: createdSaleId,
          item_kind: resolvedServiceId ? "SERVICE" : "CUSTOM",
          product_id: null,
          service_id: resolvedServiceId,
          description: item.name,
          item_name: item.name,
          category_name: item.category || "Services",
          quantity: item.quantity,
          unit_price_paisa: item.retailPricePaisa,
          discount_paisa: lineDiscount,
          line_total_paisa: lineTotal,
          total_paisa: lineTotal,
          unit_cost_snapshot_paisa: item.costPricePaisa,
          cost_price_paisa: item.costPricePaisa,
          currency: "PKR",
        });

        if (lineErr) {
          throw new Error(
            `Failed to record sale line (${item.name}): ${lineErr.message}`
          );
        }
      }
    }

    if (totalPaisa > 0) {
      const { error: payErr } = await admin.from("payments").insert({
        business_id: ctx.businessId,
        sale_id: createdSaleId,
        cash_session_id: cashSessionId,
        method: normalizedMethod,
        amount_paisa: totalPaisa,
        currency: "PKR",
        status: "COMPLETED",
        received_by: soldBy,
      });

      if (payErr) {
        throw new Error(`Failed to record payment: ${payErr.message}`);
      }

      if (
        normalizedMethod === "CASH" &&
        activeSession &&
        activeSession.status === "OPEN"
      ) {
        const nextExpected =
          Number(activeSession.expected_closing_paisa ?? 0) + totalPaisa;
        await admin
          .from("cash_sessions")
          .update({ expected_closing_paisa: nextExpected })
          .eq("id", activeSession.id);
      }
    }
  } catch (err) {
    // Compensating rollback so zero partial sales or deducted stock remain on error
    for (const snap of stockSnapshots) {
      await admin
        .from("inventory_items")
        .update({ stock_quantity: snap.prevQty })
        .eq("id", snap.invId)
        .eq("business_id", ctx.businessId);
    }
    for (const lotSnap of [...lotSnapshots].reverse()) {
      await admin
        .from("inventory_lots")
        .update({
          remaining_qty: lotSnap.prevRemainingQty,
          status: lotSnap.prevStatus,
        })
        .eq("id", lotSnap.lotId);
    }
    if (createdSaleId) {
      await admin.from("stock_movements").delete().eq("reference_id", createdSaleId);
      await admin.from("payments").delete().eq("sale_id", createdSaleId);
      await admin.from("sale_items").delete().eq("sale_id", createdSaleId);
      await admin.from("sales").delete().eq("id", createdSaleId);
    }
    throw err;
  }

  await writeAuditLog({
    businessId: ctx.businessId,
    actorName: ctx.fullName,
    actionType: "POS_SALE_COMPLETED",
    description: `Sale ${receiptNumber} completed (${normalizedMethod}) for Rs. ${Math.round(
      totalPaisa / 100
    )}`,
    metadata: {
      sale_id: createdSaleId,
      receipt_number: receiptNumber,
      payment_method: normalizedMethod,
      total_paisa: totalPaisa,
      discount_paisa: discountPaisa,
      item_count: sanitizedItems.length,
    },
  });

  revalidatePath("/pos");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/closing");
  revalidatePath("/inventory");
  revalidatePath("/sales");
  revalidatePath("/sales-history");
  revalidatePath("/shifts");
  revalidatePath("/reports");

  return {
    success: true,
    saleNumber: nextSaleNum,
    saleId: createdSaleId,
    receiptNumber,
    duplicatePrevented: false,
  };
}