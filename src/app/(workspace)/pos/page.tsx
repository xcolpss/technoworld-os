import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { PosCounter, type PosProductItem, type PosCategoryRecord, type PrintPaperRecord, type MediaCatRecord, type ComposingServiceRecord } from "@/components/pos/pos-counter";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  completePosSaleAction,
  createPrintPaperAction,
  updatePrintPaperAction,
  deletePrintPaperAction,
  createMediaCategoryAction,
  updateMediaCategoryAction,
  deleteMediaCategoryAction,
  createComposingServiceAction,
  updateComposingServiceAction,
  deleteComposingServiceAction,
} from "@/app/(workspace)/pos/actions";

export default async function PosPage() {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const admin = createSupabaseAdminClient();

  const [
    { data: rawCats },
    { data: rawItems },
    { data: rawPapers },
    { data: rawMediaCats },
    { data: rawComposing },
  ] = await Promise.all([
    admin.from("inventory_categories").select("*").eq("business_id", ctx.businessId).order("name", { ascending: true }),
    admin.from("inventory_items").select("*").eq("business_id", ctx.businessId).order("name", { ascending: true }),
    admin.from("pos_print_papers").select("*").eq("business_id", ctx.businessId).order("name", { ascending: true }),
    admin.from("pos_media_categories").select("*").eq("business_id", ctx.businessId).order("name", { ascending: true }),
    admin.from("pos_composing_services").select("*").eq("business_id", ctx.businessId).order("name", { ascending: true }),
  ]);

  const categories: PosCategoryRecord[] = (rawCats ?? []).map((c: Record<string, unknown>) => ({
    id: String(c.id),
    name: String(c.name ?? "General"),
  }));

  const products: PosProductItem[] = (rawItems ?? []).map((i: Record<string, unknown>) => ({
    id: String(i.id),
    name: String(i.name ?? "Product"),
    sku: i.sku ? String(i.sku) : null,
    category: String(i.category ?? "General"),
    retailPricePaisa: Number(i.retail_price_paisa ?? 0),
    costPricePaisa: Number(i.cost_price_paisa ?? 0),
    stockQuantity: Number(i.stock_quantity ?? 0),
    unit: String(i.unit ?? "pcs"),
  }));

  const printPapers: PrintPaperRecord[] = (rawPapers ?? []).map((p: Record<string, unknown>) => ({
    id: String(p.id),
    name: String(p.name ?? ""),
    bwPricePaisa: Number(p.bw_price_paisa ?? 1000),
    colorPricePaisa: Number(p.color_price_paisa ?? 3000),
  }));

  const mediaCategories: MediaCatRecord[] = (rawMediaCats ?? []).map((m: Record<string, unknown>) => ({
    id: String(m.id),
    type: String(m.type ?? "MOVIE"),
    name: String(m.name ?? ""),
    defaultPricePaisa: Number(m.default_price_paisa ?? 2000), // Default Rs. 20
  }));

  const composingServices: ComposingServiceRecord[] = (rawComposing ?? []).map((cs: Record<string, unknown>) => ({
    id: String(cs.id),
    name: String(cs.name ?? ""),
    defaultPricePaisa: Number(cs.default_price_paisa ?? 50000),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fast Counter Checkout"
        title="POS Counter"
        description="Unified live retail checkout with inventory sync, printing calculator, media copies, and composing services visible upfront."
      />

      <PosCounter
        categories={categories}
        products={products}
        printPapers={printPapers}
        mediaCategories={mediaCategories}
        composingServices={composingServices}
        onCreatePaper={createPrintPaperAction}
        onUpdatePaper={updatePrintPaperAction}
        onDeletePaper={deletePrintPaperAction}
        onCreateMediaCat={createMediaCategoryAction}
        onUpdateMediaCat={updateMediaCategoryAction}
        onDeleteMediaCat={deleteMediaCategoryAction}
        onCreateComposing={createComposingServiceAction}
        onUpdateComposing={updateComposingServiceAction}
        onDeleteComposing={deleteComposingServiceAction}
        onCompleteSale={completePosSaleAction}
      />
    </div>
  );
}