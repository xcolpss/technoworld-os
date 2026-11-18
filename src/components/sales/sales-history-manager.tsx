"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertOctagon,
  AlertTriangle,
  Ban,
  Banknote,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Edit3,
  Eye,
  FileText,
  Minus,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Save,
  Search,
  Smartphone,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { formatPkr, pkrToPaisa } from "@/lib/format/currency";
import {
  CompactPrintButton,
  ThermalReceiptSheet,
  ThermalWidthSelector,
  useThermalPaperWidth,
  useThermalReceiptPrint,
  type ThermalReceiptData,
} from "@/components/pos/thermal-receipt";
import type {
  EditableSaleLine,
  UpdateSalePayload,
} from "@/app/(workspace)/sales/actions";
import type { ClosingShiftLabel } from "@/app/(workspace)/dashboard/closing/actions";
import type { UserRole } from "@/types/system";

const CLOSING_SHIFT_LABELS: Record<ClosingShiftLabel, string> = {
  FULL_DAY: "Full Day",
  MORNING: "Morning Shift",
  EVENING: "Evening Shift",
  NIGHT: "Night Shift",
};

export interface SavedClosingRecord {
  id: string;
  closing_date: string;
  shift_label: ClosingShiftLabel;
  replaces_closing_id: string | null;
  status: "SAVED" | "VOIDED";
  morning_cash_paisa: number;
  evening_cash_paisa: number;
  night_cash_paisa: number;
  cash_collected_paisa: number;
  digital_sales_paisa: number;
  gross_sales_paisa: number;
  refunds_paisa: number;
  net_sales_paisa: number;
  total_expenses_paisa: number;
  total_wages_paisa: number;
  expected_closing_paisa: number;
  actual_closing_paisa: number;
  cash_variance_paisa: number;
  expenses_json: Array<Record<string, unknown>>;
  wages_json: Array<Record<string, unknown>>;
  notes: string;
  prepared_by_name: string | null;
  void_reason: string | null;
  voided_by_name: string | null;
  voided_at_iso: string | null;
  created_at_iso: string;
  updated_at_iso: string;
}

export interface CatalogPickerOption {
  id: string;
  kind: "PRODUCT" | "SERVICE";
  code: string;
  name: string;
  price_paisa: number;
  cost_paisa: number;
}

export interface SaleLineRecord {
  id: string;
  kind: "PRODUCT" | "SERVICE";
  product_id: string | null;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price_paisa: number;
  unit_cost_paisa: number;
  line_total_paisa: number;
}

export interface SaleRecord {
  id: string;
  sale_number: string;
  customer_name: string;
  created_at_iso: string;
  date_pk: string;
  time_pk: string;
  subtotal_paisa: number;
  discount_paisa: number;
  total_paisa: number;
  profit_paisa: number;
  payment_method: string;
  status: string;
  was_edited: boolean;
  edit_summary: string | null;
  lines: SaleLineRecord[];
}

interface SalesHistoryManagerProps {
  sales: SaleRecord[];
  closings?: SavedClosingRecord[];
  catalogOptions: CatalogPickerOption[];
  todayPk: string;
  userRole?: UserRole;
  onVoidSale: (saleId: string) => Promise<void>;
  onUpdateSale: (payload: UpdateSalePayload) => Promise<void>;
  onVoidClosing?: (payload: {
    closingId: string;
    closingDate: string;
    shiftLabel: ClosingShiftLabel;
    reason: string;
  }) => Promise<void>;
}

