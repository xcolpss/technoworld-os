"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

  const cleanName = name.trim();
  if (!cleanName) throw new Error("Category name is required.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("inventory_categories").insert({
    business_id: ctx.businessId,
    name: cleanName,
  });

  if (error) throw new Error(`Failed to create category: ${error.message}`);
  revalidatePath("/inventory");
}

export async function updateCategoryAction(id: string, newName: string) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const cleanName = newName.trim();
  if (!cleanName) throw new Error("Category name cannot be empty.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("inventory_categories")
    .update({ name: cleanName })
    .eq("id", id)
    .eq("business_id", ctx.businessId);

  if (error) throw new Error(`Failed to update category: ${error.message}`);
  revalidatePath("/inventory");
}

export async function deleteCategoryAction(id: string) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("inventory_categories")
    .delete()
    .eq("id", id)
    .eq("business_id", ctx.businessId);

  if (error) throw new Error(`Failed to delete category: ${error.message}`);
  revalidatePath("/inventory");
}

export async function createInventoryItemAction(payload: InventoryItemPayload) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const cleanName = String(payload.name || "").trim();
  if (!cleanName) throw new Error("Product name is required.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("inventory_items").insert({
    business_id: ctx.businessId,
    name: cleanName,
    sku: payload.sku?.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
    category: payload.category.trim() || "General",
    stock_quantity: Math.max(0, Number(payload.stockQuantity) || 0),
    cost_price_paisa: Math.max(0, Number(payload.costPricePaisa) || 0),
    retail_price_paisa: Math.max(0, Number(payload.retailPricePaisa) || 0),
    min_stock_alert: Math.max(0, Number(payload.minStockAlert) || 5),
    unit: payload.unit?.trim() || "pcs",
    notes: payload.notes?.trim() || null,
  });

  if (error) throw new Error(`Failed to create inventory item: ${error.message}`);
  revalidatePath("/inventory");
  revalidatePath("/pos");
}

export async function updateInventoryItemAction(id: string, payload: InventoryItemPayload) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("inventory_items")
    .update({
      name: payload.name.trim(),
      sku: payload.sku?.trim() || null,
      category: payload.category.trim(),
      stock_quantity: Math.max(0, Number(payload.stockQuantity) || 0),
      cost_price_paisa: Math.max(0, Number(payload.costPricePaisa) || 0),
      retail_price_paisa: Math.max(0, Number(payload.retailPricePaisa) || 0),
      min_stock_alert: Math.max(0, Number(payload.minStockAlert) || 5),
      unit: payload.unit.trim(),
      notes: payload.notes?.trim() || null,
    })
    .eq("id", id)
    .eq("business_id", ctx.businessId);

  if (error) throw new Error(`Failed to update item: ${error.message}`);
  revalidatePath("/inventory");
  revalidatePath("/pos");
}

export async function adjustStockAction(id: string, delta: number) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: current, error: fetchErr } = await admin
    .from("inventory_items")
    .select("stock_quantity")
    .eq("id", id)
    .eq("business_id", ctx.businessId)
    .single();

  if (fetchErr || !current) throw new Error("Item not found.");

  const newQty = Math.max(0, Number(current.stock_quantity || 0) + delta);
  const { error: updateErr } = await admin
    .from("inventory_items")
    .update({ stock_quantity: newQty })
    .eq("id", id)
    .eq("business_id", ctx.businessId);

  if (updateErr) throw new Error(`Failed to adjust stock: ${updateErr.message}`);
  revalidatePath("/inventory");
  revalidatePath("/pos");
}

export async function deleteInventoryItemAction(id: string) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("inventory_items")
    .delete()
    .eq("id", id)
    .eq("business_id", ctx.businessId);

  if (error) throw new Error(`Failed to delete item: ${error.message}`);
  revalidatePath("/inventory");
  revalidatePath("/pos");
}