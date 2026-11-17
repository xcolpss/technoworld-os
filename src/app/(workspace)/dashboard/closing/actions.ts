"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/log";

export interface ClosingExpenseEntry {
  id: string;
  description: string;
  category: string;
  amountPaisa: number;
  paidBy: string;
  method: string;
  fromDb?: boolean;
}

export interface ClosingWageEntry {
  id: string;
  name: string;
  role: string;
  wagePaisa: number;
  notes: string;
}

export interface DailyClosingRecord {
  closingDate: string;
  morningCashPaisa: number;
  eveningCashPaisa: number;
  nightCashPaisa: number;
  grossSalesPaisa: number;
  refundsPaisa: number;
  netSalesPaisa: number;
  digitalSalesPaisa: number;
  cashCollectedPaisa: number;
  liveExpensesPaisa: number;
  closingExpenses: ClosingExpenseEntry[];
  wages: ClosingWageEntry[];
  expectedClosingPaisa: number;
  actualClosingPaisa: number;
  cashDifferencePaisa: number;
  transactionCount: number;
  notes: string;
  status: "DRAFT" | "SAVED";
  savedAtIso: string | null;
  preparedByName: string | null;
}

export interface ClosingHistorySummary {
  closingDate: string;
  grossSalesPaisa: number;
  netSalesPaisa: number;
  cashCollectedPaisa: number;
  digitalSalesPaisa: number;
  totalExpensesPaisa: number;
  totalWagesPaisa: number;
  expectedClosingPaisa: number;
  actualClosingPaisa: number;
  cashDifferencePaisa: number;
  status: "DRAFT" | "SAVED";
  updatedAtIso: string;
}

export interface SaveDailyClosingPayload {
  closingDate: string;
  morningCashPaisa: number;
  eveningCashPaisa: number;
  nightCashPaisa: number;
  actualClosingPaisa: number;
  closingExpenses: ClosingExpenseEntry[];
  wages: ClosingWageEntry[];
  notes: string;
}

const DEFAULT_WAGE_STAFF: Array<{ name: string; role: string }> = [
  { name: "Ruksar", role: "Staff" },
  { name: "Shamo", role: "Staff" },
  { name: "Uncle", role: "Management" },
  { name: "Huraira", role: "Staff" },
  { name: "Murtaza", role: "Staff" },
];

function formatPkDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getPkHour(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "12";
  const hr = Number(hourStr);
  return hr === 24 ? 0 : hr;
}

function isVoidedStatus(status: unknown): boolean {
  const s = String(status ?? "").toUpperCase();
  return s === "VOIDED" || s === "CANCELLED" || s === "REFUNDED";
}

