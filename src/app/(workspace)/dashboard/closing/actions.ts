"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { dbQuery, withTransaction } from "@/lib/db/pool";
import { hasRequiredRole } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import {
  normalizeClosingShiftLabel,
  type ClosingShiftLabel,
} from "@/lib/closing/shift";

export type { ClosingShiftLabel };

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

export interface VoidedClosingContext {
  id: string;
  voidReason: string | null;
  voidedAtIso: string | null;
  voidedByName: string | null;
}

export interface DailyClosingRecord {
  id: string | null;
  closingDate: string;
  shiftLabel: ClosingShiftLabel;
  replacesClosingId?: string | null;
  replacedVoided?: VoidedClosingContext | null;
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
  status: "DRAFT" | "SAVED" | "VOIDED";
  savedAtIso: string | null;
  preparedByName: string | null;
  voidReason?: string | null;
  voidedAtIso?: string | null;
  voidedByName?: string | null;
}

export interface ClosingHistorySummary {
  id: string;
  closingDate: string;
  shiftLabel: ClosingShiftLabel;
  replacesClosingId?: string | null;
  grossSalesPaisa: number;
  netSalesPaisa: number;
  cashCollectedPaisa: number;
  digitalSalesPaisa: number;
  totalExpensesPaisa: number;
  totalWagesPaisa: number;
  expectedClosingPaisa: number;
  actualClosingPaisa: number;
  cashDifferencePaisa: number;
  status: "DRAFT" | "SAVED" | "VOIDED";
  preparedByName?: string | null;
  voidReason?: string | null;
  voidedAtIso?: string | null;
  voidedByName?: string | null;
  updatedAtIso: string;
}

