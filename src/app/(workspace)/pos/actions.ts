"use server";

import type { PoolClient } from "pg";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { dbQuery, withTransaction } from "@/lib/db/pool";
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
  client: PoolClient,
  businessId: string,
  categoryName: string
): Promise<string | null> {
  const clean = categoryName.trim() || "Accessories";
  const slug = slugifyCategory(clean);

  const existing = await client.query<{ id: string }>(
    `SELECT id FROM categories WHERE business_id = $1 AND slug = $2 LIMIT 1`,
    [businessId, slug]
  );
  if (existing.rows[0]?.id) return String(existing.rows[0].id);

  const created = await client.query<{ id: string }>(
    `INSERT INTO categories (business_id, name, slug, kind, sort_order, status)
     VALUES ($1, $2, $3, 'PRODUCT', 0, 'ACTIVE')
     ON CONFLICT (business_id, slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [businessId, clean, slug]
  );
  return created.rows[0]?.id ? String(created.rows[0].id) : null;
}

interface InventoryRow {
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

async function resolveOrCreateProductId(
  client: PoolClient,
  businessId: string,
  inventoryItem: InventoryRow
): Promise<string> {
  const deterministicSku =
    inventoryItem.sku?.trim() ||
    `INV-${inventoryItem.id.slice(0, 8).toUpperCase()}`;

  const bySku = await client.query<{ id: string }>(
    `SELECT id FROM products WHERE business_id = $1 AND sku = $2 LIMIT 1`,
    [businessId, deterministicSku]
  );
  if (bySku.rows[0]?.id) return String(bySku.rows[0].id);

  const uniqueFallbackSku = `INV-${inventoryItem.id.slice(0, 12).toUpperCase()}`;
  const byFallback = await client.query<{ id: string }>(
    `SELECT id FROM products WHERE business_id = $1 AND sku = $2 LIMIT 1`,
    [businessId, uniqueFallbackSku]
  );
  if (byFallback.rows[0]?.id) return String(byFallback.rows[0].id);

  const categoryId = await resolveOrCreateProductCategoryId(
    client,
    businessId,
    inventoryItem.category || "Accessories"
  );

  for (const skuToUse of [deterministicSku, uniqueFallbackSku]) {
    const res = await client.query<{ id: string }>(
      `INSERT INTO products (
         business_id, category_id, sku, name, unit_label,
         cost_price_paisa, sale_price_paisa, currency,
         low_stock_threshold, track_inventory, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PKR', $8, true, 'ACTIVE')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        businessId,
        categoryId,
        skuToUse,
        inventoryItem.name,
        inventoryItem.unit?.trim() || "pcs",
        Math.max(0, Number(inventoryItem.cost_price_paisa ?? 0)),
        Math.max(0, Number(inventoryItem.retail_price_paisa ?? 0)),
        Math.max(0, Number(inventoryItem.min_stock_alert ?? 5)),
      ]
    );
    if (res.rows[0]?.id) return String(res.rows[0].id);
  }

  throw new Error(`Failed to link catalog product for ${inventoryItem.name}`);
}

async function resolveOrCreateServiceId(
  client: PoolClient,
  businessId: string,
  categoryName: string,
  serviceTitle: string
): Promise<string | null> {
  const code = `pos-${slugifyCategory(categoryName)}`.slice(0, 48);
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM services WHERE business_id = $1 AND service_code = $2 LIMIT 1`,
    [businessId, code]
  );
  if (existing.rows[0]?.id) return String(existing.rows[0].id);

  const created = await client.query<{ id: string }>(
    `INSERT INTO services (
       business_id, service_code, name, pricing_mode,
       default_price_paisa, currency, status
     )
     VALUES ($1, $2, $3, 'CUSTOM_QUOTE', 0, 'PKR', 'ACTIVE')
     ON CONFLICT (business_id, service_code) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [
      businessId,
      code,
      categoryName.trim() || serviceTitle.trim() || "POS Service",
    ]
  );
  return created.rows[0]?.id ? String(created.rows[0].id) : null;
}