export function SalesHistoryManager({
  sales,
  closings = [],
  catalogOptions,
  todayPk,
  userRole = "OWNER",
  onVoidSale,
  onUpdateSale,
  onVoidClosing,
}: SalesHistoryManagerProps) {
  const [dateScope, setDateScope] = React.useState<"TODAY" | "ALL" | "CUSTOM">(
    "TODAY"
  );
  const [recordTypeFilter, setRecordTypeFilter] = React.useState<
    "ALL" | "SALES" | "CLOSINGS"
  >("ALL");
  const [customDate, setCustomDate] = React.useState(todayPk);
  const [paymentFilter, setPaymentFilter] = React.useState<string>("ALL");
  const [auditFilter, setAuditFilter] = React.useState<
    "ALL" | "FLAGGED" | "VOIDED" | "EDITED"
  >("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [expandedId, setExpandedId] = React.useState<string | null>(
    sales[0]?.id ?? null
  );
  const [reprintSale, setReprintSale] = React.useState<SaleRecord | null>(null);
  const [viewingClosing, setViewingClosing] =
    React.useState<SavedClosingRecord | null>(null);
  const [voidClosingTarget, setVoidClosingTarget] =
    React.useState<SavedClosingRecord | null>(null);
  const [voidClosingReason, setVoidClosingReason] = React.useState("");
  const [voidClosingError, setVoidClosingError] = React.useState<string | null>(
    null
  );
  const [isVoidingClosing, setIsVoidingClosing] = React.useState(false);
  const canVoidClosing = userRole === "OWNER" || userRole === "MANAGER";
  const [paperWidth, setPaperWidth] = useThermalPaperWidth();
  const pendingReprintRef = React.useRef(false);
  const [statusBanner, setStatusBanner] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const thermalReprintData: ThermalReceiptData | null = React.useMemo(() => {
    if (!reprintSale) return null;
    return {
      invoiceRef: `#${reprintSale.sale_number}`,
      dateLabel: `${reprintSale.date_pk} • ${reprintSale.time_pk}`,
      customerName: reprintSale.customer_name,
      items: reprintSale.lines.map((l) => ({
        name: l.description,
        quantity: l.quantity,
        unitPricePaisa: l.unit_price_paisa,
        lineTotalPaisa: l.line_total_paisa,
      })),
      subtotalPaisa: reprintSale.subtotal_paisa,
      discountPaisa: reprintSale.discount_paisa,
      grandTotalPaisa: reprintSale.total_paisa,
      paymentMethod: reprintSale.payment_method,
    };
  }, [reprintSale]);

  const { triggerPrint } = useThermalReceiptPrint(
    thermalReprintData,
    paperWidth
  );

  React.useEffect(() => {
    if (thermalReprintData && pendingReprintRef.current) {
      pendingReprintRef.current = false;
      triggerPrint();
    }
  }, [thermalReprintData, triggerPrint]);

  // --- Bill Editor State ---
  const [editingSaleId, setEditingSaleId] = React.useState<string | null>(null);
  const [editCustomer, setEditCustomer] = React.useState("");
  const [editPayment, setEditPayment] = React.useState<
    "CASH" | "JAZZCASH" | "EASYPAISA" | "BANK_TRANSFER"
  >("CASH");
  const [editDiscountPkr, setEditDiscountPkr] = React.useState("0");
  const [editLines, setEditLines] = React.useState<EditableSaleLine[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = React.useState("");
  const [customLineLabel, setCustomLineLabel] = React.useState("");
  const [customLineQty, setCustomLineQty] = React.useState("1");
  const [customLineRate, setCustomLineRate] = React.useState("20");

  function openBillEditor(sale: SaleRecord) {
    setEditingSaleId(sale.id);
    setExpandedId(sale.id);
    setEditCustomer(
      sale.customer_name === "Walk-in Customer" ? "" : sale.customer_name
    );
    const validPay =
      sale.payment_method === "JAZZCASH" ||
      sale.payment_method === "EASYPAISA" ||
      sale.payment_method === "BANK_TRANSFER"
        ? sale.payment_method
        : "CASH";
    setEditPayment(validPay);
    setEditDiscountPkr(String(Math.round(sale.discount_paisa / 100)));
    setEditLines(
      sale.lines.map((l) => ({
        kind: l.kind === "PRODUCT" ? "PRODUCT" : "SERVICE",
        product_id: l.product_id,
        service_id: l.service_id,
        description: l.description,
        quantity: l.quantity,
        unit_price_paisa: l.unit_price_paisa,
        unit_cost_paisa: l.unit_cost_paisa,
      }))
    );
  }

  function handleAddCatalogLineToEdit() {
    if (!selectedCatalogId) return;
    const opt = catalogOptions.find((o) => o.id === selectedCatalogId);
    if (!opt) return;

    setEditLines((prev) => {
      const idx = prev.findIndex(
        (l) =>
          (opt.kind === "PRODUCT" && l.product_id === opt.id) ||
          (opt.kind === "SERVICE" && l.service_id === opt.id)
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          kind: opt.kind,
          product_id: opt.kind === "PRODUCT" ? opt.id : null,
          service_id: opt.kind === "SERVICE" ? opt.id : null,
          description: opt.name,
          quantity: 1,
          unit_price_paisa: opt.price_paisa,
          unit_cost_paisa: opt.cost_paisa,
        },
      ];
    });
    setSelectedCatalogId("");
  }

  function handleAddCustomLineToEdit() {
    const label = customLineLabel.trim() || "Print / Extra Service";
    const qty = Math.max(1, Math.floor(Number(customLineQty) || 1));
    const ratePaisa = pkrToPaisa(customLineRate);

    setEditLines((prev) => [
      ...prev,
      {
        kind: "SERVICE",
        product_id: null,
        service_id: null,
        description: label,
        quantity: qty,
        unit_price_paisa: ratePaisa,
        unit_cost_paisa: 0,
      },
    ]);
    setCustomLineLabel("");
    setCustomLineQty("1");
    setCustomLineRate("20");
  }

  function saveEditedBill(saleId: string, saleNumber: string) {
    if (editLines.length === 0) {
      alert("A bill must contain at least 1 item. Use Void if cancelling the entire bill.");
      return;
    }

    startTransition(async () => {
      await onUpdateSale({
        saleId,
        customerName: editCustomer,
        paymentMethod: editPayment,
        discountPaisa: pkrToPaisa(editDiscountPkr),
        lines: editLines,
      });
      setEditingSaleId(null);
      setStatusBanner(
        `Bill #${saleNumber} updated! Stock, totals, and audit trail synced.`
      );
    });
  }

  // Date-scoped sales (used for Daily Closing & Fraud Alert counts)
  const dateScopedSales = sales.filter((s) => {
    if (dateScope === "TODAY" && s.date_pk !== todayPk) return false;
    if (dateScope === "CUSTOM" && customDate && s.date_pk !== customDate) {
      return false;
    }
    return true;
  });

  const voidedCount = dateScopedSales.filter((s) =>
    ["VOID", "VOIDED", "CANCELLED"].includes(s.status.toUpperCase())
  ).length;
  const editedCount = dateScopedSales.filter((s) => s.was_edited).length;
  const flaggedCount = dateScopedSales.filter(
    (s) =>
      ["VOID", "VOIDED", "CANCELLED"].includes(s.status.toUpperCase()) ||
      s.was_edited
  ).length;

  // Apply Payment, Audit Flag & Search Filters
  const filteredSales = dateScopedSales.filter((s) => {
    const isVoided = ["VOID", "VOIDED", "CANCELLED"].includes(
      s.status.toUpperCase()
    );
    if (auditFilter === "VOIDED" && !isVoided) return false;
    if (auditFilter === "EDITED" && !s.was_edited) return false;
    if (auditFilter === "FLAGGED" && !isVoided && !s.was_edited) return false;

    if (paymentFilter !== "ALL" && s.payment_method !== paymentFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesBill = s.sale_number.toLowerCase().includes(q);
      const matchesCust = s.customer_name.toLowerCase().includes(q);
      const matchesItem = s.lines.some((l) =>
        l.description.toLowerCase().includes(q)
      );
      if (!matchesBill && !matchesCust && !matchesItem) return false;
    }
    return true;
  });

  // Daily Closing Calculations (excluding voided bills)
  const activeSales = filteredSales.filter(
    (s) => !["VOID", "VOIDED", "CANCELLED"].includes(s.status.toUpperCase())
  );

  const grossRevenuePaisa = activeSales.reduce(
    (sum, s) => sum + s.total_paisa,
    0
  );
  const netProfitPaisa = activeSales.reduce(
    (sum, s) => sum + s.profit_paisa,
    0
  );
  const cashTotalPaisa = activeSales
    .filter((s) => s.payment_method === "CASH")
    .reduce((sum, s) => sum + s.total_paisa, 0);
  const digitalTotalPaisa = activeSales
    .filter((s) => s.payment_method !== "CASH")
    .reduce((sum, s) => sum + s.total_paisa, 0);

  const jazzCashPaisa = activeSales
    .filter((s) => s.payment_method === "JAZZCASH")
    .reduce((sum, s) => sum + s.total_paisa, 0);
  const easyPaisaPaisa = activeSales
    .filter((s) => s.payment_method === "EASYPAISA")
    .reduce((sum, s) => sum + s.total_paisa, 0);
  const bankPaisa = activeSales
    .filter((s) => s.payment_method === "BANK_TRANSFER")
    .reduce((sum, s) => sum + s.total_paisa, 0);

  const activeClosingSlots = React.useMemo(() => {
    const set = new Set<string>();
    for (const c of closings) {
      if (c.status !== "VOIDED") {
        set.add(`${c.closing_date}:${c.shift_label}`);
      }
    }
    return set;
  }, [closings]);

  const dateScopedClosings = closings.filter((c) => {
    if (dateScope === "TODAY" && c.closing_date !== todayPk) return false;
    if (dateScope === "CUSTOM" && customDate && c.closing_date !== customDate) {
      return false;
    }
    return true;
  });

  const filteredClosings = dateScopedClosings.filter((c) => {
    const isVoided = c.status === "VOIDED";
    if (auditFilter === "VOIDED" && !isVoided) return false;
    if (auditFilter === "EDITED" && !c.replaces_closing_id) return false;
    if (auditFilter === "FLAGGED" && !isVoided && !c.replaces_closing_id) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const shiftText = (
        CLOSING_SHIFT_LABELS[c.shift_label] ?? c.shift_label
      ).toLowerCase();
      const matches =
        "daily closing".includes(q) ||
        c.closing_date.toLowerCase().includes(q) ||
        shiftText.includes(q) ||
        c.notes.toLowerCase().includes(q) ||
        (c.prepared_by_name ?? "").toLowerCase().includes(q) ||
        (c.void_reason ?? "").toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  });

  async function handleConfirmVoidClosing(e: React.FormEvent) {
    e.preventDefault();
    if (!voidClosingTarget || !onVoidClosing) return;
    const trimmedReason = voidClosingReason.trim();
    if (!trimmedReason) {
      setVoidClosingError("Please enter a reason for voiding this closing.");
      return;
    }
    setVoidClosingError(null);
    setIsVoidingClosing(true);
    try {
      const target = voidClosingTarget;
      await onVoidClosing({
        closingId: target.id,
        closingDate: target.closing_date,
        shiftLabel: target.shift_label,
        reason: trimmedReason,
      });
      setStatusBanner(
        `Daily Closing for ${target.closing_date} (${CLOSING_SHIFT_LABELS[target.shift_label]}) marked as VOIDED. Original record is preserved; you can create a replacement closing now.`
      );
      if (viewingClosing?.id === target.id) {
        setViewingClosing({
          ...target,
          status: "VOIDED",
          void_reason: trimmedReason,
        });
      }
      setVoidClosingTarget(null);
      setVoidClosingReason("");
    } catch (err) {
      setVoidClosingError(
        err instanceof Error ? err.message : "Failed to void daily closing."
      );
    } finally {
      setIsVoidingClosing(false);
    }
  }

  function triggerThermalReprint(sale: SaleRecord) {
    pendingReprintRef.current = true;
    setReprintSale(sale);
  }

  function handleVoid(sale: SaleRecord) {
    if (
      !window.confirm(
        `Void Bill #${sale.sale_number} (${formatPkr(
          sale.total_paisa
        )})? This will highlight the bill as VOIDED in red and restore stock.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      await onVoidSale(sale.id);
      setStatusBanner(
        `Bill #${sale.sale_number} marked as VOIDED and stock was restored.`
      );
    });
  }

  return (
    <div className="space-y-6">
      {/* Thermal Receipt Reprint Box */}
      {reprintSale && thermalReprintData && (
        <Card className="border-brand/40 bg-brand-soft/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-ink">
                Thermal Receipt Ready • Bill #{reprintSale.sale_number}
              </p>
              <div className="flex items-center gap-2">
                <CompactPrintButton onClick={triggerPrint} label="Print Again" />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setReprintSale(null)}
                >
                  Close Preview
                </Button>
              </div>
            </div>

            <div className="max-w-[302px] mx-auto">
              <ThermalWidthSelector
                value={paperWidth}
                onChange={setPaperWidth}
                itemCount={thermalReprintData.items.length}
                hasDiscount={thermalReprintData.discountPaisa > 0}
              />
            </div>

            <ThermalReceiptSheet
              data={thermalReprintData}
              paperWidth={paperWidth}
            />
          </CardContent>
        </Card>
      )}

      {statusBanner && (
        <div className="flex items-center justify-between rounded-2xl border border-success/30 bg-success-soft px-4 py-3 text-sm font-semibold text-success">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {statusBanner}
          </span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Owner Fraud / Tamper Alert Strip whenever any bill in range is Voided or Edited */}
      {flaggedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-danger/40 bg-danger-soft/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-danger text-white shrink-0">
              <AlertOctagon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-danger">
                Owner Audit Alert: {voidedCount} Voided • {editedCount} Edited Bill
                {flaggedCount === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-ink/80">
                Voided and modified bills stay highlighted below so you can verify every change at closing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={auditFilter === "FLAGGED" ? "primary" : "secondary"}
              onClick={() =>
                setAuditFilter(auditFilter === "FLAGGED" ? "ALL" : "FLAGGED")
              }
            >
              <Eye className="h-3.5 w-3.5" />
              {auditFilter === "FLAGGED"
                ? "Showing Flagged Bills (Show All)"
                : `Inspect Flagged (${flaggedCount})`}
            </Button>
          </div>
        </div>
      )}

      {/* 1. Daily Closing Summary KPI Cards */}
      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted">Total Sales</p>
              <Wallet className="h-4 w-4 text-brand" />
            </div>
            <p className="mt-1 font-mono text-xl font-extrabold text-ink">
              {formatPkr(grossRevenuePaisa)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              {activeSales.length} valid bills
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted">Estimated Profit</p>
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
            <p className="mt-1 font-mono text-xl font-extrabold text-success">
              {formatPkr(netProfitPaisa)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              After product buying cost
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted">Cash Collected</p>
              <Banknote className="h-4 w-4 text-brand" />
            </div>
            <p className="mt-1 font-mono text-xl font-extrabold text-brand-dark">
              {formatPkr(cashTotalPaisa)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              Physical drawer cash
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted">Online / Wallets</p>
              <Smartphone className="h-4 w-4 text-brand" />
            </div>
            <p className="mt-1 font-mono text-xl font-extrabold text-ink">
              {formatPkr(digitalTotalPaisa)}
            </p>
            <p className="mt-0.5 text-[10px] text-muted truncate">
              JC: {formatPkr(jazzCashPaisa)} • EP: {formatPkr(easyPaisaPaisa)} • Bank:{" "}
              {formatPkr(bankPaisa)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 2. Date Range, Audit Status, Payment & Search Filter Bar */}
      <div className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex rounded-xl border border-border bg-warm p-1 w-full sm:w-auto">
            {(
              [
                { id: "TODAY", label: "Today" },
                { id: "ALL", label: "All History" },
                { id: "CUSTOM", label: "Pick Date" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDateScope(tab.id)}
                className={`flex-1 sm:flex-none rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-bold transition ${
                  dateScope === tab.id
                    ? "bg-brand text-white shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {dateScope === "CUSTOM" && (
            <div className="relative w-full sm:w-auto">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <Input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="h-9 pl-8 text-xs w-full sm:w-auto"
              />
            </div>
          )}

          <select
            value={auditFilter}
            onChange={(e) =>
              setAuditFilter(
                e.target.value as "ALL" | "FLAGGED" | "VOIDED" | "EDITED"
              )
            }
            className="h-9 flex-1 sm:flex-none min-w-[130px] rounded-xl border border-border bg-warm px-3 text-xs font-semibold text-ink"
          >
            <option value="ALL">All Bills ({dateScopedSales.length})</option>
            <option value="FLAGGED">Voided &amp; Edited ({flaggedCount})</option>
            <option value="VOIDED">Voided Only ({voidedCount})</option>
            <option value="EDITED">Edited Only ({editedCount})</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="h-9 flex-1 sm:flex-none min-w-[130px] rounded-xl border border-border bg-warm px-3 text-xs font-semibold text-ink"
          >
            <option value="ALL">All Payments</option>
            <option value="CASH">Cash Only</option>
            <option value="JAZZCASH">JazzCash</option>
            <option value="EASYPAISA">EasyPaisa</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>

          <div className="flex rounded-xl border border-border bg-warm p-1">
            {(
              [
                { id: "ALL", label: "All Records" },
                { id: "SALES", label: `Bills (${filteredSales.length})` },
                { id: "CLOSINGS", label: `Closings (${filteredClosings.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRecordTypeFilter(tab.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  recordTypeFilter === tab.id
                    ? "bg-brand text-white shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full sm:w-auto flex-1 min-w-0 sm:min-w-[200px] sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice #, closing, customer, or item..."
            className="h-9 pl-9 text-xs"
          />
        </div>
      </div>

      {/* 2B. Saved Daily Closings (Distinguished from Ordinary Sales Bills) */}
      {recordTypeFilter !== "SALES" &&
        (filteredClosings.length > 0 || recordTypeFilter === "CLOSINGS") && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-indigo-500" />
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-ink">
                  Saved Daily Closings ({filteredClosings.length})
                </h2>
              </div>
              <Link
                href="/dashboard/closing"
                className="text-xs font-bold text-brand hover:underline"
              >
                + Open Daily Closing Sheet
              </Link>
            </div>

            {filteredClosings.length === 0 ? (
              <Card className="border-indigo-500/30 bg-indigo-500/5">
                <CardContent className="p-8 text-center space-y-2">
                  <FileText className="mx-auto h-7 w-7 text-indigo-400" />
                  <p className="text-sm font-bold text-ink">
                    No saved Daily Closings in this date range
                  </p>
                  <p className="text-xs text-muted">
                    Save a closing on the Daily Closing sheet or switch to{" "}
                    <strong>All History</strong> above.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {filteredClosings.map((closing) => {
                  const isVoided = closing.status === "VOIDED";
                  const shiftName =
                    CLOSING_SHIFT_LABELS[closing.shift_label] ??
                    closing.shift_label;
                  const slotHasActiveReplacement = activeClosingSlots.has(
                    `${closing.closing_date}:${closing.shift_label}`
                  );
                  const closingHref = `/dashboard/closing?date=${encodeURIComponent(
                    closing.closing_date
                  )}&shift=${encodeURIComponent(closing.shift_label)}`;

                  return (
                    <Card
                      key={closing.id}
                      className={
                        isVoided
                          ? "border-2 border-danger/50 bg-danger-soft/30"
                          : "border-2 border-indigo-500/35 bg-indigo-500/5"
                      }
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-extrabold uppercase ${
                                  isVoided
                                    ? "bg-danger text-white"
                                    : "bg-indigo-600 text-white"
                                }`}
                              >
                                <ClipboardCheck className="h-3 w-3" />
                                DAILY CLOSING
                              </span>
                              <span
                                className={`font-mono text-sm font-extrabold ${
                                  isVoided
                                    ? "line-through text-danger"
                                    : "text-ink"
                                }`}
                              >
                                {closing.closing_date}
                              </span>
                              <Badge variant="neutral" className="text-[11px]">
                                {shiftName}
                              </Badge>
                              {isVoided ? (
                                <Badge variant="danger">VOIDED</Badge>
                              ) : (
                                <Badge variant="success">SAVED</Badge>
                              )}
                              {closing.replaces_closing_id && (
                                <Badge variant="warning">
                                  REPLACEMENT CLOSING
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted">
                              {closing.prepared_by_name
                                ? `Prepared by ${closing.prepared_by_name}`
                                : "Saved closing report"}
                              {closing.notes ? ` • ${closing.notes}` : ""}
                            </p>
                            {isVoided && (
                              <p className="text-xs font-semibold text-danger">
                                Void Reason:{" "}
                                {closing.void_reason || "Voided for correction"}
                                {closing.voided_by_name
                                  ? ` • Voided by ${closing.voided_by_name}`
                                  : ""}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => setViewingClosing(closing)}
                            >
                              <FileText className="h-3.5 w-3.5" /> View Report
                            </Button>

                            {canVoidClosing &&
                              !isVoided &&
                              onVoidClosing && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="danger"
                                  onClick={() => {
                                    setVoidClosingTarget(closing);
                                    setVoidClosingReason("");
                                    setVoidClosingError(null);
                                  }}
                                >
                                  <Ban className="h-3.5 w-3.5" /> Void Closing
                                </Button>
                              )}

                            {isVoided && !slotHasActiveReplacement && (
                              <Link
                                href={closingHref}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-bold text-white shadow-xs transition hover:opacity-95"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Create Replacement Closing
                              </Link>
                            )}

                            {isVoided && slotHasActiveReplacement && (
                              <Link
                                href={closingHref}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-warm px-3 text-xs font-bold text-ink transition hover:border-brand/50"
                              >
                                Open Replacement
                              </Link>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-border/70 text-xs">
                          <div className="rounded-lg bg-surface/60 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase text-muted">
                              Total Sales (Net)
                            </p>
                            <p
                              className={`font-mono text-sm font-extrabold ${
                                isVoided
                                  ? "line-through text-muted"
                                  : "text-ink"
                              }`}
                            >
                              {formatPkr(closing.net_sales_paisa)}
                            </p>
                          </div>
                          <div className="rounded-lg bg-surface/60 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase text-muted">
                              Cash Collected
                            </p>
                            <p
                              className={`font-mono text-sm font-extrabold ${
                                isVoided
                                  ? "line-through text-muted"
                                  : "text-brand-dark"
                              }`}
                            >
                              {formatPkr(closing.cash_collected_paisa)}
                            </p>
                          </div>
                          <div className="rounded-lg bg-surface/60 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase text-muted">
                              Other Payments
                            </p>
                            <p
                              className={`font-mono text-sm font-extrabold ${
                                isVoided
                                  ? "line-through text-muted"
                                  : "text-ink"
                              }`}
                            >
                              {formatPkr(closing.digital_sales_paisa)}
                            </p>
                          </div>
                          <div className="rounded-lg bg-surface/60 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase text-muted">
                              Actual Cash / Var
                            </p>
                            <p
                              className={`font-mono text-sm font-extrabold ${
                                isVoided
                                  ? "line-through text-muted"
                                  : "text-ink"
                              }`}
                            >
                              {formatPkr(closing.actual_closing_paisa)}{" "}
                              <span className="text-[11px] font-semibold text-muted">
                                ({closing.cash_variance_paisa >= 0 ? "+" : ""}
                                {formatPkr(closing.cash_variance_paisa)})
                              </span>
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

      {/* 3. Past Bills List with Semi-Highlighted Voided/Edited Alerts & Inline Order Editor */}
      {recordTypeFilter === "CLOSINGS" ? null : filteredSales.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <Receipt className="mx-auto h-8 w-8 text-muted" />
            <p className="text-sm font-bold text-ink">
              No bills found for this filter
            </p>
            <p className="text-xs text-muted">
              Switch to <strong>All History</strong> above or record a sale at the POS Counter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSales.map((sale) => {
            const isExpanded = expandedId === sale.id;
            const isEditing = editingSaleId === sale.id;
            const isVoided = ["VOID", "VOIDED", "CANCELLED"].includes(
              sale.status.toUpperCase()
            );

            // Semi-highlighted visual styling so Voided & Edited bills stand out unmistakably
            const cardHighlightClass = isVoided
              ? "border-2 border-danger/50 bg-danger-soft/35"
              : sale.was_edited
              ? "border-2 border-warning/50 bg-warning-soft/25"
              : "hover:border-brand/40";

            const editSubtotalPaisa = editLines.reduce(
              (sum, l) => sum + Math.round(l.quantity * l.unit_price_paisa),
              0
            );
            const editDiscountPaisa = Math.min(
              editSubtotalPaisa,
              pkrToPaisa(editDiscountPkr)
            );
            const editNetTotalPaisa = Math.max(
              0,
              editSubtotalPaisa - editDiscountPaisa
            );

            return (
              <Card
                key={sale.id}
                className={`transition-all ${cardHighlightClass}`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Left: Invoice #, Customer, Audit Badges & Date */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 font-mono text-xs font-extrabold ${
                            isVoided
                              ? "bg-danger text-white"
                              : "bg-brand-soft text-brand-dark"
                          }`}
                        >
                          #{sale.sale_number}
                        </span>
                        <span
                          className={`text-sm font-bold ${
                            isVoided ? "line-through text-danger" : "text-ink"
                          }`}
                        >
                          {sale.customer_name}
                        </span>

                        {isVoided ? (
                          <Badge variant="danger">
                            <AlertOctagon className="mr-1 h-3 w-3" />
                            VOIDED BY STAFF
                          </Badge>
                        ) : (
                          <Badge
                            variant={
                              sale.payment_method === "CASH"
                                ? "success"
                                : "neutral"
                            }
                          >
                            {sale.payment_method}
                          </Badge>
                        )}

                        {sale.was_edited && (
                          <Badge variant="warning">
                            <Edit3 className="mr-1 h-3 w-3" />
                            EDITED BILL
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-muted">
                        {sale.date_pk} at {sale.time_pk} • {sale.lines.length}{" "}
                        {sale.lines.length === 1 ? "item" : "items"}
                        {sale.edit_summary ? ` • ${sale.edit_summary}` : ""}
                      </p>
                    </div>

                    {/* Right: Amount, Profit & Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
                      <div className="text-left sm:text-right mr-1">
                        <p
                          className={`font-mono text-base font-extrabold ${
                            isVoided ? "line-through text-danger" : "text-ink"
                          }`}
                        >
                          {formatPkr(sale.total_paisa)}
                        </p>
                        {!isVoided ? (
                          <p className="font-mono text-[11px] font-semibold text-success">
                            Profit: {formatPkr(sale.profit_paisa)}
                          </p>
                        ) : (
                          <p className="text-[10px] font-bold uppercase text-danger">
                            Excluded from total
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => triggerThermalReprint(sale)}
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Reprint
                        </Button>

                        {!isVoided && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant={isEditing ? "primary" : "secondary"}
                              onClick={() =>
                                isEditing
                                  ? setEditingSaleId(null)
                                  : openBillEditor(sale)
                              }
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              {isEditing ? "Close Edit" : "Edit Bill"}
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={isPending}
                              onClick={() => handleVoid(sale)}
                              className="text-danger hover:bg-danger-soft"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Void
                            </Button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : sale.id)
                          }
                          className="rounded-lg p-1.5 text-muted hover:bg-warm hover:text-ink"
                          title="Toggle Bill Items"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* FULL INLINE BILL EDITOR (Add, Edit or Remove Items/Prints, Customer & Payment) */}
                  {isEditing && (
                    <div className="mt-3 rounded-2xl border-2 border-brand/40 bg-surface p-3.5 sm:p-4 space-y-4">
                      <div className="flex items-center justify-between border-b border-border pb-2.5">
                        <div>
                          <h3 className="font-display text-sm font-extrabold text-ink">
                            Edit Bill #{sale.sale_number}
                          </h3>
                          <p className="text-[11px] text-muted">
                            Add new items/prints, adjust quantities or prices, or remove mistaken lines.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingSaleId(null)}
                          className="rounded-lg p-1 text-muted hover:bg-warm"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Customer & Payment Method */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <Label className="text-[11px]">Customer Name</Label>
                          <Input
                            value={editCustomer}
                            onChange={(e) => setEditCustomer(e.target.value)}
                            placeholder="Walk-in Customer"
                            className="h-9 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px]">Payment Method</Label>
                          <select
                            value={editPayment}
                            onChange={(e) =>
                              setEditPayment(
                                e.target.value as
                                  | "CASH"
                                  | "JAZZCASH"
                                  | "EASYPAISA"
                                  | "BANK_TRANSFER"
                              )
                            }
                            className="h-9 w-full rounded-xl border border-border bg-warm px-3 text-xs font-semibold text-ink"
                          >
                            <option value="CASH">Cash</option>
                            <option value="JAZZCASH">JazzCash</option>
                            <option value="EASYPAISA">EasyPaisa</option>
                            <option value="BANK_TRANSFER">Bank Transfer</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[11px]">Discount (Rs.)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={editDiscountPkr}
                            onChange={(e) => setEditDiscountPkr(e.target.value)}
                            className="h-9 font-mono text-xs"
                          />
                        </div>
                      </div>

                      {/* Current Lines in Bill (Editable Qty, Rate & Remove) */}
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase tracking-wider text-muted">
                          Bill Items ({editLines.length})
                        </Label>
                        {editLines.map((line, idx) => (
                          <div
                            key={idx}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-warm/40 p-2.5"
                          >
                            <div className="w-full sm:w-auto sm:flex-1 sm:min-w-[160px]">
                              <Input
                                value={line.description}
                                onChange={(e) => {
                                  const next = [...editLines];
                                  next[idx] = {
                                    ...next[idx],
                                    description: e.target.value,
                                  };
                                  setEditLines(next);
                                }}
                                className="h-8 text-xs font-bold"
                              />
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...editLines];
                                  if (next[idx].quantity <= 1) {
                                    next.splice(idx, 1);
                                  } else {
                                    next[idx] = {
                                      ...next[idx],
                                      quantity: next[idx].quantity - 1,
                                    };
                                  }
                                  setEditLines(next);
                                }}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-7 text-center font-mono text-xs font-bold">
                                {line.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...editLines];
                                  next[idx] = {
                                    ...next[idx],
                                    quantity: next[idx].quantity + 1,
                                  };
                                  setEditLines(next);
                                }}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>

                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted">@ Rs.</span>
                              <input
                                type="number"
                                min="0"
                                value={Math.round(line.unit_price_paisa / 100)}
                                onChange={(e) => {
                                  const next = [...editLines];
                                  next[idx] = {
                                    ...next[idx],
                                    unit_price_paisa: pkrToPaisa(e.target.value),
                                  };
                                  setEditLines(next);
                                }}
                                className="h-7 w-16 rounded-lg border border-border bg-surface px-1.5 text-right font-mono text-xs font-bold"
                              />
                            </div>

                            <span className="font-mono text-xs font-extrabold sm:w-20 text-right">
                              {formatPkr(line.quantity * line.unit_price_paisa)}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                const next = [...editLines];
                                next.splice(idx, 1);
                                setEditLines(next);
                              }}
                              className="rounded p-1 text-muted hover:bg-danger-soft hover:text-danger"
                              title="Remove Item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add New Product/Service OR Custom Print Line to This Bill */}
                      <div className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-brand/40 bg-brand-soft/20 p-3 sm:grid-cols-2">
                        {/* Add from Catalog */}
                        <div className="space-y-1.5">
                          <Label className="text-[11px]">
                            + Add Product / Service from Catalog
                          </Label>
                          <div className="flex gap-1.5">
                            <select
                              value={selectedCatalogId}
                              onChange={(e) =>
                                setSelectedCatalogId(e.target.value)
                              }
                              className="h-9 flex-1 min-w-0 rounded-xl border border-border bg-surface px-2.5 text-xs font-medium"
                            >
                              <option value="">Choose item...</option>
                              {catalogOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.name} ({formatPkr(opt.price_paisa)})
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              size="sm"
                              
                              onClick={handleAddCatalogLineToEdit}
                            >
                              Add
                            </Button>
                          </div>
                        </div>

                        {/* Add Custom Print / Extra Job */}
                        <div className="space-y-1.5">
                          <Label className="text-[11px]">
                            + Add Extra Print / Custom Job
                          </Label>
                          <div className="flex flex-wrap sm:flex-nowrap gap-1.5">
                            <Input
                              value={customLineLabel}
                              onChange={(e) =>
                                setCustomLineLabel(e.target.value)
                              }
                              placeholder="e.g. Color Print Legal"
                              className="h-9 w-full sm:w-auto sm:flex-1 text-xs"
                            />
                            <Input
                              type="number"
                              min="1"
                              value={customLineQty}
                              onChange={(e) => setCustomLineQty(e.target.value)}
                              placeholder="Qty"
                              className="h-9 flex-1 sm:flex-none sm:w-14 text-xs"
                            />
                            <Input
                              type="number"
                              min="0"
                              value={customLineRate}
                              onChange={(e) =>
                                setCustomLineRate(e.target.value)
                              }
                              placeholder="Rs."
                              className="h-9 flex-1 sm:flex-none sm:w-16 text-xs"
                            />
                            <Button
                              type="button"
                              size="sm"
                              
                              onClick={handleAddCustomLineToEdit}
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Save Updated Bill Footer */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
                        <div className="text-xs">
                          <span className="text-muted">Updated Grand Total: </span>
                          <strong className="font-mono text-base font-extrabold text-brand-dark">
                            {formatPkr(editNetTotalPaisa)}
                          </strong>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingSaleId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isPending}
                            onClick={() =>
                              saveEditedBill(sale.id, sale.sale_number)
                            }
                          >
                            <Save className="h-3.5 w-3.5" />
                            {isPending ? "Saving..." : "Save Updated Bill"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Read-Only Expanded Itemized Breakdown */}
                  {isExpanded && !isEditing && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                      {sale.lines.map((line) => (
                        <div
                          key={line.id}
                          className={`flex items-center justify-between gap-2 text-xs py-1 px-2.5 rounded-lg ${
                            isVoided ? "bg-danger-soft/40" : "bg-warm/50"
                          }`}
                        >
                          <div className="min-w-0">
                            <span
                              className={`font-bold break-words ${
                                isVoided
                                  ? "line-through text-danger"
                                  : "text-ink"
                              }`}
                            >
                              {line.quantity}× {line.description}
                            </span>
                            <span className="ml-1.5 sm:ml-2 font-mono text-[11px] text-muted">
                              (@ {formatPkr(line.unit_price_paisa)})
                            </span>
                          </div>
                          <span
                            className={`font-mono font-bold shrink-0 ${
                              isVoided ? "line-through text-danger" : "text-ink"
                            }`}
                          >
                            {formatPkr(line.line_total_paisa)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Complete Daily Closing Report Modal */}
      {viewingClosing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-indigo-600 px-2 py-0.5 font-mono text-[11px] font-extrabold text-white">
                    DAILY CLOSING REPORT
                  </span>
                  <Badge
                    variant={
                      viewingClosing.status === "VOIDED" ? "danger" : "success"
                    }
                  >
                    {viewingClosing.status}
                  </Badge>
                  {viewingClosing.replaces_closing_id && (
                    <Badge variant="warning">REPLACEMENT</Badge>
                  )}
                </div>
                <h3 className="mt-1.5 font-display text-lg font-extrabold text-ink">
                  {viewingClosing.closing_date} •{" "}
                  {CLOSING_SHIFT_LABELS[viewingClosing.shift_label] ??
                    viewingClosing.shift_label}
                </h3>
                <p className="text-xs text-muted">
                  {viewingClosing.prepared_by_name
                    ? `Prepared by ${viewingClosing.prepared_by_name}`
                    : "Daily reconciliation record"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setViewingClosing(null)}
              >
                <X className="h-4 w-4" /> Close
              </Button>
            </div>

            {viewingClosing.status === "VOIDED" && (
              <div className="rounded-xl border border-danger/40 bg-danger-soft/40 p-3 text-xs text-danger space-y-1">
                <p className="font-extrabold">
                  VOIDED ENTRY — Excluded from Totals &amp; Reports (Audit Preserved)
                </p>
                <p>
                  Reason:{" "}
                  {viewingClosing.void_reason || "Voided for correction"}
                  {viewingClosing.voided_by_name
                    ? ` • Voided by ${viewingClosing.voided_by_name}`
                    : ""}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="rounded-xl border border-border bg-warm/50 p-3">
                <p className="text-[10px] font-bold uppercase text-muted">
                  Gross Sales
                </p>
                <p className="mt-0.5 font-mono text-sm font-extrabold text-ink">
                  {formatPkr(viewingClosing.gross_sales_paisa)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-warm/50 p-3">
                <p className="text-[10px] font-bold uppercase text-muted">
                  Refunds
                </p>
                <p className="mt-0.5 font-mono text-sm font-extrabold text-danger">
                  {formatPkr(viewingClosing.refunds_paisa)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-warm/50 p-3">
                <p className="text-[10px] font-bold uppercase text-muted">
                  Net Sales
                </p>
                <p className="mt-0.5 font-mono text-sm font-extrabold text-brand-dark">
                  {formatPkr(viewingClosing.net_sales_paisa)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-warm/50 p-3">
                <p className="text-[10px] font-bold uppercase text-muted">
                  Other Payments
                </p>
                <p className="mt-0.5 font-mono text-sm font-extrabold text-ink">
                  {formatPkr(viewingClosing.digital_sales_paisa)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-border p-3 space-y-1.5">
                <p className="font-bold uppercase text-[11px] text-muted">
                  Cash Counted by Shift
                </p>
                <div className="flex justify-between">
                  <span>Morning Cash</span>
                  <span className="font-mono font-bold">
                    {formatPkr(viewingClosing.morning_cash_paisa)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Evening Cash</span>
                  <span className="font-mono font-bold">
                    {formatPkr(viewingClosing.evening_cash_paisa)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Night / Other Cash</span>
                  <span className="font-mono font-bold">
                    {formatPkr(viewingClosing.night_cash_paisa)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 font-extrabold">
                  <span>Total Cash Collected</span>
                  <span className="font-mono text-brand-dark">
                    {formatPkr(viewingClosing.cash_collected_paisa)}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-border p-3 space-y-1.5">
                <p className="font-bold uppercase text-[11px] text-muted">
                  Drawer Reconciliation
                </p>
                <div className="flex justify-between">
                  <span>Total Expenses</span>
                  <span className="font-mono font-bold text-danger">
                    {formatPkr(viewingClosing.total_expenses_paisa)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Daily Staff Wages</span>
                  <span className="font-mono font-bold text-amber-500">
                    {formatPkr(viewingClosing.total_wages_paisa)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Expected Closing Cash</span>
                  <span className="font-mono font-bold">
                    {formatPkr(viewingClosing.expected_closing_paisa)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Actual Physical Cash</span>
                  <span className="font-mono font-bold">
                    {formatPkr(viewingClosing.actual_closing_paisa)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 font-extrabold">
                  <span>Cash Variance</span>
                  <span className="font-mono">
                    {viewingClosing.cash_variance_paisa >= 0 ? "+" : ""}
                    {formatPkr(viewingClosing.cash_variance_paisa)}
                  </span>
                </div>
              </div>
            </div>

            {viewingClosing.expenses_json.length > 0 && (
              <div className="rounded-xl border border-border p-3 space-y-1.5 text-xs">
                <p className="font-bold uppercase text-[11px] text-muted">
                  Recorded Expenses ({viewingClosing.expenses_json.length})
                </p>
                {viewingClosing.expenses_json.map((exp, idx) => (
                  <div
                    key={String(exp.id ?? idx)}
                    className="flex justify-between gap-2 py-0.5"
                  >
                    <span>
                      {String(exp.description ?? "Expense")}{" "}
                      <span className="text-muted">
                        ({String(exp.category ?? "General")})
                      </span>
                    </span>
                    <span className="font-mono font-bold">
                      {formatPkr(Number(exp.amountPaisa ?? 0))}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {viewingClosing.wages_json.length > 0 && (
              <div className="rounded-xl border border-border p-3 space-y-1.5 text-xs">
                <p className="font-bold uppercase text-[11px] text-muted">
                  Recorded Daily Wages ({viewingClosing.wages_json.length})
                </p>
                {viewingClosing.wages_json.map((w, idx) => (
                  <div
                    key={String(w.id ?? idx)}
                    className="flex justify-between gap-2 py-0.5"
                  >
                    <span>
                      {String(w.name ?? "Staff")}{" "}
                      <span className="text-muted">
                        ({String(w.role ?? "Staff")})
                      </span>
                    </span>
                    <span className="font-mono font-bold">
                      {formatPkr(Number(w.wagePaisa ?? 0))}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {viewingClosing.notes && (
              <div className="rounded-xl border border-border bg-warm/40 p-3 text-xs">
                <span className="font-bold text-muted">Notes: </span>
                <span>{viewingClosing.notes}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
              <Link
                href={`/dashboard/closing?date=${encodeURIComponent(
                  viewingClosing.closing_date
                )}&shift=${encodeURIComponent(viewingClosing.shift_label)}`}
                className="text-xs font-bold text-brand hover:underline"
              >
                Open in Daily Closing Sheet →
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                {canVoidClosing &&
                  viewingClosing.status !== "VOIDED" &&
                  onVoidClosing && (
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setVoidClosingTarget(viewingClosing);
                        setVoidClosingReason("");
                        setVoidClosingError(null);
                      }}
                    >
                      <Ban className="h-3.5 w-3.5" /> Void Closing
                    </Button>
                  )}
                {viewingClosing.status === "VOIDED" &&
                  !activeClosingSlots.has(
                    `${viewingClosing.closing_date}:${viewingClosing.shift_label}`
                  ) && (
                    <Link
                      href={`/dashboard/closing?date=${encodeURIComponent(
                        viewingClosing.closing_date
                      )}&shift=${encodeURIComponent(viewingClosing.shift_label)}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-bold text-white"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Create Replacement Closing
                    </Link>
                  )}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setViewingClosing(null)}
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Voiding a Saved Daily Closing */}
      {voidClosingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-modal w-full max-w-md rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-danger-soft border border-danger/30 text-danger flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-extrabold text-ink">
                  Void Daily Closing ({voidClosingTarget.closing_date} •{" "}
                  {CLOSING_SHIFT_LABELS[voidClosingTarget.shift_label] ??
                    voidClosingTarget.shift_label}
                  )?
                </h3>
                <p className="text-xs text-muted mt-1">
                  The original closing record will be preserved as{" "}
                  <strong className="text-danger">VOIDED</strong> for audit
                  purposes. POS sales bills, payments, inventory stock, and cash
                  sessions will remain untouched, and you can immediately create
                  a replacement closing.
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmVoidClosing} className="space-y-3">
              <div>
                <Label htmlFor="salesHistoryVoidClosingReason">
                  Reason for Voiding
                </Label>
                <Input
                  id="salesHistoryVoidClosingReason"
                  value={voidClosingReason}
                  onChange={(e) => setVoidClosingReason(e.target.value)}
                  placeholder="e.g. Entered wrong drawer cash or wrong shift"
                  className="mt-1 h-10 text-xs"
                  required
                />
              </div>
              {voidClosingError && (
                <p className="text-xs font-semibold text-danger">
                  {voidClosingError}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isVoidingClosing}
                  onClick={() => {
                    setVoidClosingTarget(null);
                    setVoidClosingReason("");
                    setVoidClosingError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  loading={isVoidingClosing}
                >
                  <Ban className="h-3.5 w-3.5" /> Confirm Void Closing
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}