export async function loadClosingDataForDate(
  closingDate: string
): Promise<{
  record: DailyClosingRecord;
  history: ClosingHistorySummary[];
}> {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const admin = createSupabaseAdminClient();
  const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(closingDate)
    ? closingDate
    : formatPkDate();

  const [
    { data: rawSales },
    { data: rawPayments },
    { data: rawRefunds },
    { data: rawExpenses },
    { data: rawEmployees },
    { data: rawSnapshots },
    { data: rawSavedReports },
  ] = await Promise.all([
    admin
      .from("sales")
      .select("id, total_paisa, discount_paisa, status, created_at, completed_at")
      .eq("business_id", ctx.businessId)
      .order("created_at", { ascending: false })
      .range(0, 4999),
    admin
      .from("payments")
      .select("sale_id, method, amount_paisa, status, received_at")
      .eq("business_id", ctx.businessId)
      .range(0, 4999),
    admin
      .from("refunds")
      .select("sale_id, total_refund_paisa, posted_at, created_at, status")
      .eq("business_id", ctx.businessId)
      .range(0, 4999),
    admin
      .from("expenses")
      .select("id, description, category, amount_paisa, payment_source, expense_date, incurred_at, created_at")
      .eq("business_id", ctx.businessId)
      .range(0, 4999),
    admin
      .from("employees")
      .select("id, full_name, designation, salary_amount_paisa, salary_type, employment_status")
      .eq("business_id", ctx.businessId)
      .eq("employment_status", "ACTIVE"),
    admin
      .from("daily_report_snapshots")
      .select("*")
      .eq("business_id", ctx.businessId)
      .order("snapshot_date", { ascending: false })
      .limit(90),
    admin
      .from("saved_reports")
      .select("*")
      .eq("business_id", ctx.businessId)
      .eq("report_type", "DAILY_CLOSING")
      .order("created_at", { ascending: false })
      .limit(90),
  ]);

  const paymentBySale = new Map<string, { method: string; amountPaisa: number }>();
  for (const p of (rawPayments ?? []) as Array<Record<string, unknown>>) {
    paymentBySale.set(String(p.sale_id), {
      method: String(p.method ?? "CASH").toUpperCase(),
      amountPaisa: Number(p.amount_paisa ?? 0),
    });
  }

  let grossSalesPaisa = 0;
  let refundsPaisa = 0;
  let cashCollectedPaisa = 0;
  let digitalSalesPaisa = 0;
  let liveMorningCashPaisa = 0;
  let liveEveningCashPaisa = 0;
  let liveNightCashPaisa = 0;
  let transactionCount = 0;

  for (const sale of (rawSales ?? []) as Array<Record<string, unknown>>) {
    const iso = String(sale.completed_at ?? sale.created_at ?? "");
    if (!iso) continue;
    const salePkDate = formatPkDate(new Date(iso));
    if (salePkDate !== targetDate) continue;

    if (isVoidedStatus(sale.status)) {
      refundsPaisa += Number(sale.total_paisa ?? 0);
      continue;
    }

    const totalPaisa = Number(sale.total_paisa ?? 0);
    grossSalesPaisa += totalPaisa;
    transactionCount += 1;

    const payment = paymentBySale.get(String(sale.id));
    const method = payment?.method ?? "CASH";
    const hourPk = getPkHour(iso);

    if (method === "CASH") {
      cashCollectedPaisa += totalPaisa;
      if (hourPk >= 8 && hourPk < 16) {
        liveMorningCashPaisa += totalPaisa;
      } else if (hourPk >= 16 && hourPk <= 23) {
        liveEveningCashPaisa += totalPaisa;
      } else {
        liveNightCashPaisa += totalPaisa;
      }
    } else {
      digitalSalesPaisa += totalPaisa;
    }
  }

  for (const r of (rawRefunds ?? []) as Array<Record<string, unknown>>) {
    const rStatus = String(r.status ?? "POSTED").toUpperCase();
    if (rStatus === "CANCELLED" || rStatus === "VOIDED" || rStatus === "DRAFT") continue;
    const rDate = r.posted_at
      ? formatPkDate(new Date(String(r.posted_at)))
      : r.created_at
      ? formatPkDate(new Date(String(r.created_at)))
      : "";
    if (rDate === targetDate) {
      refundsPaisa += Number(r.total_refund_paisa ?? r.amount_paisa ?? 0);
    }
  }

  const netSalesPaisa = Math.max(0, grossSalesPaisa - refundsPaisa);

  // Live DB expenses for targetDate
  const dbExpensesForDate: ClosingExpenseEntry[] = [];
  for (const exp of (rawExpenses ?? []) as Array<Record<string, unknown>>) {
    const expDate = exp.expense_date
      ? String(exp.expense_date).slice(0, 10)
      : exp.incurred_at
      ? formatPkDate(new Date(String(exp.incurred_at)))
      : exp.created_at
      ? formatPkDate(new Date(String(exp.created_at)))
      : "";
    if (expDate === targetDate) {
      dbExpensesForDate.push({
        id: `db-${String(exp.id)}`,
        description: String(exp.description ?? "Shop Expense"),
        category: String(exp.category ?? "General"),
        amountPaisa: Number(exp.amount_paisa ?? 0),
        paidBy: "Shop Ledger",
        method: String(exp.payment_source ?? "CASH_TILL"),
        fromDb: true,
      });
    }
  }
  const liveExpensesPaisa = dbExpensesForDate.reduce(
    (sum, item) => sum + item.amountPaisa,
    0
  );

  // Check if a saved closing exists for this date in saved_reports
  const savedReportMap = new Map<string, Record<string, unknown>>();
  for (const rep of (rawSavedReports ?? []) as Array<Record<string, unknown>>) {
    const payload = (rep.payload ?? {}) as Record<string, unknown>;
    const dateKey = String(payload.closingDate ?? rep.title ?? "").slice(0, 10);
    if (dateKey && !savedReportMap.has(dateKey)) {
      savedReportMap.set(dateKey, {
        ...payload,
        _savedAtIso: String(rep.updated_at ?? rep.created_at ?? ""),
      });
    }
  }

  const savedForDate = savedReportMap.get(targetDate);

  // Build default wages list from live active employees + standard daily wage roster
  const existingNames = new Set<string>();
  const defaultWages: ClosingWageEntry[] = [];

  for (const emp of (rawEmployees ?? []) as Array<Record<string, unknown>>) {
    const name = String(emp.full_name ?? "").trim();
    if (!name || existingNames.has(name.toLowerCase())) continue;
    existingNames.add(name.toLowerCase());
    const dailyRate =
      String(emp.salary_type ?? "").toUpperCase() === "DAILY"
        ? Number(emp.salary_amount_paisa ?? 0)
        : 0;
    defaultWages.push({
      id: `emp-${String(emp.id)}`,
      name,
      role: String(emp.designation ?? "Staff"),
      wagePaisa: dailyRate,
      notes: "Active employee",
    });
  }

  for (const preset of DEFAULT_WAGE_STAFF) {
    if (!existingNames.has(preset.name.toLowerCase())) {
      existingNames.add(preset.name.toLowerCase());
      defaultWages.push({
        id: `preset-${preset.name.toLowerCase()}`,
        name: preset.name,
        role: preset.role,
        wagePaisa: 0,
        notes: "",
      });
    }
  }

  const morningCashPaisa =
    savedForDate !== undefined
      ? Number(savedForDate.morningCashPaisa ?? liveMorningCashPaisa)
      : liveMorningCashPaisa;
  const eveningCashPaisa =
    savedForDate !== undefined
      ? Number(savedForDate.eveningCashPaisa ?? liveEveningCashPaisa)
      : liveEveningCashPaisa;
  const nightCashPaisa =
    savedForDate !== undefined
      ? Number(savedForDate.nightCashPaisa ?? liveNightCashPaisa)
      : liveNightCashPaisa;

  const customExpenses: ClosingExpenseEntry[] = Array.isArray(
    savedForDate?.closingExpenses
  )
    ? (savedForDate.closingExpenses as ClosingExpenseEntry[])
    : [];

  const wages: ClosingWageEntry[] = Array.isArray(savedForDate?.wages)
    ? (savedForDate.wages as ClosingWageEntry[])
    : defaultWages;

  const totalOutflowsPaisa =
    liveExpensesPaisa +
    customExpenses.reduce((s, e) => s + Number(e.amountPaisa || 0), 0) +
    wages.reduce((s, w) => s + Number(w.wagePaisa || 0), 0);

  const expectedClosingPaisa =
    morningCashPaisa + eveningCashPaisa + nightCashPaisa - totalOutflowsPaisa;

  const actualClosingPaisa =
    savedForDate !== undefined
      ? Number(savedForDate.actualClosingPaisa ?? expectedClosingPaisa)
      : Math.max(0, expectedClosingPaisa);

  const cashDifferencePaisa = actualClosingPaisa - expectedClosingPaisa;

  const history: ClosingHistorySummary[] = [];
  for (const [dateKey, payload] of savedReportMap.entries()) {
    const expList = Array.isArray(payload.closingExpenses)
      ? (payload.closingExpenses as ClosingExpenseEntry[])
      : [];
    const wageList = Array.isArray(payload.wages)
      ? (payload.wages as ClosingWageEntry[])
      : [];
    history.push({
      closingDate: dateKey,
      grossSalesPaisa: Number(payload.grossSalesPaisa ?? 0),
      netSalesPaisa: Number(payload.netSalesPaisa ?? 0),
      cashCollectedPaisa: Number(payload.cashCollectedPaisa ?? 0),
      digitalSalesPaisa: Number(payload.digitalSalesPaisa ?? 0),
      totalExpensesPaisa:
        Number(payload.liveExpensesPaisa ?? 0) +
        expList.reduce((s, e) => s + Number(e.amountPaisa || 0), 0),
      totalWagesPaisa: wageList.reduce(
        (s, w) => s + Number(w.wagePaisa || 0),
        0
      ),
      expectedClosingPaisa: Number(payload.expectedClosingPaisa ?? 0),
      actualClosingPaisa: Number(payload.actualClosingPaisa ?? 0),
      cashDifferencePaisa: Number(payload.cashDifferencePaisa ?? 0),
      status: "SAVED",
      updatedAtIso: String(payload._savedAtIso ?? new Date().toISOString()),
    });
  }

  // Include snapshots if any exist outside saved_reports
  for (const snap of (rawSnapshots ?? []) as Array<Record<string, unknown>>) {
    const d = String(snap.snapshot_date ?? "").slice(0, 10);
    if (!d || savedReportMap.has(d)) continue;
    history.push({
      closingDate: d,
      grossSalesPaisa: Number(snap.gross_sales_paisa ?? 0),
      netSalesPaisa: Number(snap.net_sales_paisa ?? 0),
      cashCollectedPaisa: Number(snap.cash_collected_paisa ?? 0),
      digitalSalesPaisa: Number(snap.digital_collected_paisa ?? 0),
      totalExpensesPaisa: Number(snap.expenses_paisa ?? 0),
      totalWagesPaisa: 0,
      expectedClosingPaisa: Number(snap.cash_collected_paisa ?? 0) - Number(snap.expenses_paisa ?? 0),
      actualClosingPaisa: Number(snap.cash_collected_paisa ?? 0) - Number(snap.expenses_paisa ?? 0),
      cashDifferencePaisa: 0,
      status: "SAVED",
      updatedAtIso: String(snap.updated_at ?? snap.created_at ?? ""),
    });
  }

  history.sort((a, b) => b.closingDate.localeCompare(a.closingDate));

  return {
    record: {
      closingDate: targetDate,
      morningCashPaisa,
      eveningCashPaisa,
      nightCashPaisa,
      grossSalesPaisa,
      refundsPaisa,
      netSalesPaisa,
      digitalSalesPaisa,
      cashCollectedPaisa,
      liveExpensesPaisa,
      closingExpenses: [...dbExpensesForDate, ...customExpenses],
      wages,
      expectedClosingPaisa,
      actualClosingPaisa,
      cashDifferencePaisa,
      transactionCount,
      notes: String(savedForDate?.notes ?? ""),
      status: savedForDate ? "SAVED" : "DRAFT",
      savedAtIso: savedForDate ? String(savedForDate._savedAtIso ?? "") : null,
      preparedByName: savedForDate?.preparedByName
        ? String(savedForDate.preparedByName)
        : ctx.fullName,
    },
    history,
  };
}