async function consumeFifoLots(
  client: PoolClient,
  businessId: string,
  productId: string,
  quantity: number,
  fallbackUnitCostPaisa: number
): Promise<{ unitCostPaisa: number; firstLotId: string | null }> {
  const { rows: lots } = await client.query<{
    id: string;
    remaining_qty: string | number;
    unit_cost_paisa: string | number;
    status: string;
  }>(
    `SELECT id, remaining_qty, unit_cost_paisa, status
     FROM inventory_lots
     WHERE business_id = $1 AND product_id = $2 AND remaining_qty > 0
     ORDER BY received_at ASC
     FOR UPDATE`,
    [businessId, productId]
  );

  if (lots.length === 0) {
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
    const lotCost =
      Number(lot.unit_cost_paisa ?? 0) > 0
        ? Number(lot.unit_cost_paisa)
        : fallbackUnitCostPaisa;
    totalCost += take * lotCost;
    remaining -= take;

    const nextRemaining = Math.max(0, lotQty - take);
    const nextStatus = nextRemaining === 0 ? "DEPLETED" : String(lot.status ?? "ACTIVE");

    await client.query(
      `UPDATE inventory_lots
       SET remaining_qty = $1, status = $2
       WHERE id = $3`,
      [nextRemaining, nextStatus, lotId]
    );
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
export async function createPrintPaperAction(payload: {
  name: string;
  bwPricePaisa: number;
  colorPricePaisa: number;
}) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const cleanName = payload.name.trim();
  if (!cleanName) throw new Error("Paper type name is required.");

  await dbQuery(
    `INSERT INTO pos_print_papers (business_id, name, bw_price_paisa, color_price_paisa)
     VALUES ($1, $2, $3, $4)`,
    [
      ctx.businessId,
      cleanName,
      Math.max(0, Math.round(payload.bwPricePaisa)),
      Math.max(0, Math.round(payload.colorPricePaisa)),
    ]
  );

  revalidatePath("/pos");
}

export async function updatePrintPaperAction(
  id: string,
  payload: { name: string; bwPricePaisa: number; colorPricePaisa: number }
) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const cleanName = payload.name.trim();
  if (!cleanName) throw new Error("Paper type name is required.");

  await dbQuery(
    `UPDATE pos_print_papers
     SET name = $1, bw_price_paisa = $2, color_price_paisa = $3
     WHERE id = $4 AND business_id = $5`,
    [
      cleanName,
      Math.max(0, Math.round(payload.bwPricePaisa)),
      Math.max(0, Math.round(payload.colorPricePaisa)),
      id,
      ctx.businessId,
    ]
  );

  revalidatePath("/pos");
}

export async function deletePrintPaperAction(id: string) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  await dbQuery(
    `DELETE FROM pos_print_papers WHERE id = $1 AND business_id = $2`,
    [id, ctx.businessId]
  );

  revalidatePath("/pos");
}

// Media Categories CRUD
export async function createMediaCategoryAction(payload: {
  type: string;
  name: string;
  defaultPricePaisa: number;
}) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const cleanName = payload.name.trim();
  if (!cleanName) throw new Error("Media category name is required.");

  await dbQuery(
    `INSERT INTO pos_media_categories (business_id, type, name, default_price_paisa)
     VALUES ($1, $2, $3, $4)`,
    [
      ctx.businessId,
      payload.type.trim() || "MOVIE",
      cleanName,
      Math.max(0, Math.round(payload.defaultPricePaisa)),
    ]
  );

  revalidatePath("/pos");
}

export async function updateMediaCategoryAction(
  id: string,
  payload: { type: string; name: string; defaultPricePaisa: number }
) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const cleanName = payload.name.trim();
  if (!cleanName) throw new Error("Media category name is required.");

  await dbQuery(
    `UPDATE pos_media_categories
     SET type = $1, name = $2, default_price_paisa = $3
     WHERE id = $4 AND business_id = $5`,
    [
      payload.type.trim() || "MOVIE",
      cleanName,
      Math.max(0, Math.round(payload.defaultPricePaisa)),
      id,
      ctx.businessId,
    ]
  );

  revalidatePath("/pos");
}

