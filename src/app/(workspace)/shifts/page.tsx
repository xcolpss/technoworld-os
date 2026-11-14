import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import {
  ShiftsManager,
  type ShiftSessionRecord,
  type TerminalOption,
} from "@/components/shifts/shifts-manager";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { closeShiftAction, openShiftAction } from "./actions";

export default async function ShiftsPage() {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const admin = createSupabaseAdminClient();

  let [{ data: rawTerminals }, { data: rawSessions }, { data: rawSales }, { data: rawPayments }, { data: rawExpenses }] = await Promise.all([
    admin
      .from("terminals")
      .select("*")
      .eq("business_id", ctx.businessId)
      .order("code", { ascending: true }),
    admin
      .from("cash_sessions")
      .select("*, terminals ( code, name )")
      .eq("business_id", ctx.businessId)
      .order("opened_at", { ascending: false })
      .limit(100),
    admin
      .from("sales")
      .select("id, status, created_at")
      .eq("business_id", ctx.businessId),
    admin
      .from("payments")
      .select("sale_id, method, amount_paisa, status")
      .eq("business_id", ctx.businessId),
    admin
      .from("expenses")
      .select("amount_paisa, payment_source, cash_session_id, expense_date, created_at")
      .eq("business_id", ctx.businessId),
  ]);

  if (!rawTerminals || rawTerminals.length === 0) {
    const { data: createdTerm } = await admin
      .from("terminals")
      .insert({
        business_id: ctx.businessId,
        code: "PC-01",
        name: "Main Counter",
        status: "ACTIVE",
      })
      .select("*")
      .single();

    if (createdTerm) {
      rawTerminals = [createdTerm];
    }
  }

  const terminals: TerminalOption[] = (rawTerminals ?? []).map(
    (t: Record<string, unknown>) => ({
      id: String(t.id),
      code: String(t.code ?? "PC"),
      name: String(t.name ?? "Counter"),
    })
  );

  const activeSaleIds = new Set<string>();
  for (const s of (rawSales ?? []) as Array<Record<string, unknown>>) {
    const st = String(s.status ?? "").toUpperCase();
    if (!["VOID", "VOIDED", "CANCELLED"].includes(st)) {
      activeSaleIds.add(String(s.id));
    }
  }

  const paymentsBySale = new Map<string, { method: string; amount: number }[]>();
  for (const p of (rawPayments ?? []) as Array<Record<string, unknown>>) {
    const sid = String(p.sale_id);
    if (!activeSaleIds.has(sid)) continue;
    const list = paymentsBySale.get(sid) ?? [];
    list.push({
      method: String(p.method ?? "CASH").toUpperCase(),
      amount: Number(p.amount_paisa ?? 0),
    });
    paymentsBySale.set(sid, list);
  }

  const sessions: ShiftSessionRecord[] = (rawSessions ?? []).map(
    (s: Record<string, unknown>) => {
      const tObj = Array.isArray(s.terminals) ? s.terminals[0] : s.terminals;
      const tRec = (tObj ?? {}) as Record<string, unknown>;

      const sessionId = String(s.id);
      const openedAt = s.opened_at ? new Date(String(s.opened_at)) : new Date();
      const closedAt = s.closed_at ? new Date(String(s.closed_at)) : null;

      // Compute sales and expenses attributed to this shift's timeframe
      let cashSales = 0;
      let jazzCash = 0;
      let easyPaisa = 0;
      let bank = 0;

      for (const [sid, pays] of paymentsBySale.entries()) {
        // Find sale date
        const saleRecord = (rawSales ?? []).find(
          (x: Record<string, unknown>) => String(x.id) === sid
        );
        if (!saleRecord || !saleRecord.created_at) continue;
        const saleDate = new Date(String(saleRecord.created_at));

        const isWithinShift =
          saleDate >= openedAt && (closedAt === null || saleDate <= closedAt);

        if (isWithinShift) {
          for (const pay of pays) {
            if (pay.method === "JAZZCASH") jazzCash += pay.amount;
            else if (pay.method === "EASYPAISA") easyPaisa += pay.amount;
            else if (pay.method === "BANK_TRANSFER") bank += pay.amount;
            else cashSales += pay.amount;
          }
        }
      }

      let shiftExpenses = 0;
      for (const exp of (rawExpenses ?? []) as Array<Record<string, unknown>>) {
        const expSessionId = exp.cash_session_id ? String(exp.cash_session_id) : null;
        const expDate = exp.created_at ? new Date(String(exp.created_at)) : new Date();
        const isMatchedSession = expSessionId === sessionId;
        const isWithinTime =
          expSessionId === null &&
          expDate >= openedAt &&
          (closedAt === null || expDate <= closedAt);

        if (isMatchedSession || isWithinTime) {
          shiftExpenses += Number(exp.amount_paisa ?? 0);
        }
      }

      const openedPk = new Intl.DateTimeFormat("en-PK", {
        timeZone: "Asia/Karachi",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(openedAt);

      let closedPk: string | null = null;
      if (closedAt) {
        closedPk = new Intl.DateTimeFormat("en-PK", {
          timeZone: "Asia/Karachi",
          dateStyle: "medium",
          timeStyle: "short",
        }).format(closedAt);
      }

      return {
        id: sessionId,
        terminal_id: String(s.terminal_id),
        terminal_code: String(tRec.code ?? "PC-01"),
        terminal_name: String(tRec.name ?? "Counter"),
        status: String(s.status ?? "OPEN") as "OPEN" | "CLOSED",
        opening_float_paisa: Number(s.opening_float_paisa ?? 0),
        expected_closing_paisa: Number(s.expected_closing_paisa ?? 0),
        actual_closing_paisa: Number(s.actual_closing_paisa ?? 0),
        variance_paisa: Number(s.variance_paisa ?? 0),
        notes: s.notes ? String(s.notes) : null,
        opened_pk: openedPk,
        closed_pk: closedPk,
        financials: {
          cashSalesPaisa: cashSales,
          digitalSalesPaisa: jazzCash + easyPaisa + bank,
          jazzCashPaisa: jazzCash,
          easyPaisaPaisa: easyPaisa,
          bankPaisa: bank,
          expensesPaisa: shiftExpenses,
        },
      };
    }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Register Handoffs & Cash Audit"
        title="Shifts & Cash Drawer Reconciliation"
        description="Optional shift handoffs (08:00–16:00 and 16:00–00:00) with complete earnings, till cash, and bank breakdown."
      />

      <ShiftsManager
        terminals={terminals}
        sessions={sessions}
        onOpenShift={openShiftAction}
        onCloseShift={closeShiftAction}
      />
    </div>
  );
}