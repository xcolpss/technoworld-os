import { dbQuery } from "@/lib/db/pool";
import { getOwnerBiDashboardData, resolveBiDateRange } from "@/lib/dashboard/bi-engine";
import { SQL_IS_ACCESSORY_LINE } from "@/lib/workspace/accessories";
import { loadClosingDataForDate } from "@/app/(workspace)/dashboard/closing/actions";
import { normalizeClosingShiftLabel } from "@/lib/closing/shift";
import type { AccountBucket } from "@/app/(workspace)/expenses/actions";
import type {
  PosCategoryRecord,
  PosProductItem,
  PrintPaperRecord,
  MediaCatRecord,
  ComposingServiceRecord,
} from "@/components/pos/pos-counter";
import type {
  CatalogPickerOption,
  SaleLineRecord,
  SaleRecord,
  SavedClosingRecord,
} from "@/components/sales/sales-history-manager";
import type {
  CategoryRecord,
  InventoryItemRecord,
} from "@/components/inventory/inventory-manager";
import type {
  ExpenseRecord,
  MovementRecord,
  OpenDrawerOption,
} from "@/components/expenses/expenses-manager";
import type {
  EmployeeRecord,
  AttendanceRecord,
  LeaveRecord,
} from "@/components/staff/staff-manager";
import type {
  ShiftSessionRecord,
  TerminalOption,
} from "@/components/shifts/shifts-manager";
import type {
  CustomerRecord,
  LedgerEntry,
} from "@/components/customers/customers-manager";

function todayPkStr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeBucket(raw: string | null | undefined): AccountBucket {
  const val = String(raw ?? "").toUpperCase();
  if (val === "EASYPAISA") return "EASYPAISA";
  if (val === "JAZZCASH") return "JAZZCASH";
  if (val === "BANK_TRANSFER" || val === "BANK_WALLET") return "BANK_TRANSFER";
  if (val === "CASH_IN_HAND" || val === "OWNER_CASH") return "CASH_IN_HAND";
  return "CASH_TILL";
}

export async function loadDashboardSectionData(
  businessId: string,
  period?: string,
  start?: string,
  end?: string
) {
  return getOwnerBiDashboardData(businessId, period, start, end);
}

export async function loadClosingSectionData(
  closingDate?: string,
  shiftLabel?: string
) {
  const target = closingDate && /^\d{4}-\d{2}-\d{2}$/.test(closingDate)
    ? closingDate
    : todayPkStr();
  return loadClosingDataForDate(target, shiftLabel);
}

export async function loadPosSectionData(businessId: string) {
  const [
    { rows: rawCats },
    { rows: rawItems },
    { rows: rawPapers },
    { rows: rawMediaCats },
    { rows: rawComposing },
  ] = await Promise.all([
    dbQuery(
      `SELECT id, name FROM public.inventory_categories WHERE business_id = $1 ORDER BY name ASC`,
      [businessId]
    ),
    dbQuery(
      `SELECT id, name, sku, category, retail_price_paisa, cost_price_paisa, stock_quantity, unit
       FROM public.inventory_items WHERE business_id = $1 ORDER BY name ASC`,
      [businessId]
    ),
    dbQuery(
      `SELECT id, name, bw_price_paisa, color_price_paisa
       FROM public.pos_print_papers WHERE business_id = $1 ORDER BY name ASC`,
      [businessId]
    ),
    dbQuery(
      `SELECT id, type, name, default_price_paisa
       FROM public.pos_media_categories WHERE business_id = $1 ORDER BY name ASC`,
      [businessId]
    ),
    dbQuery(
      `SELECT id, name, default_price_paisa
       FROM public.pos_composing_services WHERE business_id = $1 ORDER BY name ASC`,
      [businessId]
    ),
  ]);

  const categories: PosCategoryRecord[] = rawCats.map((c: Record<string, unknown>) => ({
    id: String(c.id),
    name: String(c.name ?? "General"),
  }));

  const products: PosProductItem[] = rawItems.map((i: Record<string, unknown>) => ({
    id: String(i.id),
    name: String(i.name ?? "Product"),
    sku: i.sku ? String(i.sku) : null,
    category: String(i.category ?? "General"),
    retailPricePaisa: Number(i.retail_price_paisa ?? 0),
    costPricePaisa: Number(i.cost_price_paisa ?? 0),
    stockQuantity: Number(i.stock_quantity ?? 0),
    unit: String(i.unit ?? "pcs"),
  }));

  const printPapers: PrintPaperRecord[] = rawPapers.map((p: Record<string, unknown>) => ({
    id: String(p.id),
    name: String(p.name ?? ""),
    bwPricePaisa: Number(p.bw_price_paisa ?? 1000),
    colorPricePaisa: Number(p.color_price_paisa ?? 3000),
  }));

  const mediaCategories: MediaCatRecord[] = rawMediaCats.map((m: Record<string, unknown>) => ({
    id: String(m.id),
    type: String(m.type ?? "MOVIE"),
    name: String(m.name ?? ""),
    defaultPricePaisa: Number(m.default_price_paisa ?? 2000),
  }));

  const composingServices: ComposingServiceRecord[] = rawComposing.map((cs: Record<string, unknown>) => ({
    id: String(cs.id),
    name: String(cs.name ?? ""),
    defaultPricePaisa: Number(cs.default_price_paisa ?? 50000),
  }));

  return {
    categories,
    products,
    printPapers,
    mediaCategories,
    composingServices,
  };
}

