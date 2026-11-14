import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import {
  CustomersManager,
  type CustomerRecord,
  type LedgerEntry,
} from "@/components/customers/customers-manager";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createCustomerAction, recordRepaymentAction } from "./actions";

export default async function CustomersPage() {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const admin = createSupabaseAdminClient();

  const [{ data: rawCustomers }, { data: rawLedger }, { data: rawSales }] =
    await Promise.all([
      admin
        .from("customers")
        .select("*")
        .eq("business_id", ctx.businessId)
        .order("name", { ascending: true }),
      admin
        .from("customer_ledger")
        .select("*")
        .eq("business_id", ctx.businessId)
        .order("created_at", { ascending: false }),
      admin
        .from("sales")
        .select("id, total_paisa, status")
        .eq("business_id", ctx.businessId),
    ]);

  const ledgerByCust = new Map<string, LedgerEntry[]>();
  const totalsByCust = new Map<
    string,
    { credit: number; repaid: number }
  >();

  for (const entry of (rawLedger ?? []) as Array<Record<string, unknown>>) {
    const cid = String(entry.customer_id);
    const list = ledgerByCust.get(cid) ?? [];
    const typeVal = String(entry.entry_type) as
      | "CREDIT_SALE"
      | "REPAYMENT"
      | "ADJUSTMENT";
    const amt = Number(entry.amount_paisa ?? 0);

    const created = entry.created_at
      ? new Date(String(entry.created_at))
      : new Date();
    const stamp = new Intl.DateTimeFormat("en-PK", {
      timeZone: "Asia/Karachi",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(created);

    list.push({
      id: String(entry.id),
      entry_type: typeVal,
      amount_paisa: amt,
      payment_method: entry.payment_method
        ? String(entry.payment_method)
        : null,
      notes: entry.notes ? String(entry.notes) : null,
      created_pk: stamp,
    });
    ledgerByCust.set(cid, list);

    const cur = totalsByCust.get(cid) ?? { credit: 0, repaid: 0 };
    if (typeVal === "CREDIT_SALE") cur.credit += amt;
    else if (typeVal === "REPAYMENT") cur.repaid += amt;
    totalsByCust.set(cid, cur);
  }

  const customers: CustomerRecord[] = (rawCustomers ?? []).map(
    (c: Record<string, unknown>) => {
      const id = String(c.id);
      const stats = totalsByCust.get(id) ?? { credit: 0, repaid: 0 };
      const udhaar = Math.max(0, stats.credit - stats.repaid);

      return {
        id,
        name: String(c.name ?? ""),
        phone: c.phone ? String(c.phone) : null,
        address: c.address ? String(c.address) : null,
        customer_type: (c.customer_type ?? "REGULAR") as
          | "REGULAR"
          | "CORPORATE"
          | "SCHOOL"
          | "VIP",
        credit_limit_paisa: Number(c.credit_limit_paisa ?? 5000000),
        notes: c.notes ? String(c.notes) : null,
        total_credit_paisa: stats.credit,
        total_repaid_paisa: stats.repaid,
        current_udhaar_paisa: udhaar,
        ledger: ledgerByCust.get(id) ?? [],
      };
    }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Credit Accounts & Udhaar Ledger"
        title="Customers & Udhaar Ledger"
        description="Manage repeat walk-ins, school/corporate accounts, outstanding credit, and installment repayments."
      />

      <CustomersManager
        customers={customers}
        onCreateCustomer={createCustomerAction}
        onRecordRepayment={recordRepaymentAction}
      />
    </div>
  );
}