export async function deleteMediaCategoryAction(id: string) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  await dbQuery(
    `DELETE FROM pos_media_categories WHERE id = $1 AND business_id = $2`,
    [id, ctx.businessId]
  );

  revalidatePath("/pos");
}

// Composing Services CRUD
export async function createComposingServiceAction(payload: {
  name: string;
  defaultPricePaisa: number;
}) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const cleanName = payload.name.trim();
  if (!cleanName) throw new Error("Service name is required.");

  await dbQuery(
    `INSERT INTO pos_composing_services (business_id, name, default_price_paisa)
     VALUES ($1, $2, $3)`,
    [ctx.businessId, cleanName, Math.max(0, Math.round(payload.defaultPricePaisa))]
  );

  revalidatePath("/pos");
}

export async function updateComposingServiceAction(
  id: string,
  payload: { name: string; defaultPricePaisa: number }
) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const cleanName = payload.name.trim();
  if (!cleanName) throw new Error("Service name is required.");

  await dbQuery(
    `UPDATE pos_composing_services
     SET name = $1, default_price_paisa = $2
     WHERE id = $3 AND business_id = $4`,
    [
      cleanName,
      Math.max(0, Math.round(payload.defaultPricePaisa)),
      id,
      ctx.businessId,
    ]
  );

  revalidatePath("/pos");
}

export async function deleteComposingServiceAction(id: string) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  await dbQuery(
    `DELETE FROM pos_composing_services WHERE id = $1 AND business_id = $2`,
    [id, ctx.businessId]
  );

  revalidatePath("/pos");
}