export async function loadSalesSectionData(businessId: string, limit = 200) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 20), 500);

  const [salesRes, closingsRes, editLogsRes, productsRes, servicesRes] = await Promise.all([
    dbQuery(
      `SELECT id, receipt_number, customer_name, notes, created_at,
              subtotal_paisa, discount_paisa, total_paisa, status
       FROM public.sales
       WHERE business_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [businessId, safeLimit]
    ),
    dbQuery(
      `SELECT dc.*, COALESCE(NULLIF(dc.prepared_by_name, ''), u.full_name, p.full_name) AS prepared_by_resolved
       FROM public.daily_closings dc
       LEFT JOIN public.auth_users u ON u.id = dc.prepared_by
       LEFT JOIN public.profiles p ON p.id = dc.prepared_by
       WHERE dc.business_id = $1
       ORDER BY dc.closing_date DESC, dc.created_at DESC
       LIMIT 100`,
      [businessId]
    ),
    dbQuery(
      `SELECT metadata
       FROM public.audit_logs
       WHERE business_id = $1 AND action_type = 'SALE_EDITED'
       ORDER BY created_at DESC
       LIMIT 300`,
      [businessId]
    ),
    dbQuery(
      `SELECT id, sku, name, sale_price_paisa, cost_price_paisa
       FROM public.products
       WHERE business_id = $1 AND status = 'ACTIVE'
       ORDER BY name ASC`,
      [businessId]
    ),
    dbQuery(
      `SELECT id, service_code, name, default_price_paisa
       FROM public.services
       WHERE business_id = $1 AND status = 'ACTIVE'
       ORDER BY name ASC`,
      [businessId]
    ),
  ]);

  const rawSales = salesRes.rows;
  const saleIds = rawSales.map((s) => String(s.id));

  // Only fetch items & payments for the visible paginated sales (avoids full-table scan)
  const [itemsRes, paymentsRes] = saleIds.length > 0
    ? await Promise.all([
        dbQuery(
          `SELECT id, sale_id, item_kind, product_id, service_id, description,
                  item_name, quantity, unit_price_paisa, unit_cost_snapshot_paisa,
                  cost_price_paisa, line_total_paisa, total_paisa
           FROM public.sale_items
           WHERE business_id = $1 AND sale_id = ANY($2::uuid[])`,
          [businessId, saleIds]
        ),
        dbQuery(
          `SELECT sale_id, method
           FROM public.payments
           WHERE business_id = $1 AND sale_id = ANY($2::uuid[])`,
          [businessId, saleIds]
        ),
      ])
    : [{ rows: [] }, { rows: [] }];

  const itemsBySale = new Map<string, SaleLineRecord[]>();
  for (const row of itemsRes.rows as Array<Record<string, unknown>>) {
    const saleId = String(row.sale_id);
    const list = itemsBySale.get(saleId) ?? [];
    const kindVal = String(row.item_kind ?? (row.product_id ? "PRODUCT" : "SERVICE"));
    const qty = Math.max(1, Number(row.quantity ?? 1));
    const lineTotal = Number(row.line_total_paisa ?? row.total_paisa ?? 0);
    const unitPrice = Number(row.unit_price_paisa ?? Math.round(lineTotal / qty));
    const unitCost = Number(row.unit_cost_snapshot_paisa ?? row.cost_price_paisa ?? 0);
    list.push({
      id: String(row.id),
      kind: kindVal === "PRODUCT" ? "PRODUCT" : "SERVICE",
      product_id: row.product_id ? String(row.product_id) : null,
      service_id: row.service_id ? String(row.service_id) : null,
      description: String(row.description ?? row.item_name ?? "Item"),
      quantity: qty,
      unit_price_paisa: unitPrice,
      unit_cost_paisa: unitCost,
      line_total_paisa: lineTotal,
    });
    itemsBySale.set(saleId, list);
  }

  const paymentBySale = new Map<string, string>();
  for (const p of paymentsRes.rows as Array<Record<string, unknown>>) {
    paymentBySale.set(String(p.sale_id), String(p.method ?? "CASH"));
  }

  const editInfoBySale = new Map<string, string>();
  for (const log of editLogsRes.rows as Array<Record<string, unknown>>) {
    const meta = (log.metadata ?? {}) as Record<string, unknown>;
    const sid = String(meta.entity_id ?? "");
    if (!sid || editInfoBySale.has(sid)) continue;
    const before = (meta.before_state ?? {}) as Record<string, unknown>;
    const after = (meta.after_state ?? {}) as Record<string, unknown>;
    const oldRs = Math.round(Number(before.total_paisa ?? 0) / 100);
    const newRs = Math.round(Number(after.total_paisa ?? 0) / 100);
    editInfoBySale.set(sid, `Modified (Rs. ${oldRs} → Rs. ${newRs})`);
  }

  const todayPk = todayPkStr();
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFmt = new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const sales: SaleRecord[] = rawSales.map((s: Record<string, unknown>) => {
    const id = String(s.id);
    const lines = itemsBySale.get(id) ?? [];
    const totalPaisa = Number(s.total_paisa ?? 0);
    const totalCostPaisa = lines.reduce(
      (sum, l) => sum + l.quantity * l.unit_cost_paisa,
      0
    );
    const profitPaisa = Math.max(0, totalPaisa - totalCostPaisa);

    const createdAt = s.created_at ? new Date(String(s.created_at)) : new Date();
    let customerName = "Walk-in Customer";
    if (s.customer_name && String(s.customer_name).trim()) {
      customerName = String(s.customer_name).trim();
    } else if (s.notes && String(s.notes).startsWith("Customer:")) {
      customerName = String(s.notes).replace(/^Customer:\s*/i, "").trim();
    }

    return {
      id,
      sale_number: String(s.receipt_number ?? id.slice(0, 8).toUpperCase()),
      customer_name: customerName,
      created_at_iso: createdAt.toISOString(),
      date_pk: dateFmt.format(createdAt),
      time_pk: timeFmt.format(createdAt),
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
  });

  const catalogOptions: CatalogPickerOption[] = [
    ...productsRes.rows.map((p: Record<string, unknown>) => ({
      id: String(p.id),
      kind: "PRODUCT" as const,
      code: String(p.sku ?? ""),
      name: String(p.name ?? ""),
      price_paisa: Number(p.sale_price_paisa ?? 0),
      cost_paisa: Number(p.cost_price_paisa ?? 0),
    })),
    ...servicesRes.rows.map((srv: Record<string, unknown>) => ({
      id: String(srv.id),
      kind: "SERVICE" as const,
      code: String(srv.service_code ?? "SRV"),
      name: String(srv.name ?? ""),
      price_paisa: Number(srv.default_price_paisa ?? 0),
      cost_paisa: 0,
    })),
  ];

  const closings: SavedClosingRecord[] = closingsRes.rows.map(
    (dc: Record<string, unknown>) => {
      const closingDateStr =
        dc.closing_date instanceof Date
          ? dateFmt.format(dc.closing_date)
          : String(dc.closing_date).slice(0, 10);
      const morning = Number(dc.morning_cash_paisa ?? 0);
      const evening = Number(dc.evening_cash_paisa ?? 0);
      const night = Number(dc.night_cash_paisa ?? 0);
      const st = String(dc.status ?? "SUBMITTED").toUpperCase();
      return {
        id: String(dc.id),
        closing_date: closingDateStr,
        shift_label: normalizeClosingShiftLabel(dc.shift_label),
        replaces_closing_id: dc.replaces_closing_id ? String(dc.replaces_closing_id) : null,
        status: st === "VOIDED" ? "VOIDED" : "SAVED",
        morning_cash_paisa: morning,
        evening_cash_paisa: evening,
        night_cash_paisa: night,
        cash_collected_paisa: morning + evening + night,
        digital_sales_paisa: Number(dc.digital_sales_paisa ?? 0),
        gross_sales_paisa: Number(dc.gross_sales_paisa ?? 0),
        refunds_paisa: Number(dc.refunds_paisa ?? 0),
        net_sales_paisa: Number(dc.net_sales_paisa ?? 0),
        total_expenses_paisa: Number(dc.total_expenses_paisa ?? 0),
        total_wages_paisa: Number(dc.total_wages_paisa ?? 0),
        expected_closing_paisa: Number(dc.expected_closing_paisa ?? 0),
        actual_closing_paisa: Number(dc.actual_closing_paisa ?? 0),
        cash_variance_paisa: Number(dc.cash_variance_paisa ?? 0),
        expenses_json: Array.isArray(dc.expenses_json) ? dc.expenses_json : [],
        wages_json: Array.isArray(dc.wages_json) ? dc.wages_json : [],
        notes: dc.notes ? String(dc.notes) : "",
        prepared_by_name: dc.prepared_by_resolved ? String(dc.prepared_by_resolved) : null,
        void_reason: dc.void_reason ? String(dc.void_reason) : null,
        voided_by_name: dc.voided_by_name ? String(dc.voided_by_name) : null,
        voided_at_iso: dc.voided_at ? new Date(String(dc.voided_at)).toISOString() : null,
        created_at_iso: dc.created_at ? new Date(String(dc.created_at)).toISOString() : new Date().toISOString(),
        updated_at_iso: dc.updated_at ? new Date(String(dc.updated_at)).toISOString() : new Date().toISOString(),
      };
    }
  );

  return {
    sales,
    closings,
    catalogOptions,
    todayPk,
  };
}

export async function loadInventorySectionData(businessId: string) {
  const [{ rows: rawCats }, { rows: rawItems }] = await Promise.all([
    dbQuery(
      `SELECT id, name FROM public.inventory_categories WHERE business_id = $1 ORDER BY name ASC`,
      [businessId]
    ),
    dbQuery(
      `SELECT id, name, sku, category, stock_quantity, cost_price_paisa,
              retail_price_paisa, min_stock_alert, unit, notes
       FROM public.inventory_items
       WHERE business_id = $1
       ORDER BY name ASC`,
      [businessId]
    ),
  ]);

  const categories: CategoryRecord[] = rawCats.map((c: Record<string, unknown>) => ({
    id: String(c.id),
    name: String(c.name ?? ""),
  }));

  const items: InventoryItemRecord[] = rawItems.map((i: Record<string, unknown>) => ({
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

  return { categories, items };
}

export async function loadExpensesSectionData(businessId: string) {
  const todayPk = todayPkStr();

  const [
    rawExpensesRes,
    rawMovementsRes,
    openSessionsRes,
    floatSumRes,
    paymentSumsRes,
    expenseSumsRes,
    movementFromSumsRes,
    movementToSumsRes,
  ] = await Promise.all([
    dbQuery(
      `SELECT id, category, description, amount_paisa, payment_source,
              expense_date, notes, created_at
       FROM public.expenses
       WHERE business_id = $1
       ORDER BY created_at DESC
       LIMIT 300`,
      [businessId]
    ),
    dbQuery(
      `SELECT id, movement_kind, from_account, to_account, amount_paisa,
              reason, created_at
       FROM public.account_movements
       WHERE business_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [businessId]
    ),
    dbQuery(
      `SELECT cs.id, cs.expected_closing_paisa,
              t.code AS terminal_code, t.name AS terminal_name
       FROM public.cash_sessions cs
       LEFT JOIN public.terminals t ON t.id = cs.terminal_id
       WHERE cs.business_id = $1 AND cs.status = 'OPEN'
       ORDER BY cs.opened_at ASC`,
      [businessId]
    ),
    dbQuery<{ total_float: string | number }>(
      `SELECT COALESCE(SUM(opening_float_paisa), 0) AS total_float
       FROM public.cash_sessions
       WHERE business_id = $1`,
      [businessId]
    ),
    dbQuery<{ method: string | null; total: string | number }>(
      `SELECT UPPER(COALESCE(p.method, 'CASH')) AS method,
              COALESCE(SUM(p.amount_paisa), 0) AS total
       FROM public.payments p
       JOIN public.sales s ON s.id = p.sale_id
       WHERE p.business_id = $1
         AND UPPER(COALESCE(s.status, '')) NOT IN ('VOID', 'VOIDED', 'CANCELLED')
       GROUP BY UPPER(COALESCE(p.method, 'CASH'))`,
      [businessId]
    ),
    dbQuery<{ payment_source: string | null; total: string | number }>(
      `SELECT payment_source, COALESCE(SUM(amount_paisa), 0) AS total
       FROM public.expenses
       WHERE business_id = $1
       GROUP BY payment_source`,
      [businessId]
    ),
    dbQuery<{ account: string; total: string | number }>(
      `SELECT from_account AS account, COALESCE(SUM(amount_paisa), 0) AS total
       FROM public.account_movements
       WHERE business_id = $1 AND from_account IS NOT NULL
       GROUP BY from_account`,
      [businessId]
    ),
    dbQuery<{ account: string; total: string | number }>(
      `SELECT to_account AS account, COALESCE(SUM(amount_paisa), 0) AS total
       FROM public.account_movements
       WHERE business_id = $1 AND to_account IS NOT NULL
       GROUP BY to_account`,
      [businessId]
    ),
  ]);

  const balances: Record<AccountBucket, number> = {
    CASH_TILL: Number(floatSumRes.rows[0]?.total_float ?? 0),
    CASH_IN_HAND: 0,
    EASYPAISA: 0,
    JAZZCASH: 0,
    BANK_TRANSFER: 0,
  };

  for (const row of paymentSumsRes.rows) {
    const method = String(row.method ?? "CASH").toUpperCase();
    const amt = Number(row.total ?? 0);
    if (method === "EASYPAISA") balances.EASYPAISA += amt;
    else if (method === "JAZZCASH") balances.JAZZCASH += amt;
    else if (method === "BANK_TRANSFER") balances.BANK_TRANSFER += amt;
    else balances.CASH_TILL += amt;
  }

  for (const row of expenseSumsRes.rows) {
    const bucket = normalizeBucket(row.payment_source ?? "CASH_TILL");
    balances[bucket] -= Number(row.total ?? 0);
  }

  for (const row of movementFromSumsRes.rows) {
    balances[normalizeBucket(row.account)] -= Number(row.total ?? 0);
  }

  for (const row of movementToSumsRes.rows) {
    balances[normalizeBucket(row.account)] += Number(row.total ?? 0);
  }

  const openDrawers: OpenDrawerOption[] = openSessionsRes.rows.map(
    (s: Record<string, unknown>) => ({
      id: String(s.id),
      label: `${String(s.terminal_code ?? "PC")} — ${String(s.terminal_name ?? "Counter")}`,
      expected_closing_paisa: Number(s.expected_closing_paisa ?? 0),
    })
  );

  const timeFmt = new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const stampFmt = new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const expenses: ExpenseRecord[] = rawExpensesRes.rows.map(
    (row: Record<string, unknown>) => {
      const created = row.created_at ? new Date(String(row.created_at)) : new Date();
      return {
        id: String(row.id),
        category: String(row.category ?? "Shop Expense"),
        description: String(row.description ?? ""),
        amount_paisa: Number(row.amount_paisa ?? 0),
        payment_source: String(row.payment_source ?? "CASH_TILL"),
        expense_date: String(row.expense_date ?? todayPk).slice(0, 10),
        notes: row.notes ? String(row.notes) : null,
        created_time_pk: timeFmt.format(created),
      };
    }
  );

  const movements: MovementRecord[] = rawMovementsRes.rows.map(
    (row: Record<string, unknown>) => {
      const created = row.created_at ? new Date(String(row.created_at)) : new Date();
      return {
        id: String(row.id),
        movement_kind: String(row.movement_kind) === "ADJUSTMENT" ? "ADJUSTMENT" : "TRANSFER",
        from_account: row.from_account ? String(row.from_account) : null,
        to_account: row.to_account ? String(row.to_account) : null,
        amount_paisa: Number(row.amount_paisa ?? 0),
        reason: String(row.reason ?? ""),
        created_pk: stampFmt.format(created),
      };
    }
  );

  return {
    expenses,
    movements,
    accountBalancesPaisa: balances,
    openDrawers,
    todayPk,
  };
}

