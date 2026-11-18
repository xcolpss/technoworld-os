"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { assertAuthorizedRole } from "@/lib/auth/permissions";
import { dbQuery, dbQueryOne } from "@/lib/db/pool";

export interface InventoryItemPayload {
  name: string;
  sku?: string;
  category: string;
  stockQuantity: number;
  costPricePaisa: number;
  retailPricePaisa: number;
  minStockAlert: number;
  unit: string;
  notes?: string;
}

export async function createCategoryAction(name: string) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage inventory");

  const cleanName = name.trim();
  if (!cleanName) throw new Error("Category name is required.");

  await dbQuery(
    `INSERT INTO public.inventory_categories (business_id, name) VALUES ($1, $2)`,
    [ctx.businessId, cleanName]
  );

  revalidatePath("/inventory");
  revalidatePath("/pos");
}

export async function updateCategoryAction(id: string, newName: string) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage inventory");

  const cleanName = newName.trim();
  if (!cleanName) throw new Error("Category name cannot be empty.");

  await dbQuery(
    `UPDATE public.inventory_categories SET name = $1 WHERE id = $2 AND business_id = $3`,
    [cleanName, id, ctx.businessId]
  );

  revalidatePath("/inventory");
  revalidatePath("/pos");
}

export async function deleteCategoryAction(id: string) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage inventory");

  await dbQuery(
    `DELETE FROM public.inventory_categories WHERE id = $1 AND business_id = $2`,
    [id, ctx.businessId]
  );

  revalidatePath("/inventory");
  revalidatePath("/pos");
}

export async function createInventoryItemAction(payload: InventoryItemPayload) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage inventory");

  const cleanName = String(payload.name || "").trim();
  if (!cleanName) throw new Error("Product name is required.");

  const sku =
    payload.sku?.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;

  await dbQuery(
    `INSERT INTO public.inventory_items
       (business_id, name, sku, category, stock_quantity, cost_price_paisa, retail_price_paisa, min_stock_alert, unit, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      ctx.businessId,
      cleanName,
      sku,
      payload.category.trim() || "General",
      Math.max(0, Number(payload.stockQuantity) || 0),
      Math.max(0, Number(payload.costPricePaisa) || 0),
      Math.max(0, Number(payload.retailPricePaisa) || 0),
      Math.max(0, Number(payload.minStockAlert) || 5),
      payload.unit?.trim() || "pcs",
      payload.notes?.trim() || null,
    ]
  );

  revalidatePath("/inventory");
  revalidatePath("/pos");
  revalidatePath("/dashboard");
}

export async function updateInventoryItemAction(
  id: string,
  payload: InventoryItemPayload
) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage inventory");

  await dbQuery(
    `UPDATE public.inventory_items
     SET name = $1, sku = $2, category = $3, stock_quantity = $4,
         cost_price_paisa = $5, retail_price_paisa = $6,
         min_stock_alert = $7, unit = $8, notes = $9
     WHERE id = $10 AND business_id = $11`,
    [
      payload.name.trim(),
      payload.sku?.trim() || null,
      payload.category.trim(),
      Math.max(0, Number(payload.stockQuantity) || 0),
      Math.max(0, Number(payload.costPricePaisa) || 0),
      Math.max(0, Number(payload.retailPricePaisa) || 0),
      Math.max(0, Number(payload.minStockAlert) || 5),
      payload.unit.trim(),
      payload.notes?.trim() || null,
      id,
      ctx.businessId,
    ]
  );

  revalidatePath("/inventory");
  revalidatePath("/pos");
  revalidatePath("/dashboard");
}

export async function adjustStockAction(id: string, delta: number) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage inventory");

  const current = await dbQueryOne<{ stock_quantity: number }>(
    `SELECT stock_quantity FROM public.inventory_items WHERE id = $1 AND business_id = $2 LIMIT 1`,
    [id, ctx.businessId]
  );
  if (!current) throw new Error("Item not found.");

  const newQty = Math.max(0, Number(current.stock_quantity || 0) + delta);
  await dbQuery(
    `UPDATE public.inventory_items SET stock_quantity = $1 WHERE id = $2 AND business_id = $3`,
    [newQty, id, ctx.businessId]
  );

  revalidatePath("/inventory");
  revalidatePath("/pos");
  revalidatePath("/dashboard");
}

export async function deleteInventoryItemAction(id: string) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER", "MANAGER"], "manage inventory");

  await dbQuery(
    `DELETE FROM public.inventory_items WHERE id = $1 AND business_id = $2`,
    [id, ctx.businessId]
  );

  revalidatePath("/inventory");
  revalidatePath("/pos");
  revalidatePath("/dashboard");
}