export async function loadClosingDataForDateAction(closingDate: string) {
  return loadClosingDataForDate(closingDate);
}

export async function saveDailyClosingAction(payload: SaveDailyClosingPayload) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(payload.closingDate)
    ? payload.closingDate
    : formatPkDate();

  // Always recompute live sales totals for authoritative accuracy
  const live = await loadClosingDataForDate(targetDate);
  const customExpenses = payload.closingExpenses.filter((e) => !e.fromDb);
  const totalClosingExpensesPaisa = customExpenses.reduce(
    (s, e) => s + Math.max(0, Math.round(Number(e.amountPaisa || 0))),
    0
  );
  const totalWagesPaisa = payload.wages.reduce(
    (s, w) => s + Math.max(0, Math.round(Number(w.wagePaisa || 0))),
    0
  );
  const totalOutflowsPaisa =
    live.record.liveExpensesPaisa + totalClosingExpensesPaisa + totalWagesPaisa;

  const morningCashPaisa = Math.max(0, Math.round(payload.morningCashPaisa || 0));
  const eveningCashPaisa = Math.max(0, Math.round(payload.eveningCashPaisa || 0));
  const nightCashPaisa = Math.max(0, Math.round(payload.nightCashPaisa || 0));
  const actualClosingPaisa = Math.max(0, Math.round(payload.actualClosingPaisa || 0));
  const expectedClosingPaisa =
    morningCashPaisa + eveningCashPaisa + nightCashPaisa - totalOutflowsPaisa;
  const cashDifferencePaisa = actualClosingPaisa - expectedClosingPaisa;

  const admin = createSupabaseAdminClient();
  const totalExpensesAllPaisa = live.record.liveExpensesPaisa + totalClosingExpensesPaisa;

  // 1. Upsert daily_report_snapshots (live table)
  await admin.from("daily_report_snapshots").upsert(
    {
      business_id: ctx.businessId,
      snapshot_date: targetDate,
      gross_sales_paisa: live.record.grossSalesPaisa,
      refunds_paisa: live.record.refundsPaisa,
      net_sales_paisa: live.record.netSalesPaisa,
      expenses_paisa: totalExpensesAllPaisa + totalWagesPaisa,
      cash_collected_paisa: morningCashPaisa + eveningCashPaisa + nightCashPaisa,
      digital_collected_paisa: live.record.digitalSalesPaisa,
      currency: "PKR",
      generated_by: ctx.userId,
    },
    { onConflict: "business_id,snapshot_date" }
  );

  // 2. Save detailed closing breakdown in saved_reports (update existing for date or insert)
  const fullPayload = {
    closingDate: targetDate,
    morningCashPaisa,
    eveningCashPaisa,
    nightCashPaisa,
    grossSalesPaisa: live.record.grossSalesPaisa,
    refundsPaisa: live.record.refundsPaisa,
    netSalesPaisa: live.record.netSalesPaisa,
    cashCollectedPaisa: live.record.cashCollectedPaisa,
    digitalSalesPaisa: live.record.digitalSalesPaisa,
    liveExpensesPaisa: live.record.liveExpensesPaisa,
    closingExpenses: customExpenses,
    wages: payload.wages,
    expectedClosingPaisa,
    actualClosingPaisa,
    cashDifferencePaisa,
    notes: payload.notes.trim(),
    preparedByName: ctx.fullName,
  };

  const reportTitle = `DAILY_CLOSING_${targetDate}`;
  const { data: existingReport } = await admin
    .from("saved_reports")
    .select("id")
    .eq("business_id", ctx.businessId)
    .eq("report_type", "DAILY_CLOSING")
    .eq("title", reportTitle)
    .maybeSingle();

  if (existingReport?.id) {
    const { error: updErr } = await admin
      .from("saved_reports")
      .update({
        payload: fullPayload,
        generated_by: ctx.userId,
      })
      .eq("id", existingReport.id);
    if (updErr) {
      throw new Error(`Failed to update daily closing: ${updErr.message}`);
    }
  } else {
    const { error: insErr } = await admin.from("saved_reports").insert({
      business_id: ctx.businessId,
      report_type: "DAILY_CLOSING",
      title: reportTitle,
      payload: fullPayload,
      generated_by: ctx.userId,
    });
    if (insErr) {
      throw new Error(`Failed to save daily closing: ${insErr.message}`);
    }
  }

  // 3. Best-effort sync to daily_closings table if SQL migration 0007 has been applied
  try {
    await admin.from("daily_closings").upsert(
      {
        business_id: ctx.businessId,
        closing_date: targetDate,
        morning_cash_paisa: morningCashPaisa,
        evening_cash_paisa: eveningCashPaisa,
        night_cash_paisa: nightCashPaisa,
        gross_sales_paisa: live.record.grossSalesPaisa,
        refunds_paisa: live.record.refundsPaisa,
        net_sales_paisa: live.record.netSalesPaisa,
        digital_sales_paisa: live.record.digitalSalesPaisa,
        total_expenses_paisa: totalExpensesAllPaisa,
        total_wages_paisa: totalWagesPaisa,
        expected_closing_paisa: expectedClosingPaisa,
        actual_closing_paisa: actualClosingPaisa,
        cash_variance_paisa: cashDifferencePaisa,
        expenses_json: customExpenses,
        wages_json: payload.wages,
        notes: payload.notes.trim(),
        status: "SUBMITTED",
        prepared_by: ctx.userId,
      },
      { onConflict: "business_id,closing_date" }
    );
  } catch {
    // Table may not exist yet before migration push; saved_reports & daily_report_snapshots succeeded
  }

  await writeAuditLog({
    businessId: ctx.businessId,
    actorName: ctx.fullName,
    actionType: "DAILY_CLOSING_SAVED",
    description: `Saved Daily Closing for ${targetDate}: Expected Rs. ${Math.round(
      expectedClosingPaisa / 100
    )}, Counted Rs. ${Math.round(actualClosingPaisa / 100)}`,
    metadata: {
      closing_date: targetDate,
      expected_closing_paisa: expectedClosingPaisa,
      actual_closing_paisa: actualClosingPaisa,
      cash_difference_paisa: cashDifferencePaisa,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/closing");
  revalidatePath("/reports");

  return loadClosingDataForDate(targetDate);
}
