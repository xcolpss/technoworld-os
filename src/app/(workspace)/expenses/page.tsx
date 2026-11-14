import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import {
  ExpensesManager,
  type ExpenseRecord,
  type MovementRecord,
  type OpenDrawerOption,
} from "@/components/expenses/expenses-manager";
import type { AccountBucket } from "./actions";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  adjustAccountBalanceAction,
  createExpenseAction,
  deleteExpenseAction,
  transferBetweenAccountsAction,
} from "./actions";

function normalizeBucket(raw: string | null | undefined): AccountBucket {
  const val = String(raw ?? "").toUpperCase();
  if (val === "EASYPAISA") return "EASYPAISA";
  if (val === "JAZZCASH") return "JAZZCASH";
  if (val === "BANK_TRANSFER" || val === "BANK_WALLET")
    return "BANK_TRANSFER";
  if (val === "CASH_IN_HAND" || val === "OWNER_CASH") return "CASH_IN_HAND";
  return "CASH_TILL";
}

export default async function ExpensesPage() {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const admin = createSupabaseAdminClient();

  const todayPk = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [
    { data: rawExpenses },
    { data: rawMovements },
    { data: openSessions },
    { data: allSessions },
    { data: validSales },
    { data: allPayments },
  ] = await Promise.all([
    admin
      .from("expenses")
      .select("*")
      .eq("business_id", ctx.businessId)
      .order("created_at", { ascending: false })
      .limit(300),
    admin
      .from("account_movements")
      .select("*")
      .eq("business_id", ctx.businessId)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("cash_sessions")
      .select("id, expected_closing_paisa, terminals ( code, name )")
      .eq("business_id", ctx.businessId)
      .eq("status", "OPEN")
      .order("opened_at", { ascending: true }),
    admin
      .from("cash_sessions")
      .select("opening_float_paisa")
      .eq("business_id", ctx.businessId),
    admin
      .from("sales")
      .select("id, status")
      .eq("business_id", ctx.businessId),
    admin
      .from("payments")
      .select("sale_id, method, amount_paisa, status")
      .eq("business_id", ctx.businessId),
  ]);

  // Build set of non-voided sale IDs so voided bills never inflate wallet balances
  const activeSaleIds = new Set<string>();
  for (const s of (validSales ?? []) as Array<Record<string, unknown>>) {
    const st = String(s.status ?? "").toUpperCase();
    if (!["VOID", "VOIDED", "CANCELLED"].includes(st)) {
      activeSaleIds.add(String(s.id));
    }
  }

  // Initialize exact 5-account ledger balances
  const balances: Record<AccountBucket, number> = {
    CASH_TILL: 0,
    CASH_IN_HAND: 0,
    EASYPAISA: 0,
    JAZZCASH: 0,
    BANK_TRANSFER: 0,
  };

  // 1. Add opening floats into CASH_TILL
  for (const sess of (allSessions ?? []) as Array<Record<string, unknown>>) {
    balances.CASH_TILL += Number(sess.opening_float_paisa ?? 0);
  }

  // 2. Add all completed sale payments into their respective buckets
  for (const p of (allPayments ?? []) as Array<Record<string, unknown>>) {
    if (!activeSaleIds.has(String(p.sale_id))) continue;
    const method = String(p.method ?? "CASH").toUpperCase();
    const amt = Number(p.amount_paisa ?? 0);
    if (method === "EASYPAISA") balances.EASYPAISA += amt;
    else if (method === "JAZZCASH") balances.JAZZCASH += amt;
    else if (method === "BANK_TRANSFER") balances.BANK_TRANSFER += amt;
    else balances.CASH_TILL += amt;
  }

  // 3. Subtract all recorded expenses from the exact account they were paid from
  for (const exp of (rawExpenses ?? []) as Array<Record<string, unknown>>) {
    const bucket = normalizeBucket(String(exp.payment_source ?? "CASH_TILL"));
    balances[bucket] -= Number(exp.amount_paisa ?? 0);
  }

  // 4. Apply all account transfers & manual balance adjustments
  for (const mov of (rawMovements ?? []) as Array<Record<string, unknown>>) {
    const amt = Number(mov.amount_paisa ?? 0);
    if (mov.from_account) {
      balances[normalizeBucket(String(mov.from_account))] -= amt;
    }
    if (mov.to_account) {
      balances[normalizeBucket(String(mov.to_account))] += amt;
    }
  }

  const openDrawers: OpenDrawerOption[] = (openSessions ?? []).map(
    (s: Record<string, unknown>) => {
      const tObj = Array.isArray(s.terminals) ? s.terminals[0] : s.terminals;
      const tRec = (tObj ?? {}) as Record<string, unknown>;
      return {
        id: String(s.id),
        label: `${String(tRec.code ?? "PC")} — ${String(tRec.name ?? "Counter")}`,
        expected_closing_paisa: Number(s.expected_closing_paisa ?? 0),
      };
    }
  );

  const expenses: ExpenseRecord[] = (rawExpenses ?? []).map(
    (row: Record<string, unknown>) => {
      const created = row.created_at
        ? new Date(String(row.created_at))
        : new Date();
      const timePk = new Intl.DateTimeFormat("en-PK", {
        timeZone: "Asia/Karachi",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(created);

      return {
        id: String(row.id),
        category: String(row.category ?? "Shop Expense"),
        description: String(row.description ?? ""),
        amount_paisa: Number(row.amount_paisa ?? 0),
        payment_source: String(row.payment_source ?? "CASH_TILL"),
        expense_date: String(row.expense_date ?? todayPk).slice(0, 10),
        notes: row.notes ? String(row.notes) : null,
        created_time_pk: timePk,
      };
    }
  );

  const movements: MovementRecord[] = (rawMovements ?? []).map(
    (row: Record<string, unknown>) => {
      const created = row.created_at
        ? new Date(String(row.created_at))
        : new Date();
      const stamp = new Intl.DateTimeFormat("en-PK", {
        timeZone: "Asia/Karachi",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(created);

      return {
        id: String(row.id),
        movement_kind:
          String(row.movement_kind) === "ADJUSTMENT"
            ? "ADJUSTMENT"
            : "TRANSFER",
        from_account: row.from_account ? String(row.from_account) : null,
        to_account: row.to_account ? String(row.to_account) : null,
        amount_paisa: Number(row.amount_paisa ?? 0),
        reason: String(row.reason ?? ""),
        created_pk: stamp,
      };
    }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Treasury, Wallets & Expenses"
        title="Expenses & Account Balances"
        description="Track Cash in Till, Cash in Hand, EasyPaisa, JazzCash & Bank balances — log expenses, transfer funds, and reconcile balances with full audit logging."
      />

      <ExpensesManager
        expenses={expenses}
        movements={movements}
        accountBalancesPaisa={balances}
        openDrawers={openDrawers}
        todayPk={todayPk}
        onCreateExpense={createExpenseAction}
        onDeleteExpense={deleteExpenseAction}
        onTransferAccounts={transferBetweenAccountsAction}
        onAdjustBalance={adjustAccountBalanceAction}
      />
    </div>
  );
}