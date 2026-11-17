import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { InventoryManager, type InventoryItemRecord, type CategoryRecord } from "@/components/inventory/inventory-manager";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { hasRequiredRole } from "@/lib/auth/permissions";
import { AccessRestricted } from "@/components/auth/access-restricted";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  createInventoryItemAction,
  updateInventoryItemAction,
  adjustStockAction,
  deleteInventoryItemAction,
} from "@/app/(workspace)/inventory/actions";

export default async function InventoryPage() {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  if (!hasRequiredRole(ctx.role, ["OWNER", "MANAGER"])) {
    return (
      <AccessRestricted
        currentRole={ctx.role}
        requiredRoles={["OWNER", "MANAGER"]}
        sectionName="Inventory Management"
      />
    );
  }

  const admin = createSupabaseAdminClient();
  const [{ data: rawCats }, { data: rawItems }] = await Promise.all([
    admin.from("inventory_categories").select("*").eq("business_id", ctx.businessId).order("name", { ascending: true }),
    admin.from("inventory_items").select("*").eq("business_id", ctx.businessId).order("name", { ascending: true }),
  ]);

  const categories: CategoryRecord[] = (rawCats ?? []).map((c: Record<string, unknown>) => ({
    id: String(c.id),
    name: String(c.name ?? ""),
  }));

  const items: InventoryItemRecord[] = (rawItems ?? []).map((i: Record<string, unknown>) => ({
    id: String(i.id),
    name: String(i.name ?? ""),
    sku: i.sku ? String(i.sku) : null,
    category: String(i.category ?? "General"),
    stock_quantity: Number(i.stock_quantity ?? 0),
    cost_price_paisa: Number(i.cost_price_paisa ?? 0),
    retail_price_paisa: Number(i.retail_price_paisa ?? 0),
    min_stock_alert: Number(i.min_stock_alert ?? 5),
    unit: String(i.unit ?? "pcs"),
    notes: i.notes ? String(i.notes) : null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Stock Control & Warehousing"
        title="Inventory Intelligence Center"
        description="Manage product categories, stock quantities, SKU assets, valuation, and rapid inventory adjustments."
      />

      <InventoryManager
        categories={categories}
        items={items}
        onCreateCategory={createCategoryAction}
        onUpdateCategory={updateCategoryAction}
        onDeleteCategory={deleteCategoryAction}
        onCreateItem={createInventoryItemAction}
        onUpdateItem={updateInventoryItemAction}
        onAdjustStock={adjustStockAction}
        onDeleteItem={deleteInventoryItemAction}
      />
    </div>
  );
}