import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import {
  SalesHistoryManager,
  type CatalogPickerOption,
  type SaleLineRecord,
  type SaleRecord,
} from "@/components/sales/sales-history-manager";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { updateExistingSaleAction, voidSaleAction } from "./actions";

export default async function SalesHistoryPage() {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const admin = createSupabaseAdminClient();

  const [
    { data: rawSales },
    { data: rawItems },
    { data: rawPayments },
    { data: editLogs },
    { data: products },
    { data: services },
  ] = await Promise.all([
    admin
      .from("sales")
      .select("*")
      .eq("business_id", ctx.businessId)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("sale_items")
      .select("*")
      .eq("business_id", ctx.businessId),
    admin
      .from("payments")
      .select("sale_id, method, amount_paisa, status")
      .eq("business_id", ctx.businessId),
    admin
      .from("audit_logs")
      .select("entity_id, before_state, after_state, created_at")
      .eq("business_id", ctx.businessId)
      .eq("action", "SALE_EDITED")
      .order("created_at", { ascending: false }),
    admin
      .from("products")
      .select("id, sku, name, sale_price_paisa, cost_price_paisa")
      .eq("business_id", ctx.businessId)
      .eq("status", "ACTIVE")
      .order("name", { ascending: true }),
    admin
      .from("services")
      .select("*")
      .eq("business_id", ctx.businessId)
      .eq("status", "ACTIVE")
      .order("name", { ascending: true }),
  ]);

  const itemsBySale = new Map<string, SaleLineRecord[]>();
  for (const row of (rawItems ?? []) as Array<Record<string, unknown>>) {
    const saleId = String(row.sale_id);
    const list = itemsBySale.get(saleId) ?? [];
    const kindVal = String(row["item_kind"] ?? "PRODUCT");
    list.push({
      id: String(row.id),
      kind: kindVal === "PRODUCT" ? "PRODUCT" : "SERVICE",
      product_id: row.product_id ? String(row.product_id) : null,
      service_id: row.service_id ? String(row.service_id) : null,
      description: String(row["description"] ?? "Item"),
      quantity: Number(row.quantity ?? 1),
      unit_price_paisa: Number(row.unit_price_paisa ?? 0),
      unit_cost_paisa: Number(row.unit_cost_paisa ?? 0),
      line_total_paisa: Number(row.line_total_paisa ?? 0),
    });
    itemsBySale.set(saleId, list);
  }

  const paymentBySale = new Map<string, string>();
  for (const p of (rawPayments ?? []) as Array<Record<string, unknown>>) {
    paymentBySale.set(String(p.sale_id), String(p.method ?? "CASH"));
  }

  const editInfoBySale = new Map<string, string>();
  for (const log of (editLogs ?? []) as Array<Record<string, unknown>>) {
    const sid = String(log.entity_id ?? "");
    if (!sid || editInfoBySale.has(sid)) continue;
    const before = (log.before_state ?? {}) as Record<string, unknown>;
    const after = (log.after_state ?? {}) as Record<string, unknown>;
    const oldRs = Math.round(Number(before.total_paisa ?? 0) / 100);
    const newRs = Math.round(Number(after.total_paisa ?? 0) / 100);
    editInfoBySale.set(sid, `Modified (Rs. ${oldRs} → Rs. ${newRs})`);
  }

  const todayPk = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const sales: SaleRecord[] = (rawSales ?? []).map(
    (s: Record<string, unknown>) => {
      const id = String(s.id);
      const lines = itemsBySale.get(id) ?? [];
      const totalPaisa = Number(s.total_paisa ?? 0);
      const totalCostPaisa = lines.reduce(
        (sum, l) => sum + l.quantity * l.unit_cost_paisa,
        0
      );
      const profitPaisa = Math.max(0, totalPaisa - totalCostPaisa);

      const createdAt = s.created_at
        ? new Date(String(s.created_at))
        : new Date();
      const datePk = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Karachi",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(createdAt);

      const timePk = new Intl.DateTimeFormat("en-PK", {
        timeZone: "Asia/Karachi",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(createdAt);

      let customerName = "Walk-in Customer";
      if (s.customer_name && String(s.customer_name).trim()) {
        customerName = String(s.customer_name).trim();
      } else if (s.notes && String(s.notes).startsWith("Customer:")) {
        customerName = String(s.notes).replace(/^Customer:\s*/i, "").trim();
      }

      return {
        id,
        sale_number: String(s["receipt_number"] ?? id.slice(0, 8).toUpperCase()),
        customer_name: customerName,
        created_at_iso: createdAt.toISOString(),
        date_pk: datePk,
        time_pk: timePk,
        subtotal_paisa: Number(s.subtotal_paisa ?? totalPaisa),
        discount_paisa: Number(s.discount_paisa ?? 0),
        total_paisa: totalPaisa,
        profit_paisa: profitPaisa,
        payment_method: paymentBySale.get(id) ?? "CASH",
        status: String(s.status ?? "COMPLETED"),
        was_edited: editInfoBySale.has(id),
        edit_summary: editInfoBySale.get(id) ?? null,
        lines,
      };
    }
  );

  const catalogOptions: CatalogPickerOption[] = [
    ...(products ?? []).map((p: Record<string, unknown>) => ({
      id: String(p.id),
      kind: "PRODUCT" as const,
      code: String(p.sku ?? ""),
      name: String(p.name ?? ""),
      price_paisa: Number(p.sale_price_paisa ?? 0),
      cost_paisa: Number(p.cost_price_paisa ?? 0),
    })),
    ...(services ?? []).map((srv: Record<string, unknown>) => ({
      id: String(srv.id),
      kind: "SERVICE" as const,
      code: String(srv.code ?? srv.sku ?? "SRV"),
      name: String(srv.name ?? ""),
      price_paisa: Number(
        srv.default_price_paisa ?? srv.base_price_paisa ?? srv.price_paisa ?? 0
      ),
      cost_paisa: 0,
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Daily Closing & Fraud Control"
        title="Sales History & Daily Report"
        description="Edit past bills when customers add items, reprint thermal receipts, and inspect highlighted voided or modified bills."
      />

      <SalesHistoryManager
        sales={sales}
        catalogOptions={catalogOptions}
        todayPk={todayPk}
        onVoidSale={voidSaleAction}
        onUpdateSale={updateExistingSaleAction}
      />
    </div>
  );
}