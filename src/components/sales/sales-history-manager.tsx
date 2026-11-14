"use client";

import * as React from "react";
import {
  AlertOctagon,
  Ban,
  Banknote,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  Minus,
  Plus,
  Printer,
  Receipt,
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
import type {
  EditableSaleLine,
  UpdateSalePayload,
} from "@/app/(workspace)/sales-history/actions";

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
  catalogOptions: CatalogPickerOption[];
  todayPk: string;
  onVoidSale: (saleId: string) => Promise<void>;
  onUpdateSale: (payload: UpdateSalePayload) => Promise<void>;
}

export function SalesHistoryManager({
  sales,
  catalogOptions,
  todayPk,
  onVoidSale,
  onUpdateSale,
}: SalesHistoryManagerProps) {
  const [dateScope, setDateScope] = React.useState<"TODAY" | "ALL" | "CUSTOM">(
    "TODAY"
  );
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
  const [statusBanner, setStatusBanner] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

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

  function triggerThermalReprint(sale: SaleRecord) {
    setReprintSale(sale);
    window.setTimeout(() => {
      window.print();
    }, 200);
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
      {/* Edge-to-Edge 72mm Thermal Print CSS */}
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0mm;
          }
          html,
          body {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #thermal-reprint-sheet,
          #thermal-reprint-sheet * {
            visibility: visible !important;
          }
          #thermal-reprint-sheet {
            position: fixed !important;
            left: 0 !important;
            right: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            padding: 2mm 1mm 5mm 1mm !important;
            margin: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: "Segoe UI", Arial, Helvetica, sans-serif !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>

      {/* Thermal Receipt Reprint Box */}
      {reprintSale && (
        <Card className="border-brand/40 bg-brand-soft/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-ink">
                Thermal Receipt Ready â€¢ Bill #{reprintSale.sale_number}
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  Print Again
                </Button>
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

            <div
              id="thermal-reprint-sheet"
              className="mx-auto w-full max-w-[340px] rounded-xl border border-border bg-white p-4 text-black shadow-sm"
            >
              <div className="text-center border-b-2 border-black pb-2.5">
                <div className="mx-auto mb-1.5 flex items-center justify-center">
                  <svg
                    width="156"
                    height="38"
                    viewBox="0 0 156 38"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mx-auto"
                  >
                    <rect
                      x="1"
                      y="1"
                      width="36"
                      height="36"
                      rx="7"
                      fill="#000000"
                    />
                    <path
                      d="M8 12H20V15.5H15.8V27H12.2V15.5H8V12ZM20.5 12H24L25.6 21.2L27.6 12H30.4L32.4 21.2L34 12H37.5L34.2 27H30.9L29 18.2L27.1 27H23.8L20.5 12Z"
                      fill="#FFFFFF"
                    />
                    <text
                      x="44"
                      y="17"
                      fill="#000000"
                      fontFamily="Arial, Helvetica, sans-serif"
                      fontWeight="900"
                      fontSize="14"
                      letterSpacing="0.5"
                    >
                      TECHNO
                    </text>
                    <text
                      x="44"
                      y="32"
                      fill="#000000"
                      fontFamily="Arial, Helvetica, sans-serif"
                      fontWeight="900"
                      fontSize="14"
                      letterSpacing="1.2"
                    >
                      WORLD
                    </text>
                  </svg>
                </div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-black">
                  Computers â€¢ Printing â€¢ Accessories
                </p>
                <p className="text-[10px] font-semibold text-black mt-0.5">
                  Rawalpindi â€¢ Sales &amp; Digital Services
                </p>
              </div>

              <div className="py-2 border-b-2 border-black text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="font-bold">INVOICE:</span>
                  <span className="font-mono font-extrabold">
                    #{reprintSale.sale_number}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">DATE:</span>
                  <span className="font-mono font-semibold">
                    {reprintSale.date_pk} â€¢ {reprintSale.time_pk}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">CUSTOMER:</span>
                  <span className="font-extrabold uppercase">
                    {reprintSale.customer_name}
                  </span>
                </div>
              </div>

              <div className="flex justify-between border-b border-black py-1.5 text-[11px] font-black uppercase">
                <span>Description</span>
                <span>Total</span>
              </div>

              <div className="divide-y divide-dashed divide-black border-b-2 border-black">
                {reprintSale.lines.map((l) => (
                  <div key={l.id} className="py-1.5">
                    <div className="flex justify-between items-start gap-2 text-[12px]">
                      <span className="font-extrabold leading-tight flex-1">
                        {l.description}
                      </span>
                      <span className="font-mono font-black whitespace-nowrap">
                        {formatPkr(l.line_total_paisa)}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono font-semibold mt-0.5">
                      Qty: {l.quantity} Ã— {formatPkr(l.unit_price_paisa)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="py-2 space-y-1 text-[12px]">
                <div className="flex justify-between font-semibold">
                  <span>Subtotal</span>
                  <span className="font-mono font-bold">
                    {formatPkr(reprintSale.subtotal_paisa)}
                  </span>
                </div>
                {reprintSale.discount_paisa > 0 && (
                  <div className="flex justify-between font-semibold">
                    <span>Discount</span>
                    <span className="font-mono font-bold">
                      -{formatPkr(reprintSale.discount_paisa)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center border-y-2 border-black py-1.5 my-1.5 text-[14px] font-black">
                  <span>GRAND TOTAL</span>
                  <span className="font-mono text-[16px]">
                    {formatPkr(reprintSale.total_paisa)}
                  </span>
                </div>

                <div className="flex justify-between text-[11px] font-bold">
                  <span>PAYMENT METHOD</span>
                  <span className="uppercase">{reprintSale.payment_method}</span>
                </div>
              </div>

              <div className="border-t-2 border-black pt-2 text-center space-y-0.5">
                <p className="text-[11px] font-black uppercase tracking-wide">
                  Thank You For Visiting Techno World!
                </p>
                <p className="text-[10px] font-semibold">
                  Goods once sold are exchangeable within 3 days with receipt
                </p>
              </div>
            </div>
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
                Owner Audit Alert: {voidedCount} Voided â€¢ {editedCount} Edited Bill
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
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
              JC: {formatPkr(jazzCashPaisa)} â€¢ EP: {formatPkr(easyPaisaPaisa)} â€¢ Bank:{" "}
              {formatPkr(bankPaisa)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 2. Date Range, Audit Status, Payment & Search Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-border bg-warm p-1">
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
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
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
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <Input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="h-9 pl-8 text-xs"
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
            className="h-9 rounded-xl border border-border bg-warm px-3 text-xs font-semibold text-ink"
          >
            <option value="ALL">All Bills ({dateScopedSales.length})</option>
            <option value="FLAGGED">Voided &amp; Edited ({flaggedCount})</option>
            <option value="VOIDED">Voided Only ({voidedCount})</option>
            <option value="EDITED">Edited Only ({editedCount})</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="h-9 rounded-xl border border-border bg-warm px-3 text-xs font-semibold text-ink"
          >
            <option value="ALL">All Payments</option>
            <option value="CASH">Cash Only</option>
            <option value="JAZZCASH">JazzCash</option>
            <option value="EASYPAISA">EasyPaisa</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>
        </div>

        <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice #, customer, or item..."
            className="h-9 pl-9 text-xs"
          />
        </div>
      </div>

      {/* 3. Past Bills List with Semi-Highlighted Voided/Edited Alerts & Inline Order Editor */}
      {filteredSales.length === 0 ? (
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
                        {sale.date_pk} at {sale.time_pk} â€¢ {sale.lines.length}{" "}
                        {sale.lines.length === 1 ? "item" : "items"}
                        {sale.edit_summary ? ` â€¢ ${sale.edit_summary}` : ""}
                      </p>
                    </div>

                    {/* Right: Amount, Profit & Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-right mr-1">
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

                      <Button
                        type="button"
                        size="sm"
                        
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

                  {/* FULL INLINE BILL EDITOR (Add, Edit or Remove Items/Prints, Customer & Payment) */}
                  {isEditing && (
                    <div className="mt-3 rounded-2xl border-2 border-brand/40 bg-surface p-4 space-y-4">
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
                            <div className="flex-1 min-w-[160px]">
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

                            <span className="font-mono text-xs font-extrabold w-20 text-right">
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
                              className="h-9 flex-1 rounded-xl border border-border bg-surface px-2.5 text-xs font-medium"
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
                          <div className="flex gap-1.5">
                            <Input
                              value={customLineLabel}
                              onChange={(e) =>
                                setCustomLineLabel(e.target.value)
                              }
                              placeholder="e.g. Color Print Legal"
                              className="h-9 flex-1 text-xs"
                            />
                            <Input
                              type="number"
                              min="1"
                              value={customLineQty}
                              onChange={(e) => setCustomLineQty(e.target.value)}
                              placeholder="Qty"
                              className="h-9 w-14 text-xs"
                            />
                            <Input
                              type="number"
                              min="0"
                              value={customLineRate}
                              onChange={(e) =>
                                setCustomLineRate(e.target.value)
                              }
                              placeholder="Rs."
                              className="h-9 w-16 text-xs"
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
                        <div className="flex items-center gap-2">
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
                          className={`flex items-center justify-between text-xs py-1 px-2.5 rounded-lg ${
                            isVoided ? "bg-danger-soft/40" : "bg-warm/50"
                          }`}
                        >
                          <div>
                            <span
                              className={`font-bold ${
                                isVoided
                                  ? "line-through text-danger"
                                  : "text-ink"
                              }`}
                            >
                              {line.quantity}Ã— {line.description}
                            </span>
                            <span className="ml-2 font-mono text-[11px] text-muted">
                              (@ {formatPkr(line.unit_price_paisa)})
                            </span>
                          </div>
                          <span
                            className={`font-mono font-bold ${
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
    </div>
  );
}