export async function loadFinanceSectionData(businessId: string) {
  const [
    accountsRes,
    contributionsRes,
    drawingsRes,
    transfersRes,
    salesAggRes,
    expensesAggRes,
  ] = await Promise.all([
    dbQuery(
      `SELECT id, account_name, account_type, opening_balance_paisa
       FROM public.financial_accounts WHERE business_id = $1`,
      [businessId]
    ),
    dbQuery(
      `SELECT owner_name, contribution_type, amount_paisa,
              COALESCE(contributed_at, created_at) AS contribution_date
       FROM public.owner_contributions WHERE business_id = $1
       ORDER BY COALESCE(contributed_at, created_at) DESC LIMIT 200`,
      [businessId]
    ),
    dbQuery(
      `SELECT owner_name, category, amount_paisa, purpose,
              COALESCE(drawn_at, created_at) AS drawing_date
       FROM public.owner_drawings WHERE business_id = $1
       ORDER BY COALESCE(drawn_at, created_at) DESC LIMIT 200`,
      [businessId]
    ),
    dbQuery(
      `SELECT reference_number, amount_paisa, description,
              COALESCE(transferred_at, created_at) AS transfer_date
       FROM public.account_transfers WHERE business_id = $1
       ORDER BY COALESCE(transferred_at, created_at) DESC LIMIT 200`,
      [businessId]
    ),
    dbQuery<{ gross_sales: string | number; total_discounts: string | number }>(
      `SELECT
         COALESCE(SUM(COALESCE(NULLIF(subtotal_paisa, 0), total_paisa, 0)), 0) AS gross_sales,
         COALESCE(SUM(COALESCE(discount_paisa, 0)), 0) AS total_discounts
       FROM public.sales WHERE business_id = $1`,
      [businessId]
    ),
    dbQuery<{ total_expenses: string | number }>(
      `SELECT COALESCE(SUM(amount_paisa), 0) AS total_expenses
       FROM public.expenses WHERE business_id = $1`,
      [businessId]
    ),
  ]);

  const accounts = accountsRes.rows.map((a) => ({
    id: String(a.id),
    account_name: String(a.account_name ?? ""),
    account_type: String(a.account_type ?? "CASH"),
    opening_balance_paisa: Number(a.opening_balance_paisa ?? 0),
  }));

  const contributions = contributionsRes.rows.map((c) => ({
    owner_name: String(c.owner_name ?? ""),
    contribution_type: String(c.contribution_type ?? "CASH"),
    amount_paisa: Number(c.amount_paisa ?? 0),
    contribution_date: String(c.contribution_date ?? ""),
  }));

  const drawings = drawingsRes.rows.map((d) => ({
    owner_name: String(d.owner_name ?? ""),
    category: String(d.category ?? "OTHER"),
    amount_paisa: Number(d.amount_paisa ?? 0),
    purpose: d.purpose ? String(d.purpose) : null,
    drawing_date: String(d.drawing_date ?? ""),
  }));

  const transfers = transfersRes.rows.map((tr) => ({
    reference_number: tr.reference_number ? String(tr.reference_number) : null,
    amount_paisa: Number(tr.amount_paisa ?? 0),
    description: tr.description ? String(tr.description) : null,
    transfer_date: String(tr.transfer_date ?? ""),
  }));

  const grossSales = Number(salesAggRes.rows[0]?.gross_sales ?? 0);
  const totalDiscounts = Number(salesAggRes.rows[0]?.total_discounts ?? 0);
  const netSales = Math.max(0, grossSales - totalDiscounts);
  const totalOperatingExpenses = Number(expensesAggRes.rows[0]?.total_expenses ?? 0);
  const totalOwnerContributions = contributions.reduce((acc, c) => acc + c.amount_paisa, 0);
  const totalHouseholdDrawings = drawings.reduce((acc, d) => acc + d.amount_paisa, 0);

  const totalCashAccounts = accounts
    .filter((a) => a.account_type === "CASH")
    .reduce((acc, a) => acc + a.opening_balance_paisa, 0);
  const totalBankAccounts = accounts
    .filter((a) => a.account_type === "BANK")
    .reduce((acc, a) => acc + a.opening_balance_paisa, 0);
  const totalDigitalAccounts = accounts
    .filter((a) => a.account_type === "DIGITAL")
    .reduce((acc, a) => acc + a.opening_balance_paisa, 0);
  const totalLiquidity =
    totalCashAccounts +
    totalBankAccounts +
    totalDigitalAccounts +
    totalOwnerContributions -
    totalHouseholdDrawings;

  return {
    accounts,
    contributions,
    drawings,
    transfers,
    summary: {
      grossSales,
      totalDiscounts,
      netSales,
      totalOperatingExpenses,
      totalOwnerContributions,
      totalHouseholdDrawings,
      totalCashAccounts,
      totalBankAccounts,
      totalDigitalAccounts,
      totalLiquidity,
    },
  };
}

export async function loadReportsSectionData(
  businessId: string,
  period?: string,
  start?: string,
  end?: string
) {
  const mappedPeriod =
    period === "daily"
      ? "today"
      : period === "weekly"
      ? "last_7_days"
      : period === "monthly"
      ? "this_month"
      : period || "this_month";

  const range = resolveBiDateRange(mappedPeriod, start, end);
  const isLifetime = range.period === "lifetime";

  const dateFilterSales = isLifetime
    ? ""
    : `AND (timezone('Asia/Karachi', COALESCE(s.posted_at, s.created_at))::date BETWEEN $2::date AND $3::date)`;
  const dateFilterExp = isLifetime
    ? ""
    : `AND (COALESCE(expense_date, timezone('Asia/Karachi', COALESCE(incurred_at, created_at))::date) BETWEEN $2::date AND $3::date)`;

  const rangeParams = isLifetime
    ? [businessId]
    : [businessId, range.startDate, range.endDate];

  const [
    accSalesAgg,
    excludedAgg,
    accCategoryRes,
    invAgg,
    expAgg,
    contribAgg,
    drawAgg,
    accAgg,
  ] = await Promise.all([
    dbQuery<{
      gross_sales: string | number;
      total_discounts: string | number;
      net_sales: string | number;
      total_cogs: string | number;
      units_sold: string | number;
      bill_count: string | number;
    }>(
      `SELECT
         COALESCE(SUM(GREATEST(COALESCE(si.unit_price_paisa, 0) * COALESCE(si.quantity, 1), COALESCE(NULLIF(si.line_total_paisa, 0), si.total_paisa, 0))), 0) AS gross_sales,
         COALESCE(SUM(GREATEST(0, (COALESCE(si.unit_price_paisa, 0) * COALESCE(si.quantity, 1)) - COALESCE(NULLIF(si.line_total_paisa, 0), si.total_paisa, 0))), 0) AS total_discounts,
         COALESCE(SUM(COALESCE(NULLIF(si.line_total_paisa, 0), si.total_paisa, si.unit_price_paisa * si.quantity, 0)), 0) AS net_sales,
         COALESCE(SUM(COALESCE(NULLIF(si.unit_cost_snapshot_paisa, 0), si.cost_price_paisa, 0) * COALESCE(si.quantity, 1)), 0) AS total_cogs,
         COALESCE(SUM(COALESCE(si.quantity, 1)), 0) AS units_sold,
         COUNT(DISTINCT s.id) AS bill_count
       FROM public.sale_items si
       JOIN public.sales s ON s.id = si.sale_id
       WHERE si.business_id = $1
         AND UPPER(COALESCE(s.status, 'POSTED')) NOT IN ('VOID', 'VOIDED', 'CANCELLED', 'REFUNDED')
         AND ${SQL_IS_ACCESSORY_LINE}
         ${dateFilterSales}`,
      rangeParams
    ),
    dbQuery<{
      excluded_sales: string | number;
      excluded_lines: string | number;
    }>(
      `SELECT
         COALESCE(SUM(COALESCE(NULLIF(si.line_total_paisa, 0), si.total_paisa, 0)), 0) AS excluded_sales,
         COUNT(*) AS excluded_lines
       FROM public.sale_items si
       JOIN public.sales s ON s.id = si.sale_id
       WHERE si.business_id = $1
         AND UPPER(COALESCE(s.status, 'POSTED')) NOT IN ('VOID', 'VOIDED', 'CANCELLED', 'REFUNDED')
         AND NOT ${SQL_IS_ACCESSORY_LINE}
         ${dateFilterSales}`,
      rangeParams
    ),
    dbQuery<{
      category: string;
      revenue: string | number;
      cogs: string | number;
      units: string | number;
    }>(
      `SELECT
         COALESCE(NULLIF(TRIM(si.category_name), ''), 'Accessories') AS category,
         COALESCE(SUM(COALESCE(NULLIF(si.line_total_paisa, 0), si.total_paisa, 0)), 0) AS revenue,
         COALESCE(SUM(COALESCE(NULLIF(si.unit_cost_snapshot_paisa, 0), si.cost_price_paisa, 0) * COALESCE(si.quantity, 1)), 0) AS cogs,
         COALESCE(SUM(COALESCE(si.quantity, 1)), 0) AS units
       FROM public.sale_items si
       JOIN public.sales s ON s.id = si.sale_id
       WHERE si.business_id = $1
         AND UPPER(COALESCE(s.status, 'POSTED')) NOT IN ('VOID', 'VOIDED', 'CANCELLED', 'REFUNDED')
         AND ${SQL_IS_ACCESSORY_LINE}
         ${dateFilterSales}
       GROUP BY COALESCE(NULLIF(TRIM(si.category_name), ''), 'Accessories')
       ORDER BY revenue DESC`,
      rangeParams
    ),
    dbQuery<{ inventory_valuation: string | number }>(
      `SELECT COALESCE(SUM(COALESCE(stock_quantity, 0) * COALESCE(cost_price_paisa, 0)), 0) AS inventory_valuation
       FROM public.inventory_items WHERE business_id = $1`,
      [businessId]
    ),
    dbQuery<{ total_expenses: string | number; expense_count: string | number }>(
      `SELECT COALESCE(SUM(amount_paisa), 0) AS total_expenses, COUNT(*) AS expense_count
       FROM public.expenses
       WHERE business_id = $1
         AND LOWER(COALESCE(category, '')) !~ '(movie|media|print|photocopy|compos)'
         ${dateFilterExp}`,
      rangeParams
    ),
    dbQuery<{ total_capital: string | number }>(
      `SELECT COALESCE(SUM(amount_paisa), 0) AS total_capital
       FROM public.owner_contributions WHERE business_id = $1`,
      [businessId]
    ),
    dbQuery<{ total_drawings: string | number }>(
      `SELECT COALESCE(SUM(amount_paisa), 0) AS total_drawings
       FROM public.owner_drawings WHERE business_id = $1`,
      [businessId]
    ),
    dbQuery<{ total_wallets: string | number }>(
      `SELECT COALESCE(SUM(opening_balance_paisa), 0) AS total_wallets
       FROM public.financial_accounts WHERE business_id = $1`,
      [businessId]
    ),
  ]);

  const grossSales = Number(accSalesAgg.rows[0]?.gross_sales ?? 0);
  const totalDiscounts = Number(accSalesAgg.rows[0]?.total_discounts ?? 0);
  const totalRefunds = 0;
  const salesCount = Number(accSalesAgg.rows[0]?.bill_count ?? 0);
  const unitsSold = Number(accSalesAgg.rows[0]?.units_sold ?? 0);
  const netSales = Math.max(0, Number(accSalesAgg.rows[0]?.net_sales ?? 0));

  const cogs = Number(accSalesAgg.rows[0]?.total_cogs ?? 0);
  const grossProfit = netSales - cogs;
  const grossMarginPct =
    netSales > 0 ? Math.round((grossProfit / netSales) * 1000) / 10 : 0;
  const totalOperatingExpenses = Number(expAgg.rows[0]?.total_expenses ?? 0);
  const expenseCount = Number(expAgg.rows[0]?.expense_count ?? 0);
  const netOperatingProfit = grossProfit - totalOperatingExpenses;
  const netMarginPct =
    netSales > 0 ? Math.round((netOperatingProfit / netSales) * 1000) / 10 : 0;

  const totalCashAndWallets = Number(accAgg.rows[0]?.total_wallets ?? 0);
  const inventoryValuation = Number(invAgg.rows[0]?.inventory_valuation ?? 0);
  const totalAssets = totalCashAndWallets + inventoryValuation;
  const totalOwnerCapital = Number(contribAgg.rows[0]?.total_capital ?? 0);
  const totalDrawings = Number(drawAgg.rows[0]?.total_drawings ?? 0);
  const retainedEquity = totalOwnerCapital + netOperatingProfit - totalDrawings;

  return {
    dateRange: {
      period: range.period,
      label: range.label,
      startDate: range.startDate,
      endDate: range.endDate,
      dayCount: range.dayCount,
    },
    accessoriesOnly: true,
    grossSales,
    totalDiscounts,
    totalRefunds,
    salesCount,
    unitsSold,
    netSales,
    cogs,
    grossProfit,
    grossMarginPct,
    totalOperatingExpenses,
    expenseCount,
    netOperatingProfit,
    netMarginPct,
    excludedServiceSales: Number(excludedAgg.rows[0]?.excluded_sales ?? 0),
    excludedServiceLines: Number(excludedAgg.rows[0]?.excluded_lines ?? 0),
    categoryBreakdown: accCategoryRes.rows.map((r) => {
      const rev = Number(r.revenue ?? 0);
      const cost = Number(r.cogs ?? 0);
      return {
        category: String(r.category),
        revenue: rev,
        cogs: cost,
        grossProfit: rev - cost,
        units: Number(r.units ?? 0),
      };
    }),
    totalCashAndWallets,
    inventoryValuation,
    totalAssets,
    totalOwnerCapital,
    totalDrawings,
    retainedEquity,
  };
}

