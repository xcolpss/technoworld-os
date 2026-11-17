import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type BiPeriodKey =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "last_month"
  | "this_year"
  | "lifetime"
  | "custom";

export interface BiDateRange {
  period: BiPeriodKey;
  label: string;
  startDate: string; // YYYY-MM-DD (Asia/Karachi)
  endDate: string; // YYYY-MM-DD (Asia/Karachi)
  prevStartDate: string;
  prevEndDate: string;
  dayCount: number;
}

export interface TxInspectItem {
  id: string;
  receiptNumber: string;
  customerName: string;
  createdAtIso: string;
  datePk: string;
  timePk: string;
  hourPk: number;
  shiftLabel: "MORNING" | "EVENING" | "NIGHT";
  soldByKey: string;
  soldByName: string;
  paymentMethod: string;
  subtotalPaisa: number;
  discountPaisa: number;
  totalPaisa: number;
  cogsPaisa: number;
  profitPaisa: number;
  units: number;
  status: string;
  items: Array<{
    name: string;
    category: string;
    quantity: number;
    revenuePaisa: number;
    cogsPaisa: number;
  }>;
}

export interface BiOverviewMetrics {
  grossBilledPaisa: number;
  discountsPaisa: number;
  grossSalesPaisa: number;
  refundsPaisa: number;
  refundCount: number;
  netRevenuePaisa: number;
  cogsPaisa: number;
  grossProfitPaisa: number;
  grossMarginPct: number;
  operatingExpensesPaisa: number;
  dailyWagesPaisa: number;
  totalExpensesAndWagesPaisa: number;
  netOperatingProfitPaisa: number;
  netMarginPct: number;
  transactionCount: number;
  aovPaisa: number;
  totalUnitsSold: number;
  cashPaymentsPaisa: number;
  digitalPaymentsPaisa: number;
  paymentBreakdown: Array<{ method: string; amountPaisa: number; count: number }>;
  expectedCashDrawerPaisa: number;
  openCashSessionCount: number;
  inventoryCostValuationPaisa: number;
  inventoryRetailValuationPaisa: number;
  outstandingReceivablesPaisa: number;
  outstandingLiabilitiesPaisa: number;
  prevNetRevenuePaisa: number;
  prevGrossProfitPaisa: number;
  prevTransactionCount: number;
  prevExpensesPaisa: number;
  revenueChangePct: number | null;
  profitChangePct: number | null;
  txChangePct: number | null;
  expenseChangePct: number | null;
}

export interface BiProductStat {
  key: string;
  productId: string | null;
  name: string;
  category: string;
  kind: "PRODUCT" | "SERVICE";
  unitsSold: number;
  revenuePaisa: number;
  revenueContributionPct: number;
  cogsPaisa: number;
  grossProfitPaisa: number;
  marginPct: number;
  currentStock: number | null;
  minStockAlert: number | null;
  costPricePaisa: number;
  retailPricePaisa: number;
  prevUnitsSold: number;
  prevRevenuePaisa: number;
  unitsDelta: number;
  growthPct: number | null;
  trend: "INCREASING" | "DECLINING" | "STABLE" | "NEW" | "ZERO";
}

export interface BiCategoryStat {
  category: string;
  revenuePaisa: number;
  unitsSold: number;
  transactionCount: number;
  cogsPaisa: number;
  grossProfitPaisa: number;
  marginPct: number;
  revenueSharePct: number;
  productCount: number;
  bestProduct: string | null;
  worstProduct: string | null;
}

export interface BiCategoryTrendPoint {
  dateKey: string;
  label: string;
  totalRevenuePaisa: number;
  byCategory: Record<string, number>;
}

export interface BiTimePoint {
  key: string;
  label: string;
  revenuePaisa: number;
  cogsPaisa: number;
  grossProfitPaisa: number;
  expensesPaisa: number;
  netProfitPaisa: number;
  cashPaisa: number;
  digitalPaisa: number;
  transactionCount: number;
  unitsSold: number;
  txIds: string[];
}

export interface BiShiftStat {
  shift: "MORNING" | "EVENING" | "NIGHT";
  label: string;
  windowLabel: string;
  revenuePaisa: number;
  expensesPaisa: number;
  cashPaisa: number;
  digitalPaisa: number;
  transactionCount: number;
  unitsSold: number;
  cashVariancePaisa: number;
  employees: string[];
  txIds: string[];
}

export interface BiEmployeeStat {
  employeeKey: string;
  name: string;
  roleLabel: string;
  revenuePaisa: number;
  transactionCount: number;
  aovPaisa: number;
  unitsSold: number;
  refundVoidCount: number;
  refundVoidAmountPaisa: number;
  morningRevenuePaisa: number;
  eveningRevenuePaisa: number;
  topCategory: string;
  categoryRevenue: Array<{ category: string; revenuePaisa: number }>;
  txIds: string[];
}

export interface BiInventoryIntelligence {
  totalSkus: number;
  totalUnitsInStock: number;
  totalCostValuationPaisa: number;
  totalRetailValuationPaisa: number;
  potentialProfitPaisa: number;
  lowStockItems: Array<{
    id: string;
    name: string;
    category: string;
    stock: number;
    minAlert: number;
    suggestedReorder: number;
    reorderCostPaisa: number;
  }>;
  outOfStockItems: Array<{
    id: string;
    name: string;
    category: string;
    minAlert: number;
    suggestedReorder: number;
    reorderCostPaisa: number;
  }>;
  fastMovingItems: BiProductStat[];
  slowMovingItems: BiProductStat[];
  deadStockItems: Array<{
    id: string;
    name: string;
    category: string;
    stock: number;
    valuationPaisa: number;
  }>;
}

export interface BiAlertItem {
  id: string;
  severity: "critical" | "warning" | "info" | "positive";
  category:
    | "INVENTORY"
    | "SALES"
    | "MARGIN"
    | "EXPENSE"
    | "CASH"
    | "EMPLOYEE"
    | "CATEGORY";
  title: string;
  message: string;
  metricValue?: string;
}

export interface BiClosingMiniSummary {
  closingDate: string;
  netSalesPaisa: number;
  totalExpensesPaisa: number;
  totalWagesPaisa: number;
  expectedClosingPaisa: number;
  actualClosingPaisa: number;
  cashDifferencePaisa: number;
}

export interface OwnerBiPayload {
  dateRange: BiDateRange;
  overview: BiOverviewMetrics;
  products: BiProductStat[];
  categories: BiCategoryStat[];
  categoryTrends: BiCategoryTrendPoint[];
  highestRevenueCategory: string | null;
  highestProfitCategory: string | null;
  lowestPerformingCategory: string | null;
  dailySeries: BiTimePoint[];
  weeklySeries: BiTimePoint[];
  monthlySeries: BiTimePoint[];
  yearlySeries: BiTimePoint[];
  hourlySeries: BiTimePoint[];
  shiftStats: BiShiftStat[];
  employees: BiEmployeeStat[];
  inventory: BiInventoryIntelligence;
  alerts: BiAlertItem[];
  closingHistory: BiClosingMiniSummary[];
  transactions: TxInspectItem[];
}

