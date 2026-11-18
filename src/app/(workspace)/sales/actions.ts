"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { withTransaction } from "@/lib/db/pool";

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

  await withTransaction(async (client) => {
    const saleRes = await client.query<{
      id: string;
      status: string;
      receipt_number: string | null;
      total_paisa: string | number;
      cash_session_id: string | null;
    }>(
      `SELECT id, status, receipt_number, total_paisa, cash_session_id
       FROM sales
       WHERE id = $1 AND business_id = $2
       FOR UPDATE`,
      [saleId, ctx.businessId]
    );

    const sale = saleRes.rows[0];
    if (!sale) throw new Error("Sale record not found.");
    if (String(sale.status) === "VOIDED") {
      throw new Error("This bill is already voided.");
    }

    await client.query(
      `UPDATE sales SET status = 'VOIDED', updated_at = NOW() WHERE id = $1 AND business_id = $2`,
      [saleId, ctx.businessId]
    );

    const { rows: items } = await client.query<{
      product_id: string | null;
      quantity: string | number;
    }>(
      `SELECT product_id, quantity FROM sale_items WHERE sale_id = $1 AND business_id = $2`,
      [saleId, ctx.businessId]
    );

    for (const item of items) {
      const productId = item.product_id ? String(item.product_id) : null;
      const qty = Number(item.quantity ?? 0);
      if (!productId || qty <= 0) continue;

      const lotRes = await client.query<{
        id: string;
        remaining_qty: string | number;
        unit_cost_paisa: string | number;
      }>(
        `SELECT id, remaining_qty, unit_cost_paisa
         FROM inventory_lots
         WHERE business_id = $1 AND product_id = $2
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [ctx.businessId, productId]
      );

      const latestLot = lotRes.rows[0];
      if (latestLot) {
        const nextRem = Number(latestLot.remaining_qty ?? 0) + qty;
        await client.query(
          `UPDATE inventory_lots SET remaining_qty = $1 WHERE id = $2`,
          [nextRem, latestLot.id]
        );

        await client.query(
          `INSERT INTO stock_movements (
             business_id, product_id, inventory_lot_id, movement_type,
             quantity_delta, unit_cost_paisa, reference_type, reference_id,
             created_by, notes
           )
           VALUES ($1, $2, $3, 'ADJUSTMENT_IN', $4, $5, 'sales', $6, $7, 'Stock restored from voided POS bill')`,
          [
            ctx.businessId,
            productId,
            latestLot.id,
            qty,
            Number(latestLot.unit_cost_paisa ?? 0),
            saleId,
            ctx.userId,
          ]
        );
      }

      // Keep matching inventory_items stock synchronized if linked via SKU
      await client.query(
        `UPDATE inventory_items i
         SET stock_quantity = i.stock_quantity + $1, updated_at = NOW()
         FROM products p
         WHERE p.id = $2
           AND i.business_id = $3
           AND (i.sku = p.sku OR p.sku = 'INV-' || UPPER(SUBSTRING(i.id::text FROM 1 FOR 8))
                OR p.sku = 'INV-' || UPPER(SUBSTRING(i.id::text FROM 1 FOR 12)))`,
        [qty, productId, ctx.businessId]
      );
    }

    const payRes = await client.query<{ method: string; amount_paisa: string | number }>(
      `SELECT method, amount_paisa FROM payments WHERE sale_id = $1 AND business_id = $2 LIMIT 1`,
      [saleId, ctx.businessId]
    );
    const payment = payRes.rows[0];

    const sessionId = sale.cash_session_id ? String(sale.cash_session_id) : null;
    if (payment?.method === "CASH" && sessionId) {
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
        const nextExpected = Math.max(
          0,
          Number(session.expected_closing_paisa ?? 0) - Number(payment.amount_paisa ?? 0)
        );
        await client.query(
          `UPDATE cash_sessions SET expected_closing_paisa = $1 WHERE id = $2`,
          [nextExpected, session.id]
        );
      }
    }

    await client.query(
      `INSERT INTO audit_logs (business_id, actor_name, action_type, description, metadata)
       VALUES ($1, $2, 'SALE_VOIDED', $3, $4::jsonb)`,
      [
        ctx.businessId,
        ctx.fullName,
        `Voided sale #${sale.receipt_number ?? saleId.slice(0, 8)}`,
        JSON.stringify({
          entity_type: "sales",
          entity_id: saleId,
          before_state: { total_paisa: sale.total_paisa, status: sale.status },
          after_state: { status: "VOIDED" },
        }),
      ]
    );
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

  await withTransaction(async (client) => {
    const [oldSaleRes, oldItemsRes, oldPayRes] = await Promise.all([
      client.query<{
        id: string;
        receipt_number: string | null;
        total_paisa: string | number;
        cash_session_id: string | null;
      }>(
        `SELECT id, receipt_number, total_paisa, cash_session_id
         FROM sales WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [payload.saleId, ctx.businessId]
      ),
      client.query<{ product_id: string | null; quantity: string | number }>(
        `SELECT product_id, quantity FROM sale_items WHERE sale_id = $1 AND business_id = $2`,
        [payload.saleId, ctx.businessId]
      ),
      client.query<{ id: string; method: string; amount_paisa: string | number }>(
        `SELECT id, method, amount_paisa FROM payments WHERE sale_id = $1 AND business_id = $2 LIMIT 1 FOR UPDATE`,
        [payload.saleId, ctx.businessId]
      ),
    ]);

    const oldSale = oldSaleRes.rows[0];
    if (!oldSale) throw new Error("Original sale not found.");
    const oldItems = oldItemsRes.rows;
    const oldPayment = oldPayRes.rows[0] ?? null;

    // 1. Restore stock from old product lines
    for (const item of oldItems) {
      const productId = item.product_id ? String(item.product_id) : null;
      const qty = Number(item.quantity ?? 0);
      if (!productId || qty <= 0) continue;

      const lotRes = await client.query<{ id: string; remaining_qty: string | number }>(
        `SELECT id, remaining_qty FROM inventory_lots
         WHERE business_id = $1 AND product_id = $2
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [ctx.businessId, productId]
      );
      if (lotRes.rows[0]) {
        const nextRem = Number(lotRes.rows[0].remaining_qty ?? 0) + qty;
        await client.query(`UPDATE inventory_lots SET remaining_qty = $1 WHERE id = $2`, [
          nextRem,
          lotRes.rows[0].id,
        ]);
      }
    }

    // 2. Ensure default print service exists for custom lines
    let defaultPrintServiceId: string | null = null;
    if (payload.lines.some((l) => l.kind !== "PRODUCT" && !l.service_id)) {
      const existingSrv = await client.query<{ id: string }>(
        `SELECT id FROM services WHERE business_id = $1 AND name = 'Print & Photocopy' LIMIT 1`,
        [ctx.businessId]
      );
      if (existingSrv.rows[0]?.id) {
        defaultPrintServiceId = existingSrv.rows[0].id;
      } else {
        const createdSrv = await client.query<{ id: string }>(
          `INSERT INTO services (business_id, service_code, name, default_price_paisa, currency, status)
           VALUES ($1, 'print-custom', 'Print & Photocopy', 0, 'PKR', 'ACTIVE')
           ON CONFLICT (business_id, service_code) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [ctx.businessId]
        );
        defaultPrintServiceId = createdSrv.rows[0]?.id ?? null;
      }
    }

    // 3. Replace sale_items and deduct new stock
    await client.query(
      `DELETE FROM sale_items WHERE sale_id = $1 AND business_id = $2`,
      [payload.saleId, ctx.businessId]
    );

    for (const line of payload.lines) {
      const lineTotalPaisa = Math.round(line.quantity * line.unit_price_paisa);
      const isProd = line.kind === "PRODUCT" && Boolean(line.product_id);
      const serviceId = isProd ? null : (line.service_id ?? defaultPrintServiceId);
      const kind = isProd ? "PRODUCT" : serviceId ? "SERVICE" : "CUSTOM";

      await client.query(
        `INSERT INTO sale_items (
           business_id, sale_id, item_kind, product_id, service_id,
           description, item_name, quantity, unit_price_paisa,
           line_total_paisa, total_paisa, unit_cost_snapshot_paisa, cost_price_paisa, currency
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'PKR')`,
        [
          ctx.businessId,
          payload.saleId,
          kind,
          isProd ? line.product_id : null,
          serviceId,
          line.description,
          line.description,
          line.quantity,
          line.unit_price_paisa,
          lineTotalPaisa,
          lineTotalPaisa,
          line.unit_cost_paisa ?? 0,
          line.unit_cost_paisa ?? 0,
        ]
      );

      if (isProd && line.product_id && line.quantity > 0) {
        let remToDeduct = line.quantity;
        const { rows: lots } = await client.query<{ id: string; remaining_qty: string | number }>(
          `SELECT id, remaining_qty FROM inventory_lots
           WHERE business_id = $1 AND product_id = $2 AND remaining_qty > 0
           ORDER BY created_at ASC FOR UPDATE`,
          [ctx.businessId, line.product_id]
        );

        for (const lot of lots) {
          if (remToDeduct <= 0) break;
          const lotRem = Number(lot.remaining_qty ?? 0);
          const take = Math.min(lotRem, remToDeduct);
          await client.query(`UPDATE inventory_lots SET remaining_qty = $1 WHERE id = $2`, [
            lotRem - take,
            lot.id,
          ]);
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
    const cleanCustomer = payload.customerName.trim();

    await client.query(
      `UPDATE sales
       SET customer_name = $1,
           notes = $2,
           subtotal_paisa = $3,
           discount_paisa = $4,
           total_paisa = $5,
           paid_paisa = $6,
           updated_at = NOW()
       WHERE id = $7 AND business_id = $8`,
      [
        cleanCustomer || "Walk-in Customer",
        cleanCustomer ? `Customer: ${cleanCustomer}` : null,
        subtotalPaisa,
        discountPaisa,
        newTotalPaisa,
        newTotalPaisa,
        payload.saleId,
        ctx.businessId,
      ]
    );

    if (oldPayment?.id) {
      await client.query(
        `UPDATE payments SET method = $1, amount_paisa = $2 WHERE id = $3`,
        [payload.paymentMethod, newTotalPaisa, oldPayment.id]
      );
    }

    // 5. Adjust open cash drawer if payment method or cash amount changed
    const sessionId = oldSale.cash_session_id ? String(oldSale.cash_session_id) : null;
    if (sessionId) {
      const oldCash = oldPayment?.method === "CASH" ? Number(oldPayment.amount_paisa ?? 0) : 0;
      const newCash = payload.paymentMethod === "CASH" ? newTotalPaisa : 0;
      const cashDelta = newCash - oldCash;

      if (cashDelta !== 0) {
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
            [
              Math.max(0, Number(session.expected_closing_paisa ?? 0) + cashDelta),
              session.id,
            ]
          );
        }
      }
    }

    // 6. Log permanent audit trail entry
    await client.query(
      `INSERT INTO audit_logs (business_id, actor_name, action_type, description, metadata)
       VALUES ($1, $2, 'SALE_EDITED', $3, $4::jsonb)`,
      [
        ctx.businessId,
        ctx.fullName,
        `Edited sale #${oldSale.receipt_number ?? payload.saleId.slice(0, 8)}`,
        JSON.stringify({
          entity_type: "sales",
          entity_id: payload.saleId,
          before_state: {
            total_paisa: oldSale.total_paisa,
            payment_method: oldPayment?.method ?? "CASH",
            item_count: oldItems.length,
          },
          after_state: {
            total_paisa: newTotalPaisa,
            payment_method: payload.paymentMethod,
            item_count: payload.lines.length,
          },
        }),
      ]
    );
  });

  revalidatePath("/sales");
  revalidatePath("/sales-history");
  revalidatePath("/pos");
  revalidatePath("/inventory");
  revalidatePath("/shifts");
  revalidatePath("/dashboard");
}