export async function loadEmployeesSectionData(
  businessId: string,
  selectedDate?: string
) {
  const todayStr = todayPkStr();
  const targetDate = selectedDate || todayStr;

  const [empRes, attRes, leavesRes] = await Promise.all([
    dbQuery(
      `SELECT id, employee_number, full_name, phone, designation, department,
              employment_status, assigned_shift_type, salary_type,
              salary_amount_paisa, joining_date
       FROM public.employees
       WHERE business_id = $1
       ORDER BY full_name ASC`,
      [businessId]
    ),
    dbQuery(
      `SELECT employee_id, actual_in, actual_out, shift_window
       FROM public.attendance
       WHERE business_id = $1 AND work_date = $2`,
      [businessId, targetDate]
    ),
    dbQuery(
      `SELECT l.id, l.leave_type, l.start_date, l.end_date, l.reason, l.status,
              e.full_name AS employee_full_name
       FROM public.leaves l
       LEFT JOIN public.employees e ON e.id = l.employee_id
       WHERE l.business_id = $1
       ORDER BY l.created_at DESC
       LIMIT 100`,
      [businessId]
    ),
  ]);

  const attendanceMap = new Map<
    string,
    { actualIn: string | null; actualOut: string | null; shiftWindow: string }
  >();
  const checkedInIds = new Set<string>();

  for (const att of attRes.rows as Array<Record<string, unknown>>) {
    const empId = String(att.employee_id);
    const actualIn = att.actual_in ? String(att.actual_in) : null;
    const actualOut = att.actual_out ? String(att.actual_out) : null;
    const shiftWindow = String(att.shift_window ?? "MORNING");
    attendanceMap.set(empId, { actualIn, actualOut, shiftWindow });
    if (actualIn && !actualOut) {
      checkedInIds.add(empId);
    }
  }

  const employees: EmployeeRecord[] = empRes.rows.map((e: Record<string, unknown>) => {
    const id = String(e.id);
    const att = attendanceMap.get(id);
    return {
      id,
      employee_number: String(e.employee_number ?? "EMP-000"),
      full_name: String(e.full_name ?? ""),
      phone: e.phone ? String(e.phone) : null,
      designation: String(e.designation ?? "Staff"),
      department: e.department ? String(e.department) : null,
      employment_status: String(e.employment_status ?? "ACTIVE"),
      assigned_shift_type: String(e.assigned_shift_type ?? "MORNING"),
      salary_type: String(e.salary_type ?? "MONTHLY"),
      salary_amount_paisa: Number(e.salary_amount_paisa ?? 0),
      joining_date: String(e.joining_date ?? todayStr).slice(0, 10),
      isCheckedInToday: checkedInIds.has(id),
      actualInToday: att?.actualIn ?? null,
      actualOutToday: att?.actualOut ?? null,
    };
  });

  const attendanceRecords: AttendanceRecord[] = empRes.rows.map(
    (e: Record<string, unknown>) => {
      const id = String(e.id);
      const att = attendanceMap.get(id);
      return {
        employeeId: id,
        employeeName: String(e.full_name ?? ""),
        employeeNumber: String(e.employee_number ?? ""),
        designation: String(e.designation ?? ""),
        shiftWindow: att?.shiftWindow || String(e.assigned_shift_type ?? "MORNING"),
        actualIn: att?.actualIn || null,
        actualOut: att?.actualOut || null,
      };
    }
  );

  const leaves: LeaveRecord[] = leavesRes.rows.map((l: Record<string, unknown>) => ({
    id: String(l.id),
    employeeName: String(l.employee_full_name ?? "Staff"),
    leaveType: String(l.leave_type ?? "CASUAL"),
    startDate: String(l.start_date ?? todayStr).slice(0, 10),
    endDate: String(l.end_date ?? todayStr).slice(0, 10),
    reason: String(l.reason ?? ""),
    status: String(l.status ?? "PENDING"),
  }));

  return {
    employees,
    attendanceRecords,
    leaves,
    todayStr,
    selectedDate: targetDate,
  };
}