export async function completePosSaleAction(payload: CompleteSalePayload) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  if (!payload.items || payload.items.length === 0) {
    throw new Error("Cart is empty.");
  }

  const normalizedMethod = normalizePaymentMethod(payload.paymentMethod);
  const cleanClientTxId = payload.clientTxId?.trim() || null;

  // Idempotency guard before starting transaction
  if (cleanClientTxId) {
    const existingRes = await dbQuery<{
      id: string;
      sale_number: number | null;
      receipt_number: string | null;
    }>(
      `SELECT id, sale_number, receipt_number
       FROM sales
       WHERE business_id = $1 AND client_tx_id = $2
       LIMIT 1`,
      [ctx.businessId, cleanClientTxId]
    );
    const existingSale = existingRes.rows[0];
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

  const sanitizedItems = payload.items.map((item) => {
    const qty = Math.round(Number(item.quantity));
    const unitPricePaisa = Math.round(Number(item.retailPricePaisa));
    const unitCostPaisa = Math.round(Number(item.costPricePaisa) || 0);
    if (!Number.isFinite(qty) || qty < 1) {
      throw new Error(`Invalid quantity for "${item.name}".`);
    }
    if (!Number.isFinite(unitPricePaisa) || unitPricePaisa <= 0) {
      throw new Error(`Selling price for "${item.name}" must be greater than Rs. 0.`);
    }
    return {
      ...item,
      quantity: qty,
      retailPricePaisa: unitPricePaisa,
      costPricePaisa: Math.max(0, unitCostPaisa),
    };
  });

  const subtotalPaisa = sanitizedItems.reduce(
    (acc, i) => acc + i.retailPricePaisa * i.quantity,
    0
  );
  const rawDiscount = Math.max(0, Math.round(Number(payload.discountPaisa) || 0));
  const discountPaisa = Math.min(subtotalPaisa, rawDiscount);
  const totalPaisa = Math.max(0, subtotalPaisa - discountPaisa);

  const txResult = await withTransaction(async (client) => {
    const demandedQtyByInvId = new Map<string, number>();
    for (const item of sanitizedItems) {
      if (item.productId) {
        demandedQtyByInvId.set(
          item.productId,
          (demandedQtyByInvId.get(item.productId) ?? 0) + item.quantity
        );
      }
    }

    const invById = new Map<string, InventoryRow>();
    if (demandedQtyByInvId.size > 0) {
      const ids = Array.from(demandedQtyByInvId.keys());
      const { rows: invRows } = await client.query<{
        id: string;
        name: string;
        sku: string | null;
        category: string | null;
        stock_quantity: string | number;
        cost_price_paisa: string | number;
        retail_price_paisa: string | number;
        min_stock_alert: string | number | null;
        unit: string | null;
      }>(
        `SELECT id, name, sku, category, stock_quantity, cost_price_paisa,
                retail_price_paisa, min_stock_alert, unit
         FROM inventory_items
         WHERE business_id = $1 AND id = ANY($2::uuid[])
         FOR UPDATE`,
        [ctx.businessId, ids]
      );

      for (const inv of invRows) {
        invById.set(String(inv.id), {
          id: String(inv.id),
          name: String(inv.name),
          sku: inv.sku ? String(inv.sku) : null,
          category: inv.category ? String(inv.category) : "Accessories",
          stock_quantity: Number(inv.stock_quantity ?? 0),
          cost_price_paisa: Number(inv.cost_price_paisa ?? 0),
          retail_price_paisa: Number(inv.retail_price_paisa ?? 0),
          min_stock_alert: Number(inv.min_stock_alert ?? 5),
          unit: inv.unit ? String(inv.unit) : "pcs",
        });
      }

      for (const [invId, demandedQty] of demandedQtyByInvId.entries()) {
        const inv = invById.get(invId);
        if (!inv) {
          throw new Error("Selected inventory product no longer exists.");
        }
        if (inv.stock_quantity < demandedQty) {
          throw new Error(
            `Insufficient stock for ${inv.name}: requested ${demandedQty}, only ${inv.stock_quantity} in stock.`
          );
        }
      }
    }

    const [sessionRes, shiftRes, terminalRes, maxNumRes] = await Promise.all([
      client.query<{
        id: string;
        shift_id: string | null;
        expected_closing_paisa: string | number;
        status: string;
      }>(
        `SELECT id, shift_id, expected_closing_paisa, status
         FROM cash_sessions
         WHERE business_id = $1 AND status = 'OPEN'
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [ctx.businessId]
      ),
      client.query<{ id: string }>(
        `SELECT id FROM shifts WHERE business_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [ctx.businessId]
      ),
      client.query<{ id: string }>(
        `SELECT id FROM terminals WHERE business_id = $1 LIMIT 1`,
        [ctx.businessId]
      ),
      client.query<{ max_num: string | number | null }>(
        `SELECT COALESCE(MAX(sale_number), 0) AS max_num FROM sales WHERE business_id = $1`,
        [ctx.businessId]
      ),
    ]);

    const activeSession = sessionRes.rows[0] ?? null;
    const cashSessionId = activeSession?.id ? String(activeSession.id) : null;
    const shiftId =
      (activeSession?.shift_id ? String(activeSession.shift_id) : null) ??
      (shiftRes.rows[0]?.id ? String(shiftRes.rows[0].id) : null) ??
      cashSessionId;
    const terminalId = terminalRes.rows[0]?.id ? String(terminalRes.rows[0].id) : null;
    const soldBy = ctx.userId;

    const nextSaleNum = Number(maxNumRes.rows[0]?.max_num ?? 0) + 1;
    const receiptNumber = `REC-${String(nextSaleNum).padStart(5, "0")}`;

    const saleInsert = await client.query<{ id: string }>(
      `INSERT INTO sales (
         business_id, cash_session_id, shift_id, terminal_id, sold_by,
         client_tx_id, sale_number, receipt_number, customer_name,
         subtotal_paisa, discount_paisa, tax_paisa, total_paisa, paid_paisa,
         currency, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, $13, 'PKR', 'POSTED')
       RETURNING id`,
      [
        ctx.businessId,
        cashSessionId,
        shiftId,
        terminalId,
        soldBy,
        cleanClientTxId,
        nextSaleNum,
        receiptNumber,
        payload.customerName.trim() || "Walk-in Customer",
        subtotalPaisa,
        discountPaisa,
        totalPaisa,
        totalPaisa,
      ]
    );

    const createdSaleId = String(saleInsert.rows[0].id);

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
        const linkedProductId = await resolveOrCreateProductId(client, ctx.businessId, inv);

        const fifoRes = await consumeFifoLots(
          client,
          ctx.businessId,
          linkedProductId,
          item.quantity,
          inv.cost_price_paisa || item.costPricePaisa
        );

        const nextStockQty = Math.max(0, inv.stock_quantity - item.quantity);
        inv.stock_quantity = nextStockQty;

        await client.query(
          `UPDATE inventory_items
           SET stock_quantity = $1, updated_at = NOW()
           WHERE id = $2 AND business_id = $3`,
          [nextStockQty, inv.id, ctx.businessId]
        );

        await client.query(
          `INSERT INTO sale_items (
             business_id, sale_id, item_kind, product_id, service_id,
             description, item_name, category_name, quantity,
             unit_price_paisa, discount_paisa, line_total_paisa, total_paisa,
             unit_cost_snapshot_paisa, cost_price_paisa, currency
           )
           VALUES ($1, $2, 'PRODUCT', $3, NULL, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'PKR')`,
          [
            ctx.businessId,
            createdSaleId,
            linkedProductId,
            item.name,
            item.name,
            inv.category || item.category || "Accessories",
            item.quantity,
            item.retailPricePaisa,
            lineDiscount,
            lineTotal,
            lineTotal,
            fifoRes.unitCostPaisa,
            fifoRes.unitCostPaisa,
          ]
        );

        await client.query(
          `INSERT INTO stock_movements (
             business_id, product_id, inventory_lot_id, movement_type,
             quantity_delta, unit_cost_paisa, reference_type, reference_id, created_by
           )
           VALUES ($1, $2, $3, 'SALE_OUT', $4, $5, 'sales', $6, $7)`,
          [
            ctx.businessId,
            linkedProductId,
            fifoRes.firstLotId,
            -item.quantity,
            fifoRes.unitCostPaisa,
            createdSaleId,
            soldBy,
          ]
        );
      } else {
        const resolvedServiceId = await resolveOrCreateServiceId(
          client,
          ctx.businessId,
          item.category || "Services",
          item.name
        );

        await client.query(
          `INSERT INTO sale_items (
             business_id, sale_id, item_kind, product_id, service_id,
             description, item_name, category_name, quantity,
             unit_price_paisa, discount_paisa, line_total_paisa, total_paisa,
             unit_cost_snapshot_paisa, cost_price_paisa, currency
           )
           VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'PKR')`,
          [
            ctx.businessId,
            createdSaleId,
            resolvedServiceId ? "SERVICE" : "CUSTOM",
            resolvedServiceId,
            item.name,
            item.name,
            item.category || "Services",
            item.quantity,
            item.retailPricePaisa,
            lineDiscount,
            lineTotal,
            lineTotal,
            item.costPricePaisa,
            item.costPricePaisa,
          ]
        );
      }
    }

    if (totalPaisa > 0) {
      await client.query(
        `INSERT INTO payments (
           business_id, sale_id, cash_session_id, method,
           amount_paisa, currency, status, received_by
         )
         VALUES ($1, $2, $3, $4, $5, 'PKR', 'COMPLETED', $6)`,
        [ctx.businessId, createdSaleId, cashSessionId, normalizedMethod, totalPaisa, soldBy]
      );

      if (normalizedMethod === "CASH" && activeSession && activeSession.status === "OPEN") {
        const nextExpected =
          Number(activeSession.expected_closing_paisa ?? 0) + totalPaisa;
        await client.query(
          `UPDATE cash_sessions SET expected_closing_paisa = $1 WHERE id = $2`,
          [nextExpected, activeSession.id]
        );
      }
    }

    return { createdSaleId, nextSaleNum, receiptNumber };
  });

  await writeAuditLog({
    businessId: ctx.businessId,
    actorName: ctx.fullName,
    actionType: "POS_SALE_COMPLETED",
    description: `Sale ${txResult.receiptNumber} completed (${normalizedMethod}) for Rs. ${Math.round(
      totalPaisa / 100
    )}`,
    metadata: {
      sale_id: txResult.createdSaleId,
      receipt_number: txResult.receiptNumber,
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
    saleNumber: txResult.nextSaleNum,
    saleId: txResult.createdSaleId,
    receiptNumber: txResult.receiptNumber,
    duplicatePrevented: false,
  };
}