export interface SaveDailyClosingPayload {
  closingDate: string;
  shiftLabel?: ClosingShiftLabel;
  replacesClosingId?: string | null;
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
  closingDate: string,
  rawShiftLabel?: string
): Promise<{
  record: DailyClosingRecord;
  history: ClosingHistorySummary[];
}> {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(closingDate)
    ? closingDate
    : formatPkDate();
  const targetShift = normalizeClosingShiftLabel(rawShiftLabel);

  const [
    salesRes,
    paymentsRes,
    refundsRes,
    expensesRes,
    employeesRes,
    snapshotsRes,
    closingsRes,
  ] = await Promise.all([
    dbQuery(
      `SELECT id, total_paisa, discount_paisa, status, created_at, posted_at
       FROM sales WHERE business_id = $1 ORDER BY created_at DESC LIMIT 5000`,
      [ctx.businessId]
    ),
    dbQuery(
      `SELECT sale_id, method, amount_paisa, status, received_at
       FROM payments WHERE business_id = $1 LIMIT 5000`,
      [ctx.businessId]
    ),
    dbQuery(
      `SELECT sale_id, total_refund_paisa, posted_at, created_at, status
       FROM refunds WHERE business_id = $1 LIMIT 5000`,
      [ctx.businessId]
    ),
    dbQuery(
      `SELECT id, description, category, amount_paisa, payment_source, expense_date, incurred_at, created_at
       FROM expenses WHERE business_id = $1 LIMIT 5000`,
      [ctx.businessId]
    ),
    dbQuery(
      `SELECT id, full_name, designation, salary_amount_paisa, salary_type, employment_status
       FROM employees WHERE business_id = $1 AND employment_status = 'ACTIVE'`,
      [ctx.businessId]
    ),
    dbQuery(
      `SELECT * FROM daily_report_snapshots
       WHERE business_id = $1 ORDER BY snapshot_date DESC LIMIT 90`,
      [ctx.businessId]
    ),
    dbQuery(
      `SELECT dc.*, COALESCE(NULLIF(dc.prepared_by_name, ''), u.full_name, p.full_name) AS prepared_by_resolved
       FROM daily_closings dc
       LEFT JOIN auth_users u ON u.id = dc.prepared_by
       LEFT JOIN profiles p ON p.id = dc.prepared_by
       WHERE dc.business_id = $1
       ORDER BY dc.closing_date DESC, dc.created_at DESC
       LIMIT 150`,
      [ctx.businessId]
    ),
  ]);

  const rawSales = salesRes.rows;
  const rawPayments = paymentsRes.rows;
  const rawRefunds = refundsRes.rows;
  const rawExpenses = expensesRes.rows;
  const rawEmployees = employeesRes.rows;
  const rawSnapshots = snapshotsRes.rows;
  const rawSavedReports = closingsRes.rows.map((dc) => {
    const dKey =
      dc.closing_date instanceof Date
        ? formatPkDate(dc.closing_date)
        : String(dc.closing_date).slice(0, 10);
    const dcShift = normalizeClosingShiftLabel(dc.shift_label);
    const dcStatus = String(dc.status ?? "SUBMITTED").toUpperCase();
    return {
      id: String(dc.id),
      title: `DAILY_CLOSING_${dKey}_${dcShift}`,
      updated_at: dc.updated_at,
      created_at: dc.created_at,
      payload: {
        id: String(dc.id),
        closingDate: dKey,
        shiftLabel: dcShift,
        replacesClosingId: dc.replaces_closing_id ? String(dc.replaces_closing_id) : null,
        status: dcStatus === "VOIDED" ? ("VOIDED" as const) : ("SAVED" as const),
        voidReason: dc.void_reason ? String(dc.void_reason) : null,
        voidedAtIso: dc.voided_at ? new Date(String(dc.voided_at)).toISOString() : null,
        voidedByName: dc.voided_by_name ? String(dc.voided_by_name) : null,
        morningCashPaisa: Number(dc.morning_cash_paisa ?? 0),
        eveningCashPaisa: Number(dc.evening_cash_paisa ?? 0),
        nightCashPaisa: Number(dc.night_cash_paisa ?? 0),
        grossSalesPaisa: Number(dc.gross_sales_paisa ?? 0),
        refundsPaisa: Number(dc.refunds_paisa ?? 0),
        netSalesPaisa: Number(dc.net_sales_paisa ?? 0),
        cashCollectedPaisa:
          Number(dc.morning_cash_paisa ?? 0) +
          Number(dc.evening_cash_paisa ?? 0) +
          Number(dc.night_cash_paisa ?? 0),
        digitalSalesPaisa: Number(dc.digital_sales_paisa ?? 0),
        liveExpensesPaisa: Number(dc.total_expenses_paisa ?? 0),
        closingExpenses: Array.isArray(dc.expenses_json) ? dc.expenses_json : [],
        wages: Array.isArray(dc.wages_json) ? dc.wages_json : [],
        expectedClosingPaisa: Number(dc.expected_closing_paisa ?? 0),
        actualClosingPaisa: Number(dc.actual_closing_paisa ?? 0),
        cashDifferencePaisa: Number(dc.cash_variance_paisa ?? 0),
        notes: dc.notes ? String(dc.notes) : "",
        preparedByName: dc.prepared_by_resolved
          ? String(dc.prepared_by_resolved)
          : ctx.fullName,
      },
    };
  });

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
    const iso = String(sale.posted_at ?? sale.created_at ?? "");
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

  // Separate active closings by (closingDate:shiftLabel) from preserved VOIDED closings
  const activeClosingBySlot = new Map<string, Record<string, unknown>>();
  const latestVoidedBySlot = new Map<string, VoidedClosingContext>();
  const seenClosingDates = new Set<string>();

  for (const rep of rawSavedReports) {
    const payload = rep.payload;
    const dateKey = String(payload.closingDate ?? "").slice(0, 10);
    if (!dateKey) continue;
    seenClosingDates.add(dateKey);
    const slotKey = `${dateKey}:${payload.shiftLabel}`;
    const savedIso = String(rep.updated_at ?? rep.created_at ?? "");
    if (payload.status === "VOIDED") {
      if (!latestVoidedBySlot.has(slotKey)) {
        latestVoidedBySlot.set(slotKey, {
          id: payload.id,
          voidReason: payload.voidReason ?? null,
          voidedAtIso: payload.voidedAtIso ?? null,
          voidedByName: payload.voidedByName ?? null,
        });
      }
    } else if (!activeClosingBySlot.has(slotKey)) {
      activeClosingBySlot.set(slotKey, {
        ...payload,
        _savedAtIso: savedIso,
      });
    }
  }

  const targetSlotKey = `${targetDate}:${targetShift}`;
  const savedForDate = activeClosingBySlot.get(targetSlotKey);
  const replacedVoided = !savedForDate ? (latestVoidedBySlot.get(targetSlotKey) ?? null) : null;

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

  const defaultMorning =
    targetShift === "FULL_DAY" || targetShift === "MORNING" ? liveMorningCashPaisa : 0;
  const defaultEvening =
    targetShift === "FULL_DAY" || targetShift === "EVENING" ? liveEveningCashPaisa : 0;
  const defaultNight =
    targetShift === "FULL_DAY" || targetShift === "NIGHT" ? liveNightCashPaisa : 0;

  const morningCashPaisa =
    savedForDate !== undefined
      ? Number(savedForDate.morningCashPaisa ?? defaultMorning)
      : defaultMorning;
  const eveningCashPaisa =
    savedForDate !== undefined
      ? Number(savedForDate.eveningCashPaisa ?? defaultEvening)
      : defaultEvening;
  const nightCashPaisa =
    savedForDate !== undefined
      ? Number(savedForDate.nightCashPaisa ?? defaultNight)
      : defaultNight;

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

  const history: ClosingHistorySummary[] = rawSavedReports.map((rep) => {
    const payload = rep.payload;
    const expList = Array.isArray(payload.closingExpenses)
      ? (payload.closingExpenses as ClosingExpenseEntry[])
      : [];
    const wageList = Array.isArray(payload.wages)
      ? (payload.wages as ClosingWageEntry[])
      : [];
    return {
      id: payload.id,
      closingDate: payload.closingDate,
      shiftLabel: payload.shiftLabel,
      replacesClosingId: payload.replacesClosingId,
      grossSalesPaisa: payload.grossSalesPaisa,
      netSalesPaisa: payload.netSalesPaisa,
      cashCollectedPaisa: payload.cashCollectedPaisa,
      digitalSalesPaisa: payload.digitalSalesPaisa,
      totalExpensesPaisa:
        payload.liveExpensesPaisa +
        expList.reduce((s, e) => s + Number(e.amountPaisa || 0), 0),
      totalWagesPaisa: wageList.reduce(
        (s, w) => s + Number(w.wagePaisa || 0),
        0
      ),
      expectedClosingPaisa: payload.expectedClosingPaisa,
      actualClosingPaisa: payload.actualClosingPaisa,
      cashDifferencePaisa: payload.cashDifferencePaisa,
      status: payload.status,
      preparedByName: payload.preparedByName ?? ctx.fullName,
      voidReason: payload.voidReason ?? null,
      voidedAtIso: payload.voidedAtIso ?? null,
      voidedByName: payload.voidedByName ?? null,
      updatedAtIso: String(rep.updated_at ?? rep.created_at ?? new Date().toISOString()),
    };
  });

  // Include standalone legacy snapshots only if no daily_closings row exists for that date
  for (const snap of (rawSnapshots ?? []) as Array<Record<string, unknown>>) {
    const d = String(snap.snapshot_date ?? "").slice(0, 10);
    if (!d || seenClosingDates.has(d)) continue;
    history.push({
      id: String(snap.id ?? `snap-${d}`),
      closingDate: d,
      shiftLabel: "FULL_DAY",
      replacesClosingId: null,
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
      preparedByName: null,
      updatedAtIso: String(snap.updated_at ?? snap.created_at ?? ""),
    });
  }

  history.sort((a, b) => {
    const dateCmp = b.closingDate.localeCompare(a.closingDate);
    if (dateCmp !== 0) return dateCmp;
    return String(b.updatedAtIso).localeCompare(String(a.updatedAtIso));
  });

  const recordStatus: "DRAFT" | "SAVED" | "VOIDED" = savedForDate ? "SAVED" : "DRAFT";

  return {
    record: {
      id: savedForDate ? String(savedForDate.id) : null,
      closingDate: targetDate,
      shiftLabel: targetShift,
      replacesClosingId: savedForDate?.replacesClosingId
        ? String(savedForDate.replacesClosingId)
        : replacedVoided?.id ?? null,
      replacedVoided,
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
      status: recordStatus,
      savedAtIso: savedForDate ? String(savedForDate._savedAtIso ?? "") : null,
      preparedByName: savedForDate?.preparedByName
        ? String(savedForDate.preparedByName)
        : ctx.fullName,
      voidReason: null,
      voidedAtIso: null,
      voidedByName: null,
    },
    history,
  };
}