export async function loadShiftsSectionData(businessId: string) {
  const [termRes, sessRes, salesRes, payRes, expRes] = await Promise.all([
    dbQuery(
      `SELECT id, code, name FROM public.terminals WHERE business_id = $1 ORDER BY code ASC`,
      [businessId]
    ),
    dbQuery(
      `SELECT cs.id, cs.terminal_id, cs.status, cs.opening_float_paisa,
              cs.expected_closing_paisa, cs.actual_closing_paisa, cs.variance_paisa,
              cs.notes, cs.opened_at, cs.closed_at,
              t.code AS terminal_code, t.name AS terminal_name
       FROM public.cash_sessions cs
       LEFT JOIN public.terminals t ON t.id = cs.terminal_id
       WHERE cs.business_id = $1
       ORDER BY cs.opened_at DESC
       LIMIT 100`,
      [businessId]
    ),
    dbQuery(
      `SELECT id, status, created_at FROM public.sales WHERE business_id = $1`,
      [businessId]
    ),
    dbQuery(
      `SELECT sale_id, method, amount_paisa FROM public.payments WHERE business_id = $1`,
      [businessId]
    ),
    dbQuery(
      `SELECT amount_paisa, cash_session_id, created_at
       FROM public.expenses WHERE business_id = $1`,
      [businessId]
    ),
  ]);

  let rawTerminals = termRes.rows;
  if (rawTerminals.length === 0) {
    const createdRes = await dbQuery(
      `INSERT INTO public.terminals (business_id, code, name, status)
       VALUES ($1, 'PC-01', 'Main Counter', 'ACTIVE')
       RETURNING id, code, name`,
      [businessId]
    );
    if (createdRes.rows[0]) {
      rawTerminals = [createdRes.rows[0]];
    }
  }

  const terminals: TerminalOption[] = rawTerminals.map((t: Record<string, unknown>) => ({
    id: String(t.id),
    code: String(t.code ?? "PC"),
    name: String(t.name ?? "Counter"),
  }));

  // O(N) lookup map instead of nested .find() inside cash session loop
  const saleDateById = new Map<string, Date>();
  for (const s of salesRes.rows as Array<Record<string, unknown>>) {
    const st = String(s.status ?? "").toUpperCase();
    if (!["VOID", "VOIDED", "CANCELLED"].includes(st) && s.created_at) {
      saleDateById.set(String(s.id), new Date(String(s.created_at)));
    }
  }

  const paymentsWithDates: Array<{ saleDate: Date; method: string; amount: number }> = [];
  for (const p of payRes.rows as Array<Record<string, unknown>>) {
    const saleDate = saleDateById.get(String(p.sale_id));
    if (!saleDate) continue;
    paymentsWithDates.push({
      saleDate,
      method: String(p.method ?? "CASH").toUpperCase(),
      amount: Number(p.amount_paisa ?? 0),
    });
  }

  const parsedExpenses = expRes.rows.map((exp: Record<string, unknown>) => ({
    sessionId: exp.cash_session_id ? String(exp.cash_session_id) : null,
    expDate: exp.created_at ? new Date(String(exp.created_at)) : new Date(),
    amount: Number(exp.amount_paisa ?? 0),
  }));

  const stampFmt = new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const sessions: ShiftSessionRecord[] = sessRes.rows.map(
    (s: Record<string, unknown>) => {
      const sessionId = String(s.id);
      const openedAt = s.opened_at ? new Date(String(s.opened_at)) : new Date();
      const closedAt = s.closed_at ? new Date(String(s.closed_at)) : null;

      let cashSales = 0;
      let jazzCash = 0;
      let easyPaisa = 0;
      let bank = 0;

      for (const pay of paymentsWithDates) {
        if (pay.saleDate >= openedAt && (closedAt === null || pay.saleDate <= closedAt)) {
          if (pay.method === "JAZZCASH") jazzCash += pay.amount;
          else if (pay.method === "EASYPAISA") easyPaisa += pay.amount;
          else if (pay.method === "BANK_TRANSFER") bank += pay.amount;
          else cashSales += pay.amount;
        }
      }

      let shiftExpenses = 0;
      for (const exp of parsedExpenses) {
        if (
          exp.sessionId === sessionId ||
          (exp.sessionId === null &&
            exp.expDate >= openedAt &&
            (closedAt === null || exp.expDate <= closedAt))
        ) {
          shiftExpenses += exp.amount;
        }
      }

      return {
        id: sessionId,
        terminal_id: String(s.terminal_id),
        terminal_code: String(s.terminal_code ?? "PC-01"),
        terminal_name: String(s.terminal_name ?? "Counter"),
        status: String(s.status ?? "OPEN") as "OPEN" | "CLOSED",
        opening_float_paisa: Number(s.opening_float_paisa ?? 0),
        expected_closing_paisa: Number(s.expected_closing_paisa ?? 0),
        actual_closing_paisa: Number(s.actual_closing_paisa ?? 0),
        variance_paisa: Number(s.variance_paisa ?? 0),
        notes: s.notes ? String(s.notes) : null,
        opened_pk: stampFmt.format(openedAt),
        closed_pk: closedAt ? stampFmt.format(closedAt) : null,
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

  return { terminals, sessions };
}

export async function loadCustomersSectionData(businessId: string) {
  const [custRes, ledgerRes] = await Promise.all([
    dbQuery(
      `SELECT id, name, full_name, phone, address, customer_type,
              credit_limit_paisa, notes
       FROM public.customers
       WHERE business_id = $1
       ORDER BY COALESCE(name, full_name) ASC`,
      [businessId]
    ),
    dbQuery(
      `SELECT id, customer_id, entry_type, amount_paisa, payment_method,
              notes, created_at
       FROM public.customer_ledger
       WHERE business_id = $1
       ORDER BY created_at DESC`,
      [businessId]
    ),
  ]);

  const stampFmt = new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const ledgerByCust = new Map<string, LedgerEntry[]>();
  const totalsByCust = new Map<string, { credit: number; repaid: number }>();

  for (const entry of ledgerRes.rows as Array<Record<string, unknown>>) {
    const cid = String(entry.customer_id);
    const list = ledgerByCust.get(cid) ?? [];
    const typeVal = String(entry.entry_type) as "CREDIT_SALE" | "REPAYMENT" | "ADJUSTMENT";
    const amt = Number(entry.amount_paisa ?? 0);
    const created = entry.created_at ? new Date(String(entry.created_at)) : new Date();

    list.push({
      id: String(entry.id),
      entry_type: typeVal,
      amount_paisa: amt,
      payment_method: entry.payment_method ? String(entry.payment_method) : null,
      notes: entry.notes ? String(entry.notes) : null,
      created_pk: stampFmt.format(created),
    });
    ledgerByCust.set(cid, list);

    const cur = totalsByCust.get(cid) ?? { credit: 0, repaid: 0 };
    if (typeVal === "CREDIT_SALE") cur.credit += amt;
    else if (typeVal === "REPAYMENT") cur.repaid += amt;
    totalsByCust.set(cid, cur);
  }

  const customers: CustomerRecord[] = custRes.rows.map(
    (c: Record<string, unknown>) => {
      const id = String(c.id);
      const stats = totalsByCust.get(id) ?? { credit: 0, repaid: 0 };
      const udhaar = Math.max(0, stats.credit - stats.repaid);

      return {
        id,
        name: String(c.name ?? c.full_name ?? ""),
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

  return { customers };
}

export async function loadAuditSectionData(businessId: string, limit = 100) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 20), 300);
  const { rows: logs } = await dbQuery<{
    id: string;
    actor_name: string | null;
    action_type: string | null;
    description: string | null;
    created_at: string;
  }>(
    `SELECT id, actor_name, action_type, description, created_at
     FROM public.audit_logs
     WHERE business_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [businessId, safeLimit]
  );

  return { logs };
}