export function formatPkDateStr(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatPkTimeStr(date: Date): string {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function getPkHour(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "12";
  const hr = Number(hourStr);
  return hr === 24 ? 0 : hr;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function diffDaysInclusive(startStr: string, endStr: string): number {
  const s = Date.parse(`${startStr}T00:00:00Z`);
  const e = Date.parse(`${endStr}T00:00:00Z`);
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

function getWeekStartMonday(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + offset);
  return dt.toISOString().slice(0, 10);
}

export function resolveBiDateRange(
  rawPeriod?: string,
  rawStart?: string,
  rawEnd?: string
): BiDateRange {
  const todayPk = formatPkDateStr(new Date());
  const validPeriodSet = new Set<BiPeriodKey>([
    "today",
    "yesterday",
    "last_7_days",
    "last_30_days",
    "this_month",
    "last_month",
    "this_year",
    "lifetime",
    "custom",
  ]);
  const period: BiPeriodKey = validPeriodSet.has(rawPeriod as BiPeriodKey)
    ? (rawPeriod as BiPeriodKey)
    : "today";

  let startDate = todayPk;
  let endDate = todayPk;
  let label = "Today";

  if (period === "yesterday") {
    startDate = addDays(todayPk, -1);
    endDate = startDate;
    label = "Yesterday";
  } else if (period === "last_7_days") {
    startDate = addDays(todayPk, -6);
    endDate = todayPk;
    label = "Last 7 Days";
  } else if (period === "last_30_days") {
    startDate = addDays(todayPk, -29);
    endDate = todayPk;
    label = "Last 30 Days";
  } else if (period === "this_month") {
    startDate = `${todayPk.slice(0, 7)}-01`;
    endDate = todayPk;
    label = "This Month";
  } else if (period === "last_month") {
    const [y, m] = todayPk.split("-").map(Number);
    const firstLastMonth = new Date(Date.UTC(y, m - 2, 1));
    const lastDayLastMonth = new Date(Date.UTC(y, m - 1, 0));
    startDate = firstLastMonth.toISOString().slice(0, 10);
    endDate = lastDayLastMonth.toISOString().slice(0, 10);
    label = "Previous Month";
  } else if (period === "this_year") {
    startDate = `${todayPk.slice(0, 4)}-01-01`;
    endDate = todayPk;
    label = "This Year";
  } else if (period === "lifetime") {
    startDate = "2020-01-01";
    endDate = todayPk;
    label = "Lifetime";
  } else if (period === "custom") {
    const validStart =
      rawStart && /^\d{4}-\d{2}-\d{2}$/.test(rawStart) ? rawStart : todayPk;
    const validEnd =
      rawEnd && /^\d{4}-\d{2}-\d{2}$/.test(rawEnd) ? rawEnd : validStart;
    if (validStart <= validEnd) {
      startDate = validStart;
      endDate = validEnd;
    } else {
      startDate = validEnd;
      endDate = validStart;
    }
    label = startDate === endDate ? startDate : `${startDate} → ${endDate}`;
  }

  const dayCount = diffDaysInclusive(startDate, endDate);
  const prevEndDate =
    period === "lifetime" ? "1999-12-31" : addDays(startDate, -1);
  const prevStartDate =
    period === "lifetime" ? "1999-12-30" : addDays(prevEndDate, -(dayCount - 1));

  return {
    period,
    label,
    startDate,
    endDate,
    prevStartDate,
    prevEndDate,
    dayCount,
  };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1));
}

function classifySaleStatus(
  status: unknown
): "COMPLETED" | "VOIDED" | "PENDING" {
  const s = String(status ?? "POSTED").trim().toUpperCase();
  if (s === "DRAFT" || s === "PENDING" || s === "OPEN") return "PENDING";
  if (s === "VOIDED" || s === "CANCELLED" || s === "REFUNDED") return "VOIDED";
  // POSTED, COMPLETED, PARTIALLY_REFUNDED
  return "COMPLETED";
}

function getShiftWindow(hourPk: number): "MORNING" | "EVENING" | "NIGHT" {
  if (hourPk >= 8 && hourPk < 16) return "MORNING";
  if (hourPk >= 16 && hourPk <= 23) return "EVENING";
  return "NIGHT";
}

export async function getOwnerBiDashboardData(
  businessId: string,
  rawPeriod?: string,
  rawStart?: string,
  rawEnd?: string
): Promise<OwnerBiPayload> {
  const range = resolveBiDateRange(rawPeriod, rawStart, rawEnd);
  const admin = createSupabaseAdminClient();

  const [
    { data: rawSales },
    { data: rawSaleItems },
    { data: rawPayments },
    { data: rawRefunds },
    { data: rawRefundItems },
    { data: rawExpenses },
    { data: rawInventoryItems },
    { data: rawProducts },
    { data: rawServices },
    { data: rawEmployees },
    { data: rawProfiles },
    { data: rawCashSessions },
    { data: rawCustomers },
    { data: rawLedger },
    { data: rawSavedClosings },
  ] = await Promise.all([
    admin
      .from("sales")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .range(0, 9999),
    admin
      .from("sale_items")
      .select("*")
      .eq("business_id", businessId)
      .range(0, 19999),
    admin
      .from("payments")
      .select("*")
      .eq("business_id", businessId)
      .range(0, 9999),
    admin
      .from("refunds")
      .select("id, sale_id, total_refund_paisa, posted_at, created_at, status")
      .eq("business_id", businessId)
      .range(0, 4999),
    admin
      .from("refund_items")
      .select("refund_id, sale_item_id, quantity, refund_amount_paisa")
      .eq("business_id", businessId)
      .range(0, 9999),
    admin
      .from("expenses")
      .select("*")
      .eq("business_id", businessId)
      .range(0, 9999),
    admin
      .from("inventory_items")
      .select("*")
      .eq("business_id", businessId)
      .range(0, 4999),
    admin
      .from("products")
      .select("*")
      .eq("business_id", businessId)
      .range(0, 4999),
    admin
      .from("services")
      .select("*")
      .eq("business_id", businessId)
      .range(0, 4999),
    admin
      .from("employees")
      .select("id, profile_id, full_name, designation, employment_status")
      .eq("business_id", businessId),
    admin.from("profiles").select("id, full_name, email"),
    admin
      .from("cash_sessions")
      .select("*")
      .eq("business_id", businessId)
      .order("opened_at", { ascending: false })
      .limit(120),
    admin.from("customers").select("*").eq("business_id", businessId),
    admin
      .from("customer_ledger")
      .select("customer_id, entry_type, amount_paisa")
      .eq("business_id", businessId),
    admin
      .from("saved_reports")
      .select("*")
      .eq("business_id", businessId)
      .eq("report_type", "DAILY_CLOSING")
      .order("created_at", { ascending: false })
      .limit(90),
  ]);

  // Staff / Profile lookup maps
  const profileNameMap = new Map<string, string>();
  for (const p of (rawProfiles ?? []) as Array<Record<string, unknown>>) {
    profileNameMap.set(String(p.id), String(p.full_name ?? p.email ?? "Staff"));
  }

  const employeeByProfile = new Map<
    string,
    { id: string; name: string; role: string }
  >();
  const employeeById = new Map<
    string,
    { id: string; name: string; role: string }
  >();
  for (const emp of (rawEmployees ?? []) as Array<Record<string, unknown>>) {
    const info = {
      id: String(emp.id),
      name: String(emp.full_name ?? "Staff"),
      role: String(emp.designation ?? "Staff"),
    };
    employeeById.set(info.id, info);
    if (emp.profile_id) {
      employeeByProfile.set(String(emp.profile_id), info);
    }
  }

  // Catalog lookup by database ID & SKU (never merging distinct products with similar names!)
  const inventoryById = new Map<string, Record<string, unknown>>();
  const inventoryBySku = new Map<string, Record<string, unknown>>();
  for (const inv of (rawInventoryItems ?? []) as Array<Record<string, unknown>>) {
    const idStr = String(inv.id);
    inventoryById.set(idStr, inv);
    if (inv.sku) {
      inventoryBySku.set(String(inv.sku).trim().toUpperCase(), inv);
    }
    inventoryBySku.set(`INV-${idStr.slice(0, 8).toUpperCase()}`, inv);
    inventoryBySku.set(`INV-${idStr.slice(0, 12).toUpperCase()}`, inv);
  }

  const productById = new Map<string, Record<string, unknown>>();
  const productToInvId = new Map<string, string>();
  for (const prod of (rawProducts ?? []) as Array<Record<string, unknown>>) {
    const pId = String(prod.id);
    productById.set(pId, prod);
    const pSku = prod.sku ? String(prod.sku).trim().toUpperCase() : "";
    const matchedInv = pSku ? inventoryBySku.get(pSku) : undefined;
    if (matchedInv?.id) {
      productToInvId.set(pId, String(matchedInv.id));
    }
  }

  const serviceById = new Map<string, Record<string, unknown>>();
  for (const srv of (rawServices ?? []) as Array<Record<string, unknown>>) {
    serviceById.set(String(srv.id), srv);
  }

  // Payments per sale
  const paymentBySale = new Map<
    string,
    Array<{ method: string; amountPaisa: number }>
  >();
  for (const p of (rawPayments ?? []) as Array<Record<string, unknown>>) {
    const pStatus = String(p.status ?? "COMPLETED").toUpperCase();
    if (pStatus === "REVERSED") continue;
    const sid = String(p.sale_id);
    const list = paymentBySale.get(sid) ?? [];
    list.push({
      method: String(p.method ?? "CASH").toUpperCase(),
      amountPaisa: Number(p.amount_paisa ?? 0),
    });
    paymentBySale.set(sid, list);
  }

  // Sale items grouped by sale_id & lookup by sale_item.id for partial refunds
  const itemsBySale = new Map<string, Array<Record<string, unknown>>>();
  const saleItemById = new Map<string, Record<string, unknown>>();
  for (const item of (rawSaleItems ?? []) as Array<Record<string, unknown>>) {
    const sid = String(item.sale_id);
    saleItemById.set(String(item.id), item);
    const list = itemsBySale.get(sid) ?? [];
    list.push(item);
    itemsBySale.set(sid, list);
  }

  // Refunds indexed cleanly
  const refundItemsByRefund = new Map<string, Array<Record<string, unknown>>>();
  for (const ri of (rawRefundItems ?? []) as Array<Record<string, unknown>>) {
    const rid = String(ri.refund_id);
    const list = refundItemsByRefund.get(rid) ?? [];
    list.push(ri);
    refundItemsByRefund.set(rid, list);
  }

  // Saved closings by date
  const closingHistory: BiClosingMiniSummary[] = [];
  const wagesByDate = new Map<string, number>();
  const closingSeenDates = new Set<string>();
  for (const rep of (rawSavedClosings ?? []) as Array<Record<string, unknown>>) {
    const pl = (rep.payload ?? {}) as Record<string, unknown>;
    const dateStr = String(pl.closingDate ?? "").slice(0, 10);
    if (!dateStr || closingSeenDates.has(dateStr)) continue;
    closingSeenDates.add(dateStr);

    const wageList = Array.isArray(pl.wages)
      ? (pl.wages as Array<Record<string, unknown>>)
      : [];
    const expList = Array.isArray(pl.closingExpenses)
      ? (pl.closingExpenses as Array<Record<string, unknown>>)
      : [];
    const totalWagesPaisa = wageList.reduce(
      (s, w) => s + Number(w.wagePaisa ?? 0),
      0
    );
    const totalExpPaisa =
      Number(pl.liveExpensesPaisa ?? 0) +
      expList.reduce((s, e) => s + Number(e.amountPaisa ?? 0), 0);

    wagesByDate.set(dateStr, totalWagesPaisa);
    closingHistory.push({
      closingDate: dateStr,
      netSalesPaisa: Number(pl.netSalesPaisa ?? 0),
      totalExpensesPaisa: totalExpPaisa,
      totalWagesPaisa,
      expectedClosingPaisa: Number(pl.expectedClosingPaisa ?? 0),
      actualClosingPaisa: Number(pl.actualClosingPaisa ?? 0),
      cashDifferencePaisa: Number(pl.cashDifferencePaisa ?? 0),
    });
  }
  closingHistory.sort((a, b) => b.closingDate.localeCompare(a.closingDate));

  // Pre-seed daily chart buckets (up to 90 days cleanly)
  const dailyMap = new Map<string, BiTimePoint>();
  if (range.dayCount <= 90) {
    for (let i = 0; i < range.dayCount; i++) {
      const d = addDays(range.startDate, i);
      dailyMap.set(d, {
        key: d,
        label: d.slice(5),
        revenuePaisa: 0,
        cogsPaisa: 0,
        grossProfitPaisa: 0,
        expensesPaisa: 0,
        netProfitPaisa: 0,
        cashPaisa: 0,
        digitalPaisa: 0,
        transactionCount: 0,
        unitsSold: 0,
        txIds: [],
      });
    }
  }

  const weeklyMap = new Map<string, BiTimePoint>();
  const monthlyMap = new Map<string, BiTimePoint>();
  const yearlyMap = new Map<string, BiTimePoint>();
  const hourlyMap = new Map<number, BiTimePoint>();
  for (let h = 0; h < 24; h++) {
    hourlyMap.set(h, {
      key: String(h).padStart(2, "0"),
      label: `${String(h).padStart(2, "0")}:00`,
      revenuePaisa: 0,
      cogsPaisa: 0,
      grossProfitPaisa: 0,
      expensesPaisa: 0,
      netProfitPaisa: 0,
      cashPaisa: 0,
      digitalPaisa: 0,
      transactionCount: 0,
      unitsSold: 0,
      txIds: [],
    });
  }

  const shiftMap: Record<"MORNING" | "EVENING" | "NIGHT", BiShiftStat> = {
    MORNING: {
      shift: "MORNING",
      label: "Morning Shift",
      windowLabel: "08:00–16:00 PKT",
      revenuePaisa: 0,
      expensesPaisa: 0,
      cashPaisa: 0,
      digitalPaisa: 0,
      transactionCount: 0,
      unitsSold: 0,
      cashVariancePaisa: 0,
      employees: [],
      txIds: [],
    },
    EVENING: {
      shift: "EVENING",
      label: "Evening Shift",
      windowLabel: "16:00–00:00 PKT",
      revenuePaisa: 0,
      expensesPaisa: 0,
      cashPaisa: 0,
      digitalPaisa: 0,
      transactionCount: 0,
      unitsSold: 0,
      cashVariancePaisa: 0,
      employees: [],
      txIds: [],
    },
    NIGHT: {
      shift: "NIGHT",
      label: "After-Hours",
      windowLabel: "00:00–08:00 PKT",
      revenuePaisa: 0,
      expensesPaisa: 0,
      cashPaisa: 0,
      digitalPaisa: 0,
      transactionCount: 0,
      unitsSold: 0,
      cashVariancePaisa: 0,
      employees: [],
      txIds: [],
    },
  };
  const shiftEmployeeSets: Record<
    "MORNING" | "EVENING" | "NIGHT",
    Set<string>
  > = {
    MORNING: new Set(),
    EVENING: new Set(),
    NIGHT: new Set(),
  };

  // Seed productAgg with ALL real inventory items keyed strictly by DB ID `inv:<id>`
  const productAgg = new Map<
    string,
    {
      key: string;
      productId: string | null;
      name: string;
      category: string;
      kind: "PRODUCT" | "SERVICE";
      unitsSold: number;
      revenuePaisa: number;
      cogsPaisa: number;
      prevUnitsSold: number;
      prevRevenuePaisa: number;
      currentStock: number | null;
      minStockAlert: number | null;
      costPricePaisa: number;
      retailPricePaisa: number;
    }
  >();

  for (const inv of (rawInventoryItems ?? []) as Array<Record<string, unknown>>) {
    const invId = String(inv.id);
    const key = `inv:${invId}`;
    productAgg.set(key, {
      key,
      productId: invId,
      name: String(inv.name ?? "Unnamed Product").trim(),
      category: String(inv.category ?? "General"),
      kind: "PRODUCT",
      unitsSold: 0,
      revenuePaisa: 0,
      cogsPaisa: 0,
      prevUnitsSold: 0,
      prevRevenuePaisa: 0,
      currentStock: Number(inv.stock_quantity ?? 0),
      minStockAlert: Number(inv.min_stock_alert ?? 5),
      costPricePaisa: Number(inv.cost_price_paisa ?? 0),
      retailPricePaisa: Number(inv.retail_price_paisa ?? 0),
    });
  }

  const resolveLineProductIdentity = (line: Record<string, unknown>) => {
    const prodId = line.product_id ? String(line.product_id) : null;
    const srvId = line.service_id ? String(line.service_id) : null;
    const prodRow = prodId ? productById.get(prodId) : undefined;
    const srvRow = srvId ? serviceById.get(srvId) : undefined;
    const linkedInvId = prodId ? productToInvId.get(prodId) : undefined;
    const invRow = linkedInvId ? inventoryById.get(linkedInvId) : undefined;

    const displayName = String(
      invRow?.name ??
        line.description ??
        line.item_name ??
        prodRow?.name ??
        srvRow?.name ??
        "Counter Item"
    ).trim();

    const category = String(
      line.category_name ??
        invRow?.category ??
        (line.item_kind === "SERVICE" || srvId ? "Services" : "Accessories")
    );

    if (linkedInvId) {
      return {
        key: `inv:${linkedInvId}`,
        productId: linkedInvId,
        name: displayName,
        category,
        kind: "PRODUCT" as const,
        fallbackUnitCost: Number(invRow?.cost_price_paisa ?? prodRow?.cost_price_paisa ?? 0),
        fallbackUnitPrice: Number(invRow?.retail_price_paisa ?? prodRow?.sale_price_paisa ?? 0),
      };
    }

    if (prodId) {
      return {
        key: `prod:${prodId}`,
        productId: prodId,
        name: displayName,
        category,
        kind: "PRODUCT" as const,
        fallbackUnitCost: Number(prodRow?.cost_price_paisa ?? 0),
        fallbackUnitPrice: Number(prodRow?.sale_price_paisa ?? 0),
      };
    }

    if (srvId) {
      return {
        key: `srv:${srvId}`,
        productId: srvId,
        name: displayName,
        category,
        kind: "SERVICE" as const,
        fallbackUnitCost: 0,
        fallbackUnitPrice: Number(srvRow?.default_price_paisa ?? 0),
      };
    }

    return {
      key: `custom:${displayName.toLowerCase()}`,
      productId: null,
      name: displayName,
      category,
      kind: "SERVICE" as const,
      fallbackUnitCost: 0,
      fallbackUnitPrice: 0,
    };
  };

  const categoryMap = new Map<
    string,
    {
      revenuePaisa: number;
      unitsSold: number;
      txIds: Set<string>;
      cogsPaisa: number;
      productRevenue: Map<string, number>;
    }
  >();

  const categoryTrendMap = new Map<string, BiCategoryTrendPoint>();

  const employeeAgg = new Map<
    string,
    {
      employeeKey: string;
      name: string;
      roleLabel: string;
      revenuePaisa: number;
      transactionCount: number;
      unitsSold: number;
      refundVoidCount: number;
      refundVoidAmountPaisa: number;
      morningRevenuePaisa: number;
      eveningRevenuePaisa: number;
      categoryRevenue: Map<string, number>;
      txIds: string[];
    }
  >();

  const resolveSeller = (soldByRaw: unknown) => {
    const key = soldByRaw ? String(soldByRaw) : "unassigned";
    const empByP = employeeByProfile.get(key) ?? employeeById.get(key);
    if (empByP) {
      return { key, name: empByP.name, role: empByP.role };
    }
    const profName = profileNameMap.get(key);
    if (profName) {
      return { key, name: profName, role: "Staff / Cashier" };
    }
    return {
      key,
      name: key === "unassigned" ? "Counter Terminal" : `Staff (${key.slice(0, 6)})`,
      role: "Cashier",
    };
  };

  let grossBilledPaisa = 0;
  let discountsPaisa = 0;
  let grossSalesPaisa = 0;
  let refundsPaisa = 0;
  let refundCount = 0;
  let cogsPaisa = 0;
  let transactionCount = 0;
  let totalUnitsSold = 0;
  let cashPaymentsPaisa = 0;
  let digitalPaymentsPaisa = 0;
  const paymentMethodAgg = new Map<
    string,
    { amountPaisa: number; count: number }
  >();

  let prevGrossSalesPaisa = 0;
  let prevRefundsPaisa = 0;
  let prevCogsPaisa = 0;
  let prevTransactionCount = 0;

  const transactions: TxInspectItem[] = [];

  for (const sale of (rawSales ?? []) as Array<Record<string, unknown>>) {
    const statusClass = classifySaleStatus(sale.status);
    // Strict Rule: Pending / Draft sales NEVER count as completed sales
    if (statusClass === "PENDING") continue;

    const iso = String(sale.posted_at ?? sale.created_at ?? "");
    if (!iso) continue;
    const createdDate = new Date(iso);
    const datePk = formatPkDateStr(createdDate);

    const inCurrent = datePk >= range.startDate && datePk <= range.endDate;
    const inPrev = datePk >= range.prevStartDate && datePk <= range.prevEndDate;

    const saleId = String(sale.id);
    const totalPaisa = Number(sale.total_paisa ?? 0);
    const discountPaisa = Number(sale.discount_paisa ?? 0);
    const subtotalPaisa = Number(
      sale.subtotal_paisa ?? totalPaisa + discountPaisa
    );
    const lines = itemsBySale.get(saleId) ?? [];

    let saleCogsPaisa = 0;
    let saleUnits = 0;
    const txLineItems: Array<{
      productKey: string;
      productId: string | null;
      kind: "PRODUCT" | "SERVICE";
      name: string;
      category: string;
      quantity: number;
      revenuePaisa: number;
      cogsPaisa: number;
      unitCostPaisa: number;
      unitPricePaisa: number;
    }> = [];

    // Check whether line_total_paisa already includes bill discount or represents pre-discount line amount
    const sumLineTotals = lines.reduce(
      (s, l) => s + Number(l.line_total_paisa ?? l.total_paisa ?? 0),
      0
    );
    const linesNeedBillDiscountScale =
      subtotalPaisa > 0 &&
      discountPaisa > 0 &&
      Math.abs(sumLineTotals - subtotalPaisa) < Math.abs(sumLineTotals - totalPaisa);
    const discountScale = linesNeedBillDiscountScale
      ? Math.max(0, totalPaisa / subtotalPaisa)
      : 1;

    for (const line of lines) {
      const ident = resolveLineProductIdentity(line);
      const qty = Math.max(1, Number(line.quantity ?? 1));
      const rawLineTotal = Number(line.line_total_paisa ?? line.total_paisa ?? 0);
      const scaledLineTotal = Math.round(rawLineTotal * discountScale);
      const rawUnitCost = Number(
        line.unit_cost_snapshot_paisa ??
          line.unit_cost_paisa ??
          line.cost_price_paisa ??
          0
      );
      const unitCost =
        rawUnitCost > 0 ? rawUnitCost : ident.fallbackUnitCost;
      const lineCogs = unitCost * qty;
      const unitPrice = Number(
        line.unit_price_paisa ?? Math.round(rawLineTotal / qty)
      );

      saleCogsPaisa += lineCogs;
      saleUnits += qty;
      txLineItems.push({
        productKey: ident.key,
        productId: ident.productId,
        kind: ident.kind,
        name: ident.name,
        category: ident.category,
        quantity: qty,
        revenuePaisa: scaledLineTotal,
        cogsPaisa: lineCogs,
        unitCostPaisa: unitCost,
        unitPricePaisa: unitPrice || ident.fallbackUnitPrice,
      });
    }

    if (lines.length === 0 && statusClass === "COMPLETED" && totalPaisa > 0) {
      saleUnits = 1;
    }

    const seller = resolveSeller(sale.sold_by);
    const hourPk = getPkHour(createdDate);
    const shiftWin = getShiftWindow(hourPk);

    const salePayments = paymentBySale.get(saleId) ?? [];
    const primaryMethod =
      salePayments.length > 0 ? salePayments[0].method : "CASH";

    if (statusClass === "COMPLETED") {
      const weekKey = getWeekStartMonday(datePk);
      const monthKey = datePk.slice(0, 7);
      const yearKey = datePk.slice(0, 4);

      const ensureBucket = (
        map: Map<string, BiTimePoint>,
        key: string,
        labelStr: string
      ) => {
        let bucket = map.get(key);
        if (!bucket) {
          bucket = {
            key,
            label: labelStr,
            revenuePaisa: 0,
            cogsPaisa: 0,
            grossProfitPaisa: 0,
            expensesPaisa: 0,
            netProfitPaisa: 0,
            cashPaisa: 0,
            digitalPaisa: 0,
            transactionCount: 0,
            unitsSold: 0,
            txIds: [],
          };
          map.set(key, bucket);
        }
        return bucket;
      };

      for (const [m, k, l] of [
        [weeklyMap, weekKey, `Wk ${weekKey.slice(5)}`],
        [monthlyMap, monthKey, monthKey],
        [yearlyMap, yearKey, yearKey],
      ] as const) {
        const b = ensureBucket(m, k, l);
        b.revenuePaisa += totalPaisa;
        b.cogsPaisa += saleCogsPaisa;
        b.grossProfitPaisa += totalPaisa - saleCogsPaisa;
        b.transactionCount += 1;
        b.unitsSold += saleUnits;
        if (primaryMethod === "CASH") b.cashPaisa += totalPaisa;
        else b.digitalPaisa += totalPaisa;
      }
    }

    if (!inCurrent && !inPrev) continue;

    if (inPrev) {
      if (statusClass === "VOIDED") {
        prevRefundsPaisa += totalPaisa;
      } else {
        prevGrossSalesPaisa += totalPaisa;
        prevCogsPaisa += saleCogsPaisa;
        prevTransactionCount += 1;

        for (const li of txLineItems) {
          const existing = productAgg.get(li.productKey) ?? {
            key: li.productKey,
            productId: li.productId,
            name: li.name,
            category: li.category,
            kind: li.kind,
            unitsSold: 0,
            revenuePaisa: 0,
            cogsPaisa: 0,
            prevUnitsSold: 0,
            prevRevenuePaisa: 0,
            currentStock: null,
            minStockAlert: null,
            costPricePaisa: li.unitCostPaisa,
            retailPricePaisa: li.unitPricePaisa,
          };
          existing.prevUnitsSold += li.quantity;
          existing.prevRevenuePaisa += li.revenuePaisa;
          productAgg.set(li.productKey, existing);
        }
      }
      continue;
    }

    // Current Period
    const empEntry = employeeAgg.get(seller.key) ?? {
      employeeKey: seller.key,
      name: seller.name,
      roleLabel: seller.role,
      revenuePaisa: 0,
      transactionCount: 0,
      unitsSold: 0,
      refundVoidCount: 0,
      refundVoidAmountPaisa: 0,
      morningRevenuePaisa: 0,
      eveningRevenuePaisa: 0,
      categoryRevenue: new Map<string, number>(),
      txIds: [],
    };

    if (statusClass === "VOIDED") {
      // Cancelled / Voided / Fully Refunded sales do NOT count in product rankings or gross sales
      refundsPaisa += totalPaisa;
      refundCount += 1;
      empEntry.refundVoidCount += 1;
      empEntry.refundVoidAmountPaisa += totalPaisa;
      employeeAgg.set(seller.key, empEntry);
      transactions.push({
        id: saleId,
        receiptNumber: String(
          sale.receipt_number ?? saleId.slice(0, 8).toUpperCase()
        ),
        customerName: String(sale.customer_name ?? "Walk-in Customer"),
        createdAtIso: iso,
        datePk,
        timePk: formatPkTimeStr(createdDate),
        hourPk,
        shiftLabel: shiftWin,
        soldByKey: seller.key,
        soldByName: seller.name,
        paymentMethod: primaryMethod,
        subtotalPaisa,
        discountPaisa,
        totalPaisa,
        cogsPaisa: saleCogsPaisa,
        profitPaisa: 0,
        units: saleUnits,
        status: String(sale.status ?? "VOIDED"),
        items: txLineItems.map((i) => ({
          name: i.name,
          category: i.category,
          quantity: i.quantity,
          revenuePaisa: i.revenuePaisa,
          cogsPaisa: i.cogsPaisa,
        })),
      });
      continue;
    }

    grossBilledPaisa += subtotalPaisa;
    discountsPaisa += discountPaisa;
    grossSalesPaisa += totalPaisa;
    cogsPaisa += saleCogsPaisa;
    transactionCount += 1;
    totalUnitsSold += saleUnits;

    if (salePayments.length > 0) {
      for (const sp of salePayments) {
        if (sp.method === "CASH") cashPaymentsPaisa += sp.amountPaisa;
        else digitalPaymentsPaisa += sp.amountPaisa;
        const agg = paymentMethodAgg.get(sp.method) ?? {
          amountPaisa: 0,
          count: 0,
        };
        agg.amountPaisa += sp.amountPaisa;
        agg.count += 1;
        paymentMethodAgg.set(sp.method, agg);
      }
    } else if (totalPaisa > 0) {
      cashPaymentsPaisa += totalPaisa;
      const agg = paymentMethodAgg.get("CASH") ?? { amountPaisa: 0, count: 0 };
      agg.amountPaisa += totalPaisa;
      agg.count += 1;
      paymentMethodAgg.set("CASH", agg);
    }

    // Time series buckets
    let dPoint = dailyMap.get(datePk);
    if (!dPoint) {
      dPoint = {
        key: datePk,
        label: datePk.slice(5),
        revenuePaisa: 0,
        cogsPaisa: 0,
        grossProfitPaisa: 0,
        expensesPaisa: 0,
        netProfitPaisa: 0,
        cashPaisa: 0,
        digitalPaisa: 0,
        transactionCount: 0,
        unitsSold: 0,
        txIds: [],
      };
      dailyMap.set(datePk, dPoint);
    }
    dPoint.revenuePaisa += totalPaisa;
    dPoint.cogsPaisa += saleCogsPaisa;
    dPoint.grossProfitPaisa += totalPaisa - saleCogsPaisa;
    dPoint.transactionCount += 1;
    dPoint.unitsSold += saleUnits;
    if (primaryMethod === "CASH") dPoint.cashPaisa += totalPaisa;
    else dPoint.digitalPaisa += totalPaisa;
    dPoint.txIds.push(saleId);

    const hPoint = hourlyMap.get(hourPk);
    if (hPoint) {
      hPoint.revenuePaisa += totalPaisa;
      hPoint.cogsPaisa += saleCogsPaisa;
      hPoint.grossProfitPaisa += totalPaisa - saleCogsPaisa;
      hPoint.transactionCount += 1;
      hPoint.unitsSold += saleUnits;
      if (primaryMethod === "CASH") hPoint.cashPaisa += totalPaisa;
      else hPoint.digitalPaisa += totalPaisa;
      hPoint.txIds.push(saleId);
    }

    const sh = shiftMap[shiftWin];
    sh.revenuePaisa += totalPaisa;
    sh.transactionCount += 1;
    sh.unitsSold += saleUnits;
    if (primaryMethod === "CASH") sh.cashPaisa += totalPaisa;
    else sh.digitalPaisa += totalPaisa;
    sh.txIds.push(saleId);
    shiftEmployeeSets[shiftWin].add(seller.name);

    empEntry.revenuePaisa += totalPaisa;
    empEntry.transactionCount += 1;
    empEntry.unitsSold += saleUnits;
    if (shiftWin === "MORNING") empEntry.morningRevenuePaisa += totalPaisa;
    else empEntry.eveningRevenuePaisa += totalPaisa;
    empEntry.txIds.push(saleId);

    const trendBucketKey = range.dayCount > 90 ? datePk.slice(0, 7) : datePk;
    const trendPoint = categoryTrendMap.get(trendBucketKey) ?? {
      dateKey: trendBucketKey,
      label: range.dayCount > 90 ? trendBucketKey : trendBucketKey.slice(5),
      totalRevenuePaisa: 0,
      byCategory: {},
    };

    for (const li of txLineItems) {
      const existing = productAgg.get(li.productKey) ?? {
        key: li.productKey,
        productId: li.productId,
        name: li.name,
        category: li.category,
        kind: li.kind,
        unitsSold: 0,
        revenuePaisa: 0,
        cogsPaisa: 0,
        prevUnitsSold: 0,
        prevRevenuePaisa: 0,
        currentStock: null,
        minStockAlert: null,
        costPricePaisa: li.unitCostPaisa,
        retailPricePaisa: li.unitPricePaisa,
      };
      existing.unitsSold += li.quantity;
      existing.revenuePaisa += li.revenuePaisa;
      existing.cogsPaisa += li.cogsPaisa;
      if (li.unitPricePaisa > 0) existing.retailPricePaisa = li.unitPricePaisa;
      if (li.unitCostPaisa > 0) existing.costPricePaisa = li.unitCostPaisa;
      productAgg.set(li.productKey, existing);

      const catEntry = categoryMap.get(li.category) ?? {
        revenuePaisa: 0,
        unitsSold: 0,
        txIds: new Set<string>(),
        cogsPaisa: 0,
        productRevenue: new Map<string, number>(),
      };
      catEntry.revenuePaisa += li.revenuePaisa;
      catEntry.unitsSold += li.quantity;
      catEntry.txIds.add(saleId);
      catEntry.cogsPaisa += li.cogsPaisa;
      catEntry.productRevenue.set(
        li.name,
        (catEntry.productRevenue.get(li.name) ?? 0) + li.revenuePaisa
      );
      categoryMap.set(li.category, catEntry);

      trendPoint.totalRevenuePaisa += li.revenuePaisa;
      trendPoint.byCategory[li.category] =
        (trendPoint.byCategory[li.category] ?? 0) + li.revenuePaisa;

      empEntry.categoryRevenue.set(
        li.category,
        (empEntry.categoryRevenue.get(li.category) ?? 0) + li.revenuePaisa
      );
    }

    categoryTrendMap.set(trendBucketKey, trendPoint);
    employeeAgg.set(seller.key, empEntry);

    transactions.push({
      id: saleId,
      receiptNumber: String(
        sale.receipt_number ?? saleId.slice(0, 8).toUpperCase()
      ),
      customerName: String(sale.customer_name ?? "Walk-in Customer"),
      createdAtIso: iso,
      datePk,
      timePk: formatPkTimeStr(createdDate),
      hourPk,
      shiftLabel: shiftWin,
      soldByKey: seller.key,
      soldByName: seller.name,
      paymentMethod: primaryMethod,
      subtotalPaisa,
      discountPaisa,
      totalPaisa,
      cogsPaisa: saleCogsPaisa,
      profitPaisa: totalPaisa - saleCogsPaisa,
      units: saleUnits,
      status: String(sale.status ?? "POSTED"),
      items: txLineItems.map((i) => ({
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        revenuePaisa: i.revenuePaisa,
        cogsPaisa: i.cogsPaisa,
      })),
    });
  }

  // Apply refunds & partial refund_items to overall totals + exact product/category figures
  for (const rf of (rawRefunds ?? []) as Array<Record<string, unknown>>) {
    const rStatus = String(rf.status ?? "POSTED").toUpperCase();
    if (rStatus === "CANCELLED" || rStatus === "VOIDED" || rStatus === "DRAFT") {
      continue;
    }
    const rDate = rf.posted_at
      ? formatPkDateStr(new Date(String(rf.posted_at)))
      : rf.created_at
      ? formatPkDateStr(new Date(String(rf.created_at)))
      : "";
    if (!rDate) continue;

    const amt = Number(rf.total_refund_paisa ?? 0);
    const rfItems = refundItemsByRefund.get(String(rf.id)) ?? [];

    if (rDate >= range.startDate && rDate <= range.endDate) {
      refundsPaisa += amt;
      refundCount += 1;

      for (const ri of rfItems) {
        const sItem = saleItemById.get(String(ri.sale_item_id));
        if (!sItem) continue;
        const ident = resolveLineProductIdentity(sItem);
        const rQty = Math.max(0, Number(ri.quantity ?? 0));
        const rAmt = Math.max(0, Number(ri.refund_amount_paisa ?? 0));
        const unitCost = Number(
          sItem.unit_cost_snapshot_paisa ??
            sItem.cost_price_paisa ??
            ident.fallbackUnitCost
        );
        const rCogs = rQty * unitCost;

        const pAgg = productAgg.get(ident.key);
        if (pAgg) {
          pAgg.unitsSold = Math.max(0, pAgg.unitsSold - rQty);
          pAgg.revenuePaisa = Math.max(0, pAgg.revenuePaisa - rAmt);
          pAgg.cogsPaisa = Math.max(0, pAgg.cogsPaisa - rCogs);
        }

        const cAgg = categoryMap.get(ident.category);
        if (cAgg) {
          cAgg.unitsSold = Math.max(0, cAgg.unitsSold - rQty);
          cAgg.revenuePaisa = Math.max(0, cAgg.revenuePaisa - rAmt);
          cAgg.cogsPaisa = Math.max(0, cAgg.cogsPaisa - rCogs);
          const curPr = cAgg.productRevenue.get(ident.name) ?? 0;
          cAgg.productRevenue.set(ident.name, Math.max(0, curPr - rAmt));
        }

        cogsPaisa = Math.max(0, cogsPaisa - rCogs);
        totalUnitsSold = Math.max(0, totalUnitsSold - rQty);
      }
    } else if (rDate >= range.prevStartDate && rDate <= range.prevEndDate) {
      prevRefundsPaisa += amt;
    }
  }

  // Expenses in current & previous range
  let operatingExpensesPaisa = 0;
  let prevExpensesPaisa = 0;
  for (const exp of (rawExpenses ?? []) as Array<Record<string, unknown>>) {
    const iso = String(exp.incurred_at ?? exp.created_at ?? "");
    const dStr = exp.expense_date
      ? String(exp.expense_date).slice(0, 10)
      : iso
      ? formatPkDateStr(new Date(iso))
      : "";
    if (!dStr) continue;
    const amt = Number(exp.amount_paisa ?? 0);

    const wKey = getWeekStartMonday(dStr);
    const mKey = dStr.slice(0, 7);
    const yKey = dStr.slice(0, 4);
    if (weeklyMap.has(wKey)) weeklyMap.get(wKey)!.expensesPaisa += amt;
    if (monthlyMap.has(mKey)) monthlyMap.get(mKey)!.expensesPaisa += amt;
    if (yearlyMap.has(yKey)) yearlyMap.get(yKey)!.expensesPaisa += amt;

    if (dStr >= range.startDate && dStr <= range.endDate) {
      operatingExpensesPaisa += amt;
      const dp = dailyMap.get(dStr);
      if (dp) dp.expensesPaisa += amt;
      if (iso) {
        const shWin = getShiftWindow(getPkHour(new Date(iso)));
        shiftMap[shWin].expensesPaisa += amt;
      } else {
        shiftMap.MORNING.expensesPaisa += amt;
      }
    } else if (dStr >= range.prevStartDate && dStr <= range.prevEndDate) {
      prevExpensesPaisa += amt;
    }
  }

  // Daily wages from saved closings
  let dailyWagesPaisa = 0;
  let prevWagesPaisa = 0;
  for (const [dStr, wageAmt] of wagesByDate.entries()) {
    if (dStr >= range.startDate && dStr <= range.endDate) {
      dailyWagesPaisa += wageAmt;
      const dp = dailyMap.get(dStr);
      if (dp) dp.expensesPaisa += wageAmt;
    } else if (dStr >= range.prevStartDate && dStr <= range.prevEndDate) {
      prevWagesPaisa += wageAmt;
    }
  }

  for (const map of [dailyMap, weeklyMap, monthlyMap, yearlyMap]) {
    for (const pt of map.values()) {
      pt.netProfitPaisa = pt.grossProfitPaisa - pt.expensesPaisa;
    }
  }

  // Cash sessions
  let expectedCashDrawerPaisa = 0;
  let openCashSessionCount = 0;
  for (const cs of (rawCashSessions ?? []) as Array<Record<string, unknown>>) {
    if (cs.status === "OPEN") {
      openCashSessionCount += 1;
      expectedCashDrawerPaisa += Number(cs.expected_closing_paisa ?? 0);
    }
    const openedDate = cs.opened_at
      ? formatPkDateStr(new Date(String(cs.opened_at)))
      : "";
    if (openedDate >= range.startDate && openedDate <= range.endDate) {
      const variance = Number(cs.variance_paisa ?? 0);
      const sw = String(cs.shift_window ?? "MORNING").toUpperCase();
      if (sw === "EVENING") shiftMap.EVENING.cashVariancePaisa += variance;
      else shiftMap.MORNING.cashVariancePaisa += variance;
    }
  }

  // Receivables & Liabilities
  let outstandingReceivablesPaisa = 0;
  const outstandingLiabilitiesPaisa = 0;
  for (const cust of (rawCustomers ?? []) as Array<Record<string, unknown>>) {
    const bal = Number(cust.pending_balance_paisa ?? cust.balance_paisa ?? 0);
    if (bal > 0) outstandingReceivablesPaisa += bal;
  }
  if (outstandingReceivablesPaisa === 0 && (rawLedger ?? []).length > 0) {
    let netLedger = 0;
    for (const le of (rawLedger ?? []) as Array<Record<string, unknown>>) {
      const amt = Number(le.amount_paisa ?? 0);
      const t = String(le.entry_type ?? "").toUpperCase();
      netLedger += t === "PAYMENT" || t === "CREDIT" ? -amt : amt;
    }
    if (netLedger > 0) outstandingReceivablesPaisa = netLedger;
  }

  // Inventory valuation & restocking
  let inventoryCostValuationPaisa = 0;
  let inventoryRetailValuationPaisa = 0;
  let totalUnitsInStock = 0;
  const lowStockItems: BiInventoryIntelligence["lowStockItems"] = [];
  const outOfStockItems: BiInventoryIntelligence["outOfStockItems"] = [];
  const deadStockItems: BiInventoryIntelligence["deadStockItems"] = [];

  for (const inv of (rawInventoryItems ?? []) as Array<Record<string, unknown>>) {
    const invId = String(inv.id);
    const qty = Math.max(0, Number(inv.stock_quantity ?? 0));
    const cost = Math.max(0, Number(inv.cost_price_paisa ?? 0));
    const retail = Math.max(0, Number(inv.retail_price_paisa ?? 0));
    const minAlert = Math.max(1, Number(inv.min_stock_alert ?? 5));
    const name = String(inv.name ?? "Unnamed");
    const category = String(inv.category ?? "General");

    totalUnitsInStock += qty;
    inventoryCostValuationPaisa += qty * cost;
    inventoryRetailValuationPaisa += qty * retail;

    if (qty === 0) {
      const targetReorder = Math.max(minAlert * 2, 10);
      outOfStockItems.push({
        id: invId,
        name,
        category,
        minAlert,
        suggestedReorder: targetReorder,
        reorderCostPaisa: targetReorder * cost,
      });
    } else if (qty <= minAlert) {
      const targetReorder = Math.max(minAlert * 2 - qty, 5);
      lowStockItems.push({
        id: invId,
        name,
        category,
        stock: qty,
        minAlert,
        suggestedReorder: targetReorder,
        reorderCostPaisa: targetReorder * cost,
      });
    }

    const pStat = productAgg.get(`inv:${invId}`);
    if (qty > 0 && (!pStat || pStat.unitsSold === 0)) {
      deadStockItems.push({
        id: invId,
        name,
        category,
        stock: qty,
        valuationPaisa: qty * cost,
      });
    }
  }

  const netRevenuePaisa = Math.max(0, grossSalesPaisa - refundsPaisa);
  const grossProfitPaisa = netRevenuePaisa - cogsPaisa;
  const grossMarginPct =
    netRevenuePaisa > 0
      ? Number(((grossProfitPaisa / netRevenuePaisa) * 100).toFixed(1))
      : 0;
  const totalExpensesAndWagesPaisa = operatingExpensesPaisa + dailyWagesPaisa;
  const netOperatingProfitPaisa = grossProfitPaisa - totalExpensesAndWagesPaisa;
  const netMarginPct =
    netRevenuePaisa > 0
      ? Number(((netOperatingProfitPaisa / netRevenuePaisa) * 100).toFixed(1))
      : 0;
  const aovPaisa =
    transactionCount > 0 ? Math.round(netRevenuePaisa / transactionCount) : 0;

  const prevNetRevenuePaisa =
    range.period === "lifetime"
      ? 0
      : Math.max(0, prevGrossSalesPaisa - prevRefundsPaisa);
  const prevGrossProfitPaisa =
    range.period === "lifetime" ? 0 : prevNetRevenuePaisa - prevCogsPaisa;
  const prevTotalExpenses =
    range.period === "lifetime" ? 0 : prevExpensesPaisa + prevWagesPaisa;

  const totalProductRevenueSum = Array.from(productAgg.values()).reduce(
    (s, p) => s + p.revenuePaisa,
    0
  );

  const products: BiProductStat[] = Array.from(productAgg.values()).map((p) => {
    const grossProfit = p.revenuePaisa - p.cogsPaisa;
    const marginPct =
      p.revenuePaisa > 0
        ? Number(((grossProfit / p.revenuePaisa) * 100).toFixed(1))
        : 0;
    const revenueContributionPct =
      totalProductRevenueSum > 0
        ? Number(((p.revenuePaisa / totalProductRevenueSum) * 100).toFixed(1))
        : 0;
    const unitsDelta = p.unitsSold - p.prevUnitsSold;
    const growthPct =
      p.prevUnitsSold === 0
        ? p.unitsSold > 0
          ? 100
          : 0
        : Number(((unitsDelta / p.prevUnitsSold) * 100).toFixed(1));

    let trend: BiProductStat["trend"] = "STABLE";
    if (p.unitsSold === 0 && p.prevUnitsSold === 0) trend = "ZERO";
    else if (p.unitsSold > 0 && p.prevUnitsSold === 0) trend = "NEW";
    else if (unitsDelta > 0) trend = "INCREASING";
    else if (unitsDelta < 0) trend = "DECLINING";

    return {
      ...p,
      revenueContributionPct,
      grossProfitPaisa: grossProfit,
      marginPct,
      unitsDelta,
      growthPct,
      trend,
    };
  });

  const soldProducts = products
    .filter((p) => p.unitsSold > 0)
    .sort((a, b) => b.unitsSold - a.unitsSold);

  const fastMovingItems = soldProducts.slice(0, 6);
  const slowMovingItems = [...soldProducts]
    .sort((a, b) => a.unitsSold - b.unitsSold)
    .slice(0, 6);

  const totalCatRev = Array.from(categoryMap.values()).reduce(
    (s, c) => s + c.revenuePaisa,
    0
  );

  const categories: BiCategoryStat[] = Array.from(categoryMap.entries())
    .map(([category, c]) => {
      const gp = c.revenuePaisa - c.cogsPaisa;
      const sortedProds = Array.from(c.productRevenue.entries()).sort(
        (a, b) => b[1] - a[1]
      );
      return {
        category,
        revenuePaisa: c.revenuePaisa,
        unitsSold: c.unitsSold,
        transactionCount: c.txIds.size,
        cogsPaisa: c.cogsPaisa,
        grossProfitPaisa: gp,
        marginPct:
          c.revenuePaisa > 0
            ? Number(((gp / c.revenuePaisa) * 100).toFixed(1))
            : 0,
        revenueSharePct:
          totalCatRev > 0
            ? Number(((c.revenuePaisa / totalCatRev) * 100).toFixed(1))
            : 0,
        productCount: c.productRevenue.size,
        bestProduct: sortedProds[0]?.[0] ?? null,
        worstProduct:
          sortedProds.length > 1
            ? sortedProds[sortedProds.length - 1][0]
            : sortedProds[0]?.[0] ?? null,
      };
    })
    .sort((a, b) => b.revenuePaisa - a.revenuePaisa);

  const highestRevenueCategory = categories[0]?.category ?? null;
  const highestProfitCategory =
    [...categories].sort((a, b) => b.grossProfitPaisa - a.grossProfitPaisa)[0]
      ?.category ?? null;
  const lowestPerformingCategory =
    categories.length > 0
      ? [...categories].sort((a, b) => a.revenuePaisa - b.revenuePaisa)[0]
          ?.category ?? null
      : null;

  const employees: BiEmployeeStat[] = Array.from(employeeAgg.values())
    .map((e) => {
      const catArr = Array.from(e.categoryRevenue.entries())
        .map(([category, revenuePaisa]) => ({ category, revenuePaisa }))
        .sort((a, b) => b.revenuePaisa - a.revenuePaisa);
      return {
        employeeKey: e.employeeKey,
        name: e.name,
        roleLabel: e.roleLabel,
        revenuePaisa: e.revenuePaisa,
        transactionCount: e.transactionCount,
        aovPaisa:
          e.transactionCount > 0
            ? Math.round(e.revenuePaisa / e.transactionCount)
            : 0,
        unitsSold: e.unitsSold,
        refundVoidCount: e.refundVoidCount,
        refundVoidAmountPaisa: e.refundVoidAmountPaisa,
        morningRevenuePaisa: e.morningRevenuePaisa,
        eveningRevenuePaisa: e.eveningRevenuePaisa,
        topCategory: catArr[0]?.category ?? "—",
        categoryRevenue: catArr,
        txIds: e.txIds,
      };
    })
    .sort((a, b) => b.revenuePaisa - a.revenuePaisa);

  shiftMap.MORNING.employees = Array.from(shiftEmployeeSets.MORNING);
  shiftMap.EVENING.employees = Array.from(shiftEmployeeSets.EVENING);
  shiftMap.NIGHT.employees = Array.from(shiftEmployeeSets.NIGHT);

  // Business alerts & insights
  const alerts: BiAlertItem[] = [];

  for (const oos of outOfStockItems.slice(0, 4)) {
    alerts.push({
      id: `oos-${oos.id}`,
      severity: "critical",
      category: "INVENTORY",
      title: `Out of Stock: ${oos.name}`,
      message: `${oos.category} has 0 units left. Suggested restock: ${oos.suggestedReorder} pcs.`,
      metricValue: "0 pcs",
    });
  }

  for (const low of lowStockItems.slice(0, 4)) {
    alerts.push({
      id: `low-${low.id}`,
      severity: "warning",
      category: "INVENTORY",
      title: `Low Stock Alert: ${low.name}`,
      message: `Only ${low.stock} units left (min ${low.minAlert}).`,
      metricValue: `${low.stock} pcs`,
    });
  }

  const zeroSaleProducts = products.filter(
    (p) => p.kind === "PRODUCT" && p.unitsSold === 0 && (p.currentStock ?? 0) > 0
  );
  if (zeroSaleProducts.length > 0) {
    alerts.push({
      id: "zero-sale-summary",
      severity: "warning",
      category: "SALES",
      title: `${zeroSaleProducts.length} Product${zeroSaleProducts.length > 1 ? "s" : ""} With Zero Sales`,
      message: `${zeroSaleProducts
        .slice(0, 3)
        .map((p) => p.name)
        .join(", ")}${zeroSaleProducts.length > 3 ? ", ..." : ""} had 0 units sold in ${range.label}.`,
      metricValue: `${zeroSaleProducts.length} SKUs`,
    });
  }

  const decliningProds = products
    .filter((p) => p.trend === "DECLINING")
    .sort((a, b) => a.unitsDelta - b.unitsDelta);
  if (decliningProds.length > 0) {
    const worstDec = decliningProds[0];
    alerts.push({
      id: `dec-${worstDec.key}`,
      severity: "warning",
      category: "SALES",
      title: `Declining Demand: ${worstDec.name}`,
      message: `Sold ${worstDec.unitsSold} units vs ${worstDec.prevUnitsSold} units in previous period.`,
      metricValue: `${worstDec.unitsDelta} units`,
    });
  }

  const highSalesLowMargin = soldProducts.find(
    (p) => p.unitsSold >= 2 && p.marginPct < 15
  );
  if (highSalesLowMargin) {
    alerts.push({
      id: `margin-${highSalesLowMargin.key}`,
      severity: "warning",
      category: "MARGIN",
      title: `Tight Margin on High-Volume Item: ${highSalesLowMargin.name}`,
      message: `${highSalesLowMargin.unitsSold} units sold at ${highSalesLowMargin.marginPct}% margin.`,
      metricValue: `${highSalesLowMargin.marginPct}%`,
    });
  }

  if (netRevenuePaisa > 0 && totalExpensesAndWagesPaisa > netRevenuePaisa * 0.4) {
    const ratio = Math.round((totalExpensesAndWagesPaisa / netRevenuePaisa) * 100);
    alerts.push({
      id: "high-expense-ratio",
      severity: "critical",
      category: "EXPENSE",
      title: "Elevated Expense-to-Revenue Ratio",
      message: `Expenses and wages represent ${ratio}% of net revenue in ${range.label}.`,
      metricValue: `${ratio}%`,
    });
  }

  const varianceSum = closingHistory
    .filter(
      (c) => c.closingDate >= range.startDate && c.closingDate <= range.endDate
    )
    .reduce((s, c) => s + Math.abs(c.cashDifferencePaisa), 0);
  if (varianceSum > 0) {
    alerts.push({
      id: "cash-discrepancy",
      severity: "critical",
      category: "CASH",
      title: "Cash Drawer Variance Detected",
      message: `Total cash discrepancy across saved closings in ${range.label}.`,
      metricValue: `Rs. ${Math.round(varianceSum / 100).toLocaleString()}`,
    });
  }

  if (employees.length > 0 && employees[0].revenuePaisa > 0) {
    alerts.push({
      id: `top-emp-${employees[0].employeeKey}`,
      severity: "positive",
      category: "EMPLOYEE",
      title: `Top Performing Staff: ${employees[0].name}`,
      message: `${employees[0].transactionCount} bills (${employees[0].unitsSold} units) in ${range.label}.`,
      metricValue: `Rs. ${Math.round(employees[0].revenuePaisa / 100).toLocaleString()}`,
    });
  }

  const revDelta =
    range.period === "lifetime"
      ? null
      : pctChange(netRevenuePaisa, prevNetRevenuePaisa);
  if (revDelta !== null && Math.abs(revDelta) >= 15) {
    alerts.push({
      id: "rev-shift",
      severity: revDelta > 0 ? "positive" : "warning",
      category: "SALES",
      title:
        revDelta > 0
          ? `Significant Revenue Growth (+${revDelta}%)`
          : `Revenue Drop (${revDelta}%) vs Previous Period`,
      message: `Net revenue changed by ${revDelta > 0 ? "+" : ""}${revDelta}% vs prior period.`,
      metricValue: `${revDelta > 0 ? "+" : ""}${revDelta}%`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "healthy-state",
      severity: "info",
      category: "CATEGORY",
      title: "Operations Normal",
      message:
        transactionCount > 0
          ? "No stockouts, margin anomalies, or cash discrepancies detected for this period."
          : "No completed sales recorded in the selected date window yet.",
    });
  }

  return {
    dateRange: range,
    overview: {
      grossBilledPaisa,
      discountsPaisa,
      grossSalesPaisa,
      refundsPaisa,
      refundCount,
      netRevenuePaisa,
      cogsPaisa,
      grossProfitPaisa,
      grossMarginPct,
      operatingExpensesPaisa,
      dailyWagesPaisa,
      totalExpensesAndWagesPaisa,
      netOperatingProfitPaisa,
      netMarginPct,
      transactionCount,
      aovPaisa,
      totalUnitsSold,
      cashPaymentsPaisa,
      digitalPaymentsPaisa,
      paymentBreakdown: Array.from(paymentMethodAgg.entries())
        .map(([method, val]) => ({ method, ...val }))
        .sort((a, b) => b.amountPaisa - a.amountPaisa),
      expectedCashDrawerPaisa,
      openCashSessionCount,
      inventoryCostValuationPaisa,
      inventoryRetailValuationPaisa,
      outstandingReceivablesPaisa,
      outstandingLiabilitiesPaisa,
      prevNetRevenuePaisa,
      prevGrossProfitPaisa,
      prevTransactionCount,
      prevExpensesPaisa: prevTotalExpenses,
      revenueChangePct: revDelta,
      profitChangePct:
        range.period === "lifetime"
          ? null
          : pctChange(grossProfitPaisa, prevGrossProfitPaisa),
      txChangePct:
        range.period === "lifetime"
          ? null
          : pctChange(transactionCount, prevTransactionCount),
      expenseChangePct:
        range.period === "lifetime"
          ? null
          : pctChange(totalExpensesAndWagesPaisa, prevTotalExpenses),
    },
    products,
    categories,
    categoryTrends: Array.from(categoryTrendMap.values()).sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey)
    ),
    highestRevenueCategory,
    highestProfitCategory,
    lowestPerformingCategory,
    dailySeries: Array.from(dailyMap.values()).sort((a, b) =>
      a.key.localeCompare(b.key)
    ),
    weeklySeries: Array.from(weeklyMap.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-12),
    monthlySeries: Array.from(monthlyMap.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-12),
    yearlySeries: Array.from(yearlyMap.values()).sort((a, b) =>
      a.key.localeCompare(b.key)
    ),
    hourlySeries: Array.from(hourlyMap.values()),
    shiftStats: [shiftMap.MORNING, shiftMap.EVENING, shiftMap.NIGHT],
    employees,
    inventory: {
      totalSkus: (rawInventoryItems ?? []).length,
      totalUnitsInStock,
      totalCostValuationPaisa: inventoryCostValuationPaisa,
      totalRetailValuationPaisa: inventoryRetailValuationPaisa,
      potentialProfitPaisa: Math.max(
        0,
        inventoryRetailValuationPaisa - inventoryCostValuationPaisa
      ),
      lowStockItems,
      outOfStockItems,
      fastMovingItems,
      slowMovingItems,
      deadStockItems,
    },
    alerts,
    closingHistory,
    transactions,
  };
}