export async function loadClosingDataForDateAction(
  closingDate: string,
  shiftLabel?: ClosingShiftLabel
) {
  return loadClosingDataForDate(closingDate, shiftLabel);
}

export async function saveDailyClosingAction(payload: SaveDailyClosingPayload) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(payload.closingDate)
    ? payload.closingDate
    : formatPkDate();
  const targetShift = normalizeClosingShiftLabel(payload.shiftLabel);

  // Always recompute live sales totals for authoritative accuracy
  const live = await loadClosingDataForDate(targetDate, targetShift);
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

  const totalExpensesAllPaisa = live.record.liveExpensesPaisa + totalClosingExpensesPaisa;

  const saveMeta = await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO daily_report_snapshots (
         business_id, snapshot_date, gross_sales_paisa, refunds_paisa,
         net_sales_paisa, expenses_paisa, cash_collected_paisa,
         digital_collected_paisa, currency, generated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PKR', $9)
       ON CONFLICT (business_id, snapshot_date) DO UPDATE SET
         gross_sales_paisa = EXCLUDED.gross_sales_paisa,
         refunds_paisa = EXCLUDED.refunds_paisa,
         net_sales_paisa = EXCLUDED.net_sales_paisa,
         expenses_paisa = EXCLUDED.expenses_paisa,
         cash_collected_paisa = EXCLUDED.cash_collected_paisa,
         digital_collected_paisa = EXCLUDED.digital_collected_paisa,
         generated_by = EXCLUDED.generated_by`,
      [
        ctx.businessId,
        targetDate,
        live.record.grossSalesPaisa,
        live.record.refundsPaisa,
        live.record.netSalesPaisa,
        totalExpensesAllPaisa + totalWagesPaisa,
        morningCashPaisa + eveningCashPaisa + nightCashPaisa,
        live.record.digitalSalesPaisa,
        ctx.userId,
      ]
    );

    // Check if an active (non-VOIDED) closing already exists for this (date, shift).
    // VOIDED closings are ALWAYS preserved untouched in DB for audit history.
    const activeRes = await client.query<{ id: string }>(
      `SELECT id
       FROM daily_closings
       WHERE business_id = $1
         AND closing_date = $2
         AND COALESCE(shift_label, 'FULL_DAY') = $3
         AND UPPER(COALESCE(status, 'SUBMITTED')) <> 'VOIDED'
       LIMIT 1
       FOR UPDATE`,
      [ctx.businessId, targetDate, targetShift]
    );

    let savedId: string;
    let replacesId: string | null = null;

    if (activeRes.rows[0]?.id) {
      savedId = String(activeRes.rows[0].id);
      await client.query(
        `UPDATE daily_closings
         SET morning_cash_paisa = $1,
             evening_cash_paisa = $2,
             night_cash_paisa = $3,
             gross_sales_paisa = $4,
             refunds_paisa = $5,
             net_sales_paisa = $6,
             digital_sales_paisa = $7,
             total_expenses_paisa = $8,
             total_wages_paisa = $9,
             expected_closing_paisa = $10,
             actual_closing_paisa = $11,
             cash_variance_paisa = $12,
             expenses_json = $13::jsonb,
             wages_json = $14::jsonb,
             notes = $15,
             prepared_by = $16,
             prepared_by_name = $17,
             updated_at = NOW()
         WHERE id = $18`,
        [
          morningCashPaisa,
          eveningCashPaisa,
          nightCashPaisa,
          live.record.grossSalesPaisa,
          live.record.refundsPaisa,
          live.record.netSalesPaisa,
          live.record.digitalSalesPaisa,
          totalExpensesAllPaisa,
          totalWagesPaisa,
          expectedClosingPaisa,
          actualClosingPaisa,
          cashDifferencePaisa,
          JSON.stringify(customExpenses),
          JSON.stringify(payload.wages),
          payload.notes.trim(),
          ctx.userId,
          ctx.fullName,
          savedId,
        ]
      );
    } else {
      // If replacing a previously voided closing for this date & shift, link its ID cleanly
      if (payload.replacesClosingId) {
        replacesId = payload.replacesClosingId;
      } else {
        const voidRes = await client.query<{ id: string }>(
          `SELECT id
           FROM daily_closings
           WHERE business_id = $1
             AND closing_date = $2
             AND COALESCE(shift_label, 'FULL_DAY') = $3
             AND UPPER(COALESCE(status, 'SUBMITTED')) = 'VOIDED'
           ORDER BY voided_at DESC NULLS LAST, created_at DESC
           LIMIT 1`,
          [ctx.businessId, targetDate, targetShift]
        );
        replacesId = voidRes.rows[0]?.id ? String(voidRes.rows[0].id) : null;
      }

      const insRes = await client.query<{ id: string }>(
        `INSERT INTO daily_closings (
           business_id, closing_date, shift_label, replaces_closing_id,
           morning_cash_paisa, evening_cash_paisa, night_cash_paisa,
           gross_sales_paisa, refunds_paisa, net_sales_paisa,
           digital_sales_paisa, total_expenses_paisa, total_wages_paisa,
           expected_closing_paisa, actual_closing_paisa, cash_variance_paisa,
           expenses_json, wages_json, notes, status, prepared_by, prepared_by_name
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18::jsonb, $19, 'SUBMITTED', $20, $21)
         RETURNING id`,
        [
          ctx.businessId,
          targetDate,
          targetShift,
          replacesId,
          morningCashPaisa,
          eveningCashPaisa,
          nightCashPaisa,
          live.record.grossSalesPaisa,
          live.record.refundsPaisa,
          live.record.netSalesPaisa,
          live.record.digitalSalesPaisa,
          totalExpensesAllPaisa,
          totalWagesPaisa,
          expectedClosingPaisa,
          actualClosingPaisa,
          cashDifferencePaisa,
          JSON.stringify(customExpenses),
          JSON.stringify(payload.wages),
          payload.notes.trim(),
          ctx.userId,
          ctx.fullName,
        ]
      );
      savedId = String(insRes.rows[0].id);
    }

    return { savedId, replacesId };
  });

  await writeAuditLog({
    businessId: ctx.businessId,
    actorName: ctx.fullName,
    actionType: saveMeta.replacesId ? "DAILY_CLOSING_REPLACED" : "DAILY_CLOSING_SAVED",
    description: `${
      saveMeta.replacesId ? "Saved replacement" : "Saved"
    } Daily Closing for ${targetDate} (${targetShift}): Expected Rs. ${Math.round(
      expectedClosingPaisa / 100
    )}, Counted Rs. ${Math.round(actualClosingPaisa / 100)}`,
    metadata: {
      entity_type: "daily_closings",
      entity_id: saveMeta.savedId,
      closing_date: targetDate,
      shift_label: targetShift,
      replaces_closing_id: saveMeta.replacesId,
      expected_closing_paisa: expectedClosingPaisa,
      actual_closing_paisa: actualClosingPaisa,
      cash_difference_paisa: cashDifferencePaisa,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/closing");
  revalidatePath("/sales");
  revalidatePath("/reports");
  revalidatePath("/audit");

  return loadClosingDataForDate(targetDate, targetShift);
}

export async function voidDailyClosingAction(payload: {
  closingId?: string;
  closingDate?: string;
  shiftLabel?: ClosingShiftLabel;
  reason?: string;
}) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  const businessId = ctx.businessId;

  if (!hasRequiredRole(ctx.role, ["OWNER", "MANAGER"])) {
    throw new Error("Only authorized Owners or Managers can void a Daily Closing entry.");
  }

  const cleanReason = String(payload.reason ?? "").trim();
  if (!cleanReason) {
    throw new Error("A reason for voiding the Daily Closing is required.");
  }

  const targetDateRaw = payload.closingDate && /^\d{4}-\d{2}-\d{2}$/.test(payload.closingDate)
    ? payload.closingDate
    : "";
  const targetShift = normalizeClosingShiftLabel(payload.shiftLabel);

  if (!payload.closingId && !targetDateRaw) {
    throw new Error("Valid closing ID or closing date is required.");
  }

  const voidResult = await withTransaction(async (client) => {
    const existingRes = payload.closingId
      ? await client.query<{
          id: string;
          closing_date: string | Date;
          shift_label: string | null;
          status: string;
          net_sales_paisa: string | number;
          actual_closing_paisa: string | number;
        }>(
          `SELECT id, closing_date, COALESCE(shift_label, 'FULL_DAY') AS shift_label,
                  status, net_sales_paisa, actual_closing_paisa
           FROM daily_closings
           WHERE business_id = $1 AND id = $2
           FOR UPDATE`,
          [ctx.businessId, payload.closingId]
        )
      : await client.query<{
          id: string;
          closing_date: string | Date;
          shift_label: string | null;
          status: string;
          net_sales_paisa: string | number;
          actual_closing_paisa: string | number;
        }>(
          `SELECT id, closing_date, COALESCE(shift_label, 'FULL_DAY') AS shift_label,
                  status, net_sales_paisa, actual_closing_paisa
           FROM daily_closings
           WHERE business_id = $1
             AND closing_date = $2
             AND COALESCE(shift_label, 'FULL_DAY') = $3
             AND UPPER(COALESCE(status, 'SUBMITTED')) <> 'VOIDED'
           FOR UPDATE`,
          [ctx.businessId, targetDateRaw, targetShift]
        );

    const existing = existingRes.rows[0];
    if (!existing) {
      throw new Error("No active saved Daily Closing found to void.");
    }
    if (String(existing.status).toUpperCase() === "VOIDED") {
      throw new Error("This Daily Closing entry is already voided.");
    }

    const resolvedDate =
      existing.closing_date instanceof Date
        ? formatPkDate(existing.closing_date)
        : String(existing.closing_date).slice(0, 10);
    const resolvedShift = normalizeClosingShiftLabel(existing.shift_label);

    // ONLY invalidate the closing record itself. Never touch sales, payments, inventory, or cash_sessions.
    await client.query(
      `UPDATE daily_closings
       SET status = 'VOIDED',
           voided_at = NOW(),
           voided_by = $1,
           voided_by_name = $2,
           void_reason = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [ctx.userId, ctx.fullName, cleanReason, existing.id]
    );

    // Clear daily_report_snapshots for that date only if no remaining active closing exists
    const remainingActive = await client.query<{ cnt: string | number }>(
      `SELECT COUNT(*) AS cnt
       FROM daily_closings
       WHERE business_id = $1
         AND closing_date = $2
         AND UPPER(COALESCE(status, 'SUBMITTED')) <> 'VOIDED'`,
      [ctx.businessId, resolvedDate]
    );
    if (Number(remainingActive.rows[0]?.cnt ?? 0) === 0) {
      await client.query(
        `DELETE FROM daily_report_snapshots
         WHERE business_id = $1 AND snapshot_date = $2`,
        [ctx.businessId, resolvedDate]
      );
    }

    await writeAuditLog({
      businessId,
      actorName: ctx.fullName ?? "Authorized User",
      actionType: "DAILY_CLOSING_VOIDED",
      description: `Voided Daily Closing for ${resolvedDate} (${resolvedShift}): ${cleanReason}`,
      metadata: {
        entity_type: "daily_closings",
        entity_id: existing.id,
        closing_date: resolvedDate,
        shift_label: resolvedShift,
        reason: cleanReason,
        before_state: {
          status: existing.status,
          net_sales_paisa: existing.net_sales_paisa,
          actual_closing_paisa: existing.actual_closing_paisa,
        },
        after_state: {
          status: "VOIDED",
          void_reason: cleanReason,
        },
      },
    });

    return { resolvedDate, resolvedShift };
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/closing");
  revalidatePath("/sales");
  revalidatePath("/reports");
  revalidatePath("/audit");

  return loadClosingDataForDate(voidResult.resolvedDate, voidResult.resolvedShift);
}
