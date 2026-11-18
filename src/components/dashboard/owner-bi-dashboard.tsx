"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpDown,
  ArrowUpRight,
  Award,
  BarChart3,
  Boxes,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileSpreadsheet,
  Info,
  Layers,
  PackageCheck,
  PieChart,
  Printer,
  Search,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SectionRefreshButton } from "@/components/ui/section-refresh-button";
import { formatPkr } from "@/lib/format/currency";
import { downloadCsvFile, downloadXlsxWorkbook } from "@/lib/export/xlsx";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchWorkspaceRoute } from "@/lib/workspace/prefetch";
import type {
  BiPeriodKey,
  BiProductStat,
  BiTimePoint,
  OwnerBiPayload,
  TxInspectItem,
} from "@/lib/dashboard/bi-engine";
import type { UserRole } from "@/types/system";

type BiTabKey =
  | "overview"
  | "products"
  | "categories"
  | "charts"
  | "employees"
  | "inventory"
  | "financials";

type ProductRankingMode =
  | "best_units"
  | "worst_units"
  | "highest_revenue"
  | "lowest_revenue"
  | "most_profitable"
  | "least_profitable"
  | "zero_sale"
  | "declining"
  | "increasing";

type ChartSeriesMode =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "hourly"
  | "rev_vs_exp"
  | "gross_vs_net"
  | "cash_vs_digital";

type ProductSortKey =
  | "default"
  | "units"
  | "lowest_sales"
  | "revenue"
  | "profit"
  | "margin"
  | "growth";

interface OwnerBiDashboardProps {
  data: OwnerBiPayload;
  userRole: UserRole;
  businessName: string;
  onPeriodChange?: (period: BiPeriodKey, start?: string, end?: string) => void;
  onPrefetchPeriod?: (period: BiPeriodKey) => void;
  onForceRefresh?: () => void | Promise<unknown>;
  isRefreshing?: boolean;
  lastUpdatedAt?: number;
}

const PERIOD_OPTIONS: Array<{ key: BiPeriodKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last_7_days", label: "7 Days" },
  { key: "last_30_days", label: "30 Days" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Previous Month" },
  { key: "this_year", label: "This Year" },
  { key: "lifetime", label: "Lifetime" },
  { key: "custom", label: "Custom" },
];

const PRODUCT_RANKINGS: Array<{ key: ProductRankingMode; label: string }> = [
  { key: "best_units", label: "Best-Selling (Units)" },
  { key: "worst_units", label: "Worst-Selling (Units)" },
  { key: "highest_revenue", label: "Highest Revenue" },
  { key: "lowest_revenue", label: "Lowest Revenue" },
  { key: "most_profitable", label: "Most Profitable" },
  { key: "least_profitable", label: "Least Profitable" },
  { key: "zero_sale", label: "Zero-Sale Products" },
  { key: "declining", label: "Declining Demand" },
  { key: "increasing", label: "Increasing Demand" },
];

const CATEGORY_COLORS = [
  "#FF6A00",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#F59E0B",
  "#EC4899",
  "#06B6D4",
  "#6366F1",
];

function DeltaBadge({
  delta,
  inverseGood = false,
}: {
  delta: number | null;
  inverseGood?: boolean;
}) {
  if (delta === null) {
    return (
      <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">
        No prior baseline
      </span>
    );
  }
  const positive = delta >= 0;
  const isGood = inverseGood ? !positive : positive;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
        isGood ? "text-[var(--success)]" : "text-rose-500"
      }`}
    >
      {positive ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {positive ? "+" : ""}
      {delta}% vs prev period
    </span>
  );
}

export function OwnerBiDashboard({
  data,
  userRole,
  businessName,
  onPeriodChange,
  onPrefetchPeriod,
  onForceRefresh,
  isRefreshing = false,
  lastUpdatedAt,
}: OwnerBiDashboardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canViewProfitMargins = userRole === "OWNER" || userRole === "MANAGER";

  const [activeTab, setActiveTab] = React.useState<BiTabKey>("overview");
  const [customStart, setCustomStart] = React.useState(data.dateRange.startDate);
  const [customEnd, setCustomEnd] = React.useState(data.dateRange.endDate);
  const [showCustomDates, setShowCustomDates] = React.useState(
    data.dateRange.period === "custom"
  );

  // Product ranking state
  const [rankingMode, setRankingMode] =
    React.useState<ProductRankingMode>("best_units");
  const [productSortKey, setProductSortKey] =
    React.useState<ProductSortKey>("default");
  const [sortAsc, setSortAsc] = React.useState(false);
  const [productSearch, setProductSearch] = React.useState("");

  // Chart state
  const [chartMode, setChartMode] = React.useState<ChartSeriesMode>("daily");

  // Transaction inspector modal/drawer state
  const [inspectedTitle, setInspectedTitle] = React.useState<string | null>(
    null
  );
  const [inspectedTxIds, setInspectedTxIds] = React.useState<string[] | null>(
    null
  );

  const txMap = React.useMemo(() => {
    const map = new Map<string, TxInspectItem>();
    for (const tx of data.transactions) {
      map.set(tx.id, tx);
    }
    return map;
  }, [data.transactions]);

  const inspectedTransactions = React.useMemo(() => {
    if (!inspectedTxIds) return [];
    return inspectedTxIds
      .map((id) => txMap.get(id))
      .filter((t): t is TxInspectItem => Boolean(t));
  }, [inspectedTxIds, txMap]);

  const openInspector = (title: string, txIds: string[]) => {
    setInspectedTitle(title);
    setInspectedTxIds(txIds);
  };

  const handleSelectPeriod = (key: BiPeriodKey) => {
    if (key === "custom") {
      setShowCustomDates(true);
      return;
    }
    setShowCustomDates(false);
    if (onPeriodChange) {
      onPeriodChange(key);
    } else {
      router.push(`/dashboard?period=${key}`);
    }
  };

  const handleApplyCustomDates = (e: React.FormEvent) => {
    e.preventDefault();
    if (onPeriodChange) {
      onPeriodChange("custom", customStart, customEnd);
    } else {
      router.push(
        `/dashboard?period=custom&start=${encodeURIComponent(
          customStart
        )}&end=${encodeURIComponent(customEnd)}`
      );
    }
  };

  // Product ranking computation
  const rankedProducts = React.useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    let list: BiProductStat[] = [...data.products];

    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    if (rankingMode === "zero_sale") {
      list = list.filter((p) => p.unitsSold === 0);
    } else if (rankingMode === "declining") {
      list = list.filter((p) => p.unitsDelta < 0);
    } else if (rankingMode === "increasing") {
      list = list.filter((p) => p.unitsDelta > 0);
    } else if (
      rankingMode === "worst_units" ||
      rankingMode === "lowest_revenue" ||
      rankingMode === "least_profitable"
    ) {
      // Keep active/sold products prominent when evaluating worst performers, unless none sold
      const soldOnly = list.filter((p) => p.unitsSold > 0);
      if (soldOnly.length > 0) list = soldOnly;
    }

    const dir = sortAsc ? 1 : -1;
    list.sort((a, b) => {
      if (productSortKey !== "default") {
        switch (productSortKey) {
          case "units":
            return (a.unitsSold - b.unitsSold) * dir;
          case "lowest_sales":
            return (b.unitsSold - a.unitsSold) * dir;
          case "revenue":
            return (a.revenuePaisa - b.revenuePaisa) * dir;
          case "profit":
            return (a.grossProfitPaisa - b.grossProfitPaisa) * dir;
          case "margin":
            return (a.marginPct - b.marginPct) * dir;
          case "growth":
            return ((a.growthPct ?? 0) - (b.growthPct ?? 0)) * dir;
        }
      }

      switch (rankingMode) {
        case "best_units":
          return (a.unitsSold - b.unitsSold) * dir;
        case "worst_units":
          return (b.unitsSold - a.unitsSold) * dir;
        case "highest_revenue":
          return (a.revenuePaisa - b.revenuePaisa) * dir;
        case "lowest_revenue":
          return (b.revenuePaisa - a.revenuePaisa) * dir;
        case "most_profitable":
          return (a.grossProfitPaisa - b.grossProfitPaisa) * dir;
        case "least_profitable":
          return (b.grossProfitPaisa - a.grossProfitPaisa) * dir;
        case "zero_sale":
          return ((a.currentStock ?? 0) - (b.currentStock ?? 0)) * dir;
        case "declining":
          return (b.unitsDelta - a.unitsDelta) * dir;
        case "increasing":
          return (a.unitsDelta - b.unitsDelta) * dir;
      }
    });

    return list;
  }, [data.products, productSearch, productSortKey, rankingMode, sortAsc]);

  const handleRankingClick = (mode: ProductRankingMode) => {
    setRankingMode(mode);
    setProductSortKey("default");
    setSortAsc(false);
  };

  // Precomputed Top 10 Product Intelligence lists
  const top10BestSelling = React.useMemo(
    () =>
      [...data.products]
        .filter((p) => p.unitsSold > 0)
        .sort((a, b) => b.unitsSold - a.unitsSold)
        .slice(0, 10),
    [data.products]
  );
  const top10WorstSelling = React.useMemo(
    () =>
      [...data.products]
        .sort((a, b) => a.unitsSold - b.unitsSold)
        .slice(0, 10),
    [data.products]
  );
  const top10HighestRevenue = React.useMemo(
    () =>
      [...data.products]
        .filter((p) => p.revenuePaisa > 0)
        .sort((a, b) => b.revenuePaisa - a.revenuePaisa)
        .slice(0, 10),
    [data.products]
  );
  const top10MostProfitable = React.useMemo(
    () =>
      [...data.products]
        .filter((p) => p.unitsSold > 0)
        .sort((a, b) => b.grossProfitPaisa - a.grossProfitPaisa)
        .slice(0, 10),
    [data.products]
  );

  // Active series for chart tab
  const activeSeries: BiTimePoint[] = React.useMemo(() => {
    if (chartMode === "weekly") return data.weeklySeries;
    if (chartMode === "monthly") return data.monthlySeries;
    if (chartMode === "yearly") return data.yearlySeries;
    if (chartMode === "hourly") return data.hourlySeries;
    return data.dailySeries;
  }, [
    chartMode,
    data.dailySeries,
    data.hourlySeries,
    data.monthlySeries,
    data.weeklySeries,
    data.yearlySeries,
  ]);

  const handleExportBiExcel = () => {
    const ov = data.overview;
    downloadXlsxWorkbook(`TechnoWorld-BI-${data.dateRange.startDate}_to_${data.dateRange.endDate}.xlsx`, [
      {
        name: "Executive Summary",
        headers: ["Metric", "Value (PKR / Count)", "Period"],
        rows: [
          ["Business", businessName, data.dateRange.label],
          ["Gross Billed Revenue", Math.round(ov.grossBilledPaisa / 100), data.dateRange.label],
          ["Discounts Given", Math.round(ov.discountsPaisa / 100), data.dateRange.label],
          ["Refunds & Voids", Math.round(ov.refundsPaisa / 100), data.dateRange.label],
          ["Net Revenue", Math.round(ov.netRevenuePaisa / 100), data.dateRange.label],
          ["COGS", Math.round(ov.cogsPaisa / 100), data.dateRange.label],
          ["Gross Profit", Math.round(ov.grossProfitPaisa / 100), `${ov.grossMarginPct}%`],
          ["Operating Expenses", Math.round(ov.operatingExpensesPaisa / 100), data.dateRange.label],
          ["Daily Wages Recorded", Math.round(ov.dailyWagesPaisa / 100), data.dateRange.label],
          ["Net Operating Profit", Math.round(ov.netOperatingProfitPaisa / 100), `${ov.netMarginPct}%`],
          ["Total Transactions", ov.transactionCount, data.dateRange.label],
          ["Average Order Value", Math.round(ov.aovPaisa / 100), data.dateRange.label],
          ["Units Sold", ov.totalUnitsSold, data.dateRange.label],
          ["Cash Collected", Math.round(ov.cashPaymentsPaisa / 100), data.dateRange.label],
          ["Digital Payments", Math.round(ov.digitalPaymentsPaisa / 100), data.dateRange.label],
          ["Inventory Valuation (Cost)", Math.round(ov.inventoryCostValuationPaisa / 100), "Current"],
          ["Outstanding Receivables", Math.round(ov.outstandingReceivablesPaisa / 100), "Current"],
        ],
      },
      {
        name: "Product Rankings",
        headers: [
          "Product",
          "Category",
          "Units Sold",
          "Revenue (PKR)",
          "COGS (PKR)",
          "Gross Profit (PKR)",
          "Margin %",
          "Current Stock",
          "Trend vs Prev",
        ],
        rows: data.products.map((p) => [
          p.name,
          p.category,
          p.unitsSold,
          Math.round(p.revenuePaisa / 100),
          Math.round(p.cogsPaisa / 100),
          Math.round(p.grossProfitPaisa / 100),
          `${p.marginPct}%`,
          p.currentStock ?? "Service",
          p.trend,
        ]),
      },
      {
        name: "Categories",
        headers: [
          "Category",
          "Revenue (PKR)",
          "Units Sold",
          "Transactions",
          "COGS (PKR)",
          "Gross Profit (PKR)",
          "Margin %",
          "Contribution %",
          "Best Product",
        ],
        rows: data.categories.map((c) => [
          c.category,
          Math.round(c.revenuePaisa / 100),
          c.unitsSold,
          c.transactionCount,
          Math.round(c.cogsPaisa / 100),
          Math.round(c.grossProfitPaisa / 100),
          `${c.marginPct}%`,
          `${c.revenueSharePct}%`,
          c.bestProduct ?? "-",
        ]),
      },
      {
        name: "Staff Performance",
        headers: [
          "Employee",
          "Role",
          "Revenue (PKR)",
          "Transactions",
          "AOV (PKR)",
          "Units Sold",
          "Top Category",
          "Voids/Refunds",
        ],
        rows: data.employees.map((e) => [
          e.name,
          e.roleLabel,
          Math.round(e.revenuePaisa / 100),
          e.transactionCount,
          Math.round(e.aovPaisa / 100),
          e.unitsSold,
          e.topCategory,
          e.refundVoidCount,
        ]),
      },
    ]);
  };

  const handleExportBiCsv = () => {
    downloadCsvFile(
      `TechnoWorld-Products-BI-${data.dateRange.startDate}.csv`,
      [
        "Product",
        "Category",
        "Units Sold",
        "Revenue (PKR)",
        "COGS (PKR)",
        "Gross Profit (PKR)",
        "Margin %",
        "Stock",
        "Trend",
      ],
      data.products.map((p) => [
        p.name,
        p.category,
        p.unitsSold,
        Math.round(p.revenuePaisa / 100),
        Math.round(p.cogsPaisa / 100),
        Math.round(p.grossProfitPaisa / 100),
        `${p.marginPct}%`,
        p.currentStock ?? "Service",
        p.trend,
      ])
    );
  };

  const ov = data.overview;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <div className="print:hidden space-y-4">
        <PageHeader
          eyebrow={`${businessName} • Executive Business Intelligence`}
          title="Owner BI Dashboard"
          description={`Live database telemetry for ${data.dateRange.label} (${data.dateRange.startDate} to ${data.dateRange.endDate}, Asia/Karachi).`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <SectionRefreshButton
                onRefresh={() => (onForceRefresh ? onForceRefresh() : router.refresh())}
                isFetching={isRefreshing}
                lastUpdatedAt={lastUpdatedAt}
              />
              {canViewProfitMargins && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleExportBiCsv}
                    className="gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    CSV
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleExportBiExcel}
                    className="gap-1.5"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                    Excel (.xlsx)
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                PDF
              </Button>
            </div>
          }
        />

        {/* Period Filter Strip */}
        <Card>
          <CardContent className="p-3 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {PERIOD_OPTIONS.map((opt) => {
                  const active =
                    (opt.key === "custom" && showCustomDates) ||
                    (data.dateRange.period === opt.key &&
                      (!showCustomDates || opt.key === "custom"));
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onMouseEnter={() => {
                        if (opt.key !== "custom") onPrefetchPeriod?.(opt.key);
                      }}
                      onFocus={() => {
                        if (opt.key !== "custom") onPrefetchPeriod?.(opt.key);
                      }}
                      onClick={() => handleSelectPeriod(opt.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        active
                          ? "bg-[var(--primary)] text-white shadow-sm"
                          : "bg-[var(--warm)] text-[var(--foreground-secondary)] hover:text-[var(--foreground)] border border-[var(--border)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="text-[11px] font-mono text-[var(--foreground-secondary)] flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[var(--primary)]" />
                <span>
                  {data.dateRange.startDate} → {data.dateRange.endDate} (
                  {data.dateRange.dayCount}d)
                </span>
              </div>
            </div>

            {showCustomDates && (
              <form
                onSubmit={handleApplyCustomDates}
                className="flex flex-wrap items-end gap-2.5 pt-2 border-t border-[var(--border)]"
              >
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[var(--foreground-secondary)] mb-1">
                    From (PKT)
                  </label>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-9 text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[var(--foreground-secondary)] mb-1">
                    To (PKT)
                  </label>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-9 text-xs font-mono"
                    required
                  />
                </div>
                <Button type="submit" size="sm">
                  Apply Range
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Daily Closing Banner */}
        <Card className="relative overflow-hidden border-[var(--primary)]/30 bg-gradient-to-br from-[var(--primary)]/10 via-[var(--surface)] to-[var(--surface)]">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--primary)]/15 blur-3xl" />
          <CardContent className="relative p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br from-[#FF8533] to-[#E05800] text-white flex items-center justify-center font-black text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_18px_-2px_rgba(255,106,0,0.4)]">
                <span className="font-mono">DC</span>
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-sm sm:text-base font-extrabold tracking-tight text-[var(--foreground)]">
                  Daily Closing &amp; Accountant Reports
                </h3>
                <p className="text-xs text-[var(--foreground-secondary)] mt-0.5 leading-relaxed">
                  Reconcile live cash &amp; digital sales, daily wages, and shop expenses, save historical closings, and export CSV / Excel / PDF.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/closing"
              onMouseEnter={() => prefetchWorkspaceRoute(queryClient, "/dashboard/closing")}
              className="w-full sm:w-auto shrink-0"
            >
              <Button className="w-full font-bold text-xs gap-2">
                Open Daily Closing <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* BI Section Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(
            [
              { key: "overview", label: "Executive Overview", icon: Sparkles },
              { key: "products", label: "Product Rankings (9)", icon: Award },
              { key: "categories", label: "Categories", icon: PieChart },
              { key: "charts", label: "Charts & Shifts", icon: BarChart3 },
              { key: "employees", label: "Employees", icon: Users },
              { key: "inventory", label: "Inventory BI", icon: Boxes },
              ...(canViewProfitMargins
                ? [{ key: "financials", label: "P&L & Alerts", icon: Layers }]
                : []),
            ] as Array<{
              key: BiTabKey;
              label: string;
              icon: React.ComponentType<{ className?: string }>;
            }>
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  active
                    ? "bg-gradient-to-r from-[#FF7B1C] to-[#FF6A00] text-white shadow-sm"
                    : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: EXECUTIVE OVERVIEW                                             */}
      {/* ===================================================================== */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Primary Financial KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            <Card>
              <CardContent className="p-4 sm:p-5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">
                    Net Revenue
                  </p>
                  <div className="h-8 w-8 rounded-xl bg-[var(--brand-soft)] text-[var(--primary)] flex items-center justify-center shrink-0">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <h4 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-[var(--foreground)]">
                  {formatPkr(ov.netRevenuePaisa)}
                </h4>
                <div className="flex flex-col gap-0.5">
                  <DeltaBadge delta={ov.revenueChangePct} />
                  <span className="text-[10px] text-[var(--muted)]">
                    Gross {formatPkr(ov.grossBilledPaisa)} • Disc {formatPkr(ov.discountsPaisa)} • Refunds {formatPkr(ov.refundsPaisa)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {canViewProfitMargins ? (
              <Card>
                <CardContent className="p-4 sm:p-5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">
                      Gross &amp; Net Profit
                    </p>
                    <div className="h-8 w-8 rounded-xl bg-[var(--success-soft)] text-[var(--success)] flex items-center justify-center shrink-0">
                      <Wallet className="h-4 w-4" />
                    </div>
                  </div>
                  <h4 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-[var(--foreground)]">
                    {formatPkr(ov.grossProfitPaisa)}
                  </h4>
                  <div className="flex flex-col gap-0.5">
                    <DeltaBadge delta={ov.profitChangePct} />
                    <span className="text-[10px] text-[var(--muted)]">
                      Gross Margin {ov.grossMarginPct}% • Net Operating {formatPkr(ov.netOperatingProfitPaisa)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-4 sm:p-5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">
                      Gross Sales
                    </p>
                    <div className="h-8 w-8 rounded-xl bg-[var(--success-soft)] text-[var(--success)] flex items-center justify-center shrink-0">
                      <Wallet className="h-4 w-4" />
                    </div>
                  </div>
                  <h4 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-[var(--foreground)]">
                    {formatPkr(ov.grossSalesPaisa)}
                  </h4>
                  <span className="text-[11px] text-[var(--foreground-secondary)]">
                    {ov.transactionCount} completed orders
                  </span>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-4 sm:p-5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">
                    Transactions &amp; AOV
                  </p>
                  <div className="h-8 w-8 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                </div>
                <h4 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-[var(--foreground)]">
                  {ov.transactionCount} Bills
                </h4>
                <div className="flex flex-col gap-0.5">
                  <DeltaBadge delta={ov.txChangePct} />
                  <span className="text-[10px] text-[var(--muted)]">
                    AOV {formatPkr(ov.aovPaisa)} • {ov.totalUnitsSold} units sold
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">
                    Expenses &amp; Wages
                  </p>
                  <div className="h-8 w-8 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                </div>
                <h4 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-[var(--foreground)]">
                  {formatPkr(ov.totalExpensesAndWagesPaisa)}
                </h4>
                <div className="flex flex-col gap-0.5">
                  <DeltaBadge delta={ov.expenseChangePct} inverseGood />
                  <span className="text-[10px] text-[var(--muted)]">
                    Shop {formatPkr(ov.operatingExpensesPaisa)} • Wages {formatPkr(ov.dailyWagesPaisa)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Secondary Financial & Operational Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card>
              <CardContent className="p-3.5 space-y-1">
                <p className="text-[10px] font-bold uppercase text-[var(--muted)]">Cash Payments</p>
                <p className="text-sm font-black font-mono text-[var(--foreground)]">
                  {formatPkr(ov.cashPaymentsPaisa)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3.5 space-y-1">
                <p className="text-[10px] font-bold uppercase text-[var(--muted)]">Digital Payments</p>
                <p className="text-sm font-black font-mono text-[var(--foreground)]">
                  {formatPkr(ov.digitalPaymentsPaisa)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3.5 space-y-1">
                <p className="text-[10px] font-bold uppercase text-[var(--muted)]">Expected Drawer</p>
                <p className="text-sm font-black font-mono text-[var(--foreground)]">
                  {formatPkr(ov.expectedCashDrawerPaisa)}
                </p>
                <p className="text-[10px] text-[var(--muted)]">
                  {ov.openCashSessionCount} open drawer{ov.openCashSessionCount === 1 ? "" : "s"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3.5 space-y-1">
                <p className="text-[10px] font-bold uppercase text-[var(--muted)]">Stock Value (Cost)</p>
                <p className="text-sm font-black font-mono text-[var(--foreground)]">
                  {canViewProfitMargins
                    ? formatPkr(ov.inventoryCostValuationPaisa)
                    : `${data.inventory.totalUnitsInStock} units`}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3.5 space-y-1">
                <p className="text-[10px] font-bold uppercase text-[var(--muted)]">Receivables (Udhaar)</p>
                <p className="text-sm font-black font-mono text-[var(--foreground)]">
                  {formatPkr(ov.outstandingReceivablesPaisa)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3.5 space-y-1">
                <p className="text-[10px] font-bold uppercase text-[var(--muted)]">Refunds / Voids</p>
                <p className="text-sm font-black font-mono text-rose-500">
                  {formatPkr(ov.refundsPaisa)}
                </p>
                <p className="text-[10px] text-[var(--muted)]">{ov.refundCount} voided/refund</p>
              </CardContent>
            </Card>
          </div>

          {/* Alerts + Payment Breakdown + Recent Transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardContent className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-extrabold text-[var(--foreground)] flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[var(--primary)]" />
                    Business Alerts &amp; Automated Insights
                  </h3>
                  <Badge variant="brand" className="font-mono text-[10px]">
                    {data.alerts.length} active
                  </Badge>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {data.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`rounded-xl border p-3 text-xs flex items-start justify-between gap-3 ${
                        alert.severity === "critical"
                          ? "border-rose-500/30 bg-rose-500/10"
                          : alert.severity === "warning"
                          ? "border-amber-500/30 bg-amber-500/10"
                          : alert.severity === "positive"
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : "border-[var(--border)] bg-[var(--warm)]"
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 font-bold text-[var(--foreground)]">
                          {alert.severity === "positive" ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          ) : alert.severity === "info" ? (
                            <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          ) : (
                            <AlertTriangle
                              className={`h-3.5 w-3.5 shrink-0 ${
                                alert.severity === "critical"
                                  ? "text-rose-500"
                                  : "text-amber-500"
                              }`}
                            />
                          )}
                          <span className="truncate">{alert.title}</span>
                        </div>
                        <p className="text-[11px] text-[var(--foreground-secondary)]">
                          {alert.message}
                        </p>
                      </div>
                      {alert.metricValue && (
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] shrink-0">
                          {alert.metricValue}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5 space-y-3">
                <h3 className="font-display text-sm font-extrabold text-[var(--foreground)] flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[var(--primary)]" />
                  Payment Mix ({data.dateRange.label})
                </h3>
                {ov.paymentBreakdown.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] py-8 text-center">
                    No payments recorded in this period.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {ov.paymentBreakdown.map((pm) => {
                      const pct =
                        ov.netRevenuePaisa > 0
                          ? Math.round((pm.amountPaisa / Math.max(1, ov.cashPaymentsPaisa + ov.digitalPaymentsPaisa)) * 100)
                          : 0;
                      return (
                        <div key={pm.method} className="space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[var(--foreground)]">
                              {pm.method.replace("_", " ")} ({pm.count})
                            </span>
                            <span className="font-mono font-bold text-[var(--foreground)]">
                              {formatPkr(pm.amountPaisa)} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-[var(--warm)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#FF7B1C] to-[#FF6A00]"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-2 border-t border-[var(--border)]">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      openInspector(
                        `All Transactions (${data.dateRange.label})`,
                        data.transactions.map((t) => t.id)
                      )
                    }
                  >
                    Inspect {data.transactions.length} Transactions
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Preview: Shift Comparison & Top Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-extrabold text-[var(--foreground)] flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[var(--primary)]" />
                    Shift Performance (PKT)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab("charts")}
                    className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer"
                  >
                    Charts &amp; Hourly →
                  </button>
                </div>
                <div className="space-y-2.5">
                  {data.shiftStats
                    .filter((s) => s.shift !== "NIGHT" || s.transactionCount > 0)
                    .map((s) => (
                      <div
                        key={s.shift}
                        onClick={() =>
                          openInspector(
                            `${s.label} (${s.windowLabel})`,
                            s.txIds
                          )
                        }
                        className="rounded-xl border border-[var(--border)] bg-[var(--warm)]/60 p-3 flex items-center justify-between gap-2 hover:border-[var(--primary)]/40 transition cursor-pointer"
                      >
                        <div>
                          <p className="text-xs font-extrabold text-[var(--foreground)]">
                            {s.label}{" "}
                            <span className="font-mono font-normal text-[11px] text-[var(--muted)]">
                              ({s.windowLabel})
                            </span>
                          </p>
                          <p className="text-[11px] text-[var(--foreground-secondary)]">
                            {s.transactionCount} bills • {s.unitsSold} units • Cash{" "}
                            {formatPkr(s.cashPaisa)} / Digital{" "}
                            {formatPkr(s.digitalPaisa)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black font-mono text-[var(--foreground)]">
                            {formatPkr(s.revenuePaisa)}
                          </p>
                          <p className="text-[10px] text-[var(--primary)] font-semibold">
                            Inspect bills
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-extrabold text-[var(--foreground)] flex items-center gap-2">
                    <Award className="h-4 w-4 text-[var(--primary)]" />
                    Top Selling Items ({data.dateRange.label})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab("products")}
                    className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer"
                  >
                    All 9 Rankings →
                  </button>
                </div>
                {data.inventory.fastMovingItems.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] py-8 text-center">
                    No sold items recorded in {data.dateRange.label}.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.inventory.fastMovingItems.slice(0, 5).map((p, idx) => (
                      <div
                        key={p.key}
                        className="rounded-xl border border-[var(--border)] bg-[var(--warm)]/50 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="h-6 w-6 rounded-lg bg-[var(--primary)]/15 text-[var(--primary)] font-mono font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-[var(--foreground)] truncate">
                              {p.name}
                            </p>
                            <p className="text-[10px] text-[var(--muted)]">
                              {p.category} • {p.unitsSold} units
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-bold text-[var(--foreground)]">
                            {formatPkr(p.revenuePaisa)}
                          </p>
                          {canViewProfitMargins && (
                            <p className="text-[10px] text-emerald-500 font-semibold">
                              +{formatPkr(p.grossProfitPaisa)} ({p.marginPct}%)
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: PRODUCT INTELLIGENCE & TOP 10 RANKINGS + FULL LEADERBOARD      */}
      {/* ===================================================================== */}
      {activeTab === "products" && (
        <div className="space-y-4">
          {/* Top 10 Intelligence Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 sm:p-5 space-y-2.5">
                <h3 className="font-display text-sm font-extrabold text-[var(--foreground)] flex items-center justify-between">
                  <span>Top 10 Best-Selling (Units)</span>
                  <Badge variant="success">{top10BestSelling.length}</Badge>
                </h3>
                {top10BestSelling.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] py-4">No completed product sales in {data.dateRange.label}.</p>
                ) : (
                  <div className="space-y-1.5">
                    {top10BestSelling.map((p, i) => (
                      <div key={p.key} className="flex items-center justify-between text-xs rounded-lg bg-[var(--warm)]/50 px-2.5 py-1.5 gap-2">
                        <span className="truncate font-semibold">
                          <span className="font-mono text-[var(--primary)] mr-1.5">#{i + 1}</span>
                          {p.name}
                        </span>
                        <span className="font-mono font-bold shrink-0">
                          {p.unitsSold} pcs • {p.revenueContributionPct}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5 space-y-2.5">
                <h3 className="font-display text-sm font-extrabold text-[var(--foreground)] flex items-center justify-between">
                  <span>Top 10 Worst-Selling &amp; Zero-Sale</span>
                  <Badge variant="warning">{top10WorstSelling.length}</Badge>
                </h3>
                {top10WorstSelling.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] py-4">No catalog products available.</p>
                ) : (
                  <div className="space-y-1.5">
                    {top10WorstSelling.map((p, i) => (
                      <div key={p.key} className="flex items-center justify-between text-xs rounded-lg bg-[var(--warm)]/50 px-2.5 py-1.5 gap-2">
                        <span className="truncate font-semibold">
                          <span className="font-mono text-[var(--muted)] mr-1.5">#{i + 1}</span>
                          {p.name}
                        </span>
                        <span className="font-mono shrink-0 text-[var(--foreground-secondary)]">
                          {p.unitsSold} sold • {p.trend}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5 space-y-2.5">
                <h3 className="font-display text-sm font-extrabold text-[var(--foreground)] flex items-center justify-between">
                  <span>Top 10 Highest Revenue</span>
                  <Badge variant="brand">{top10HighestRevenue.length}</Badge>
                </h3>
                {top10HighestRevenue.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] py-4">No revenue recorded in {data.dateRange.label}.</p>
                ) : (
                  <div className="space-y-1.5">
                    {top10HighestRevenue.map((p, i) => (
                      <div key={p.key} className="flex items-center justify-between text-xs rounded-lg bg-[var(--warm)]/50 px-2.5 py-1.5 gap-2">
                        <span className="truncate font-semibold">
                          <span className="font-mono text-[var(--primary)] mr-1.5">#{i + 1}</span>
                          {p.name}
                        </span>
                        <span className="font-mono font-bold shrink-0">
                          {formatPkr(p.revenuePaisa)} ({p.revenueContributionPct}%)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {canViewProfitMargins && (
              <Card>
                <CardContent className="p-4 sm:p-5 space-y-2.5">
                  <h3 className="font-display text-sm font-extrabold text-[var(--foreground)] flex items-center justify-between">
                    <span>Top 10 Most Profitable (FIFO Gross Profit)</span>
                    <Badge variant="success">{top10MostProfitable.length}</Badge>
                  </h3>
                  {top10MostProfitable.length === 0 ? (
                    <p className="text-xs text-[var(--muted)] py-4">No profit data in {data.dateRange.label}.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {top10MostProfitable.map((p, i) => (
                        <div key={p.key} className="flex items-center justify-between text-xs rounded-lg bg-[var(--warm)]/50 px-2.5 py-1.5 gap-2">
                          <span className="truncate font-semibold">
                            <span className="font-mono text-emerald-500 mr-1.5">#{i + 1}</span>
                            {p.name}
                          </span>
                          <span className="font-mono font-bold text-emerald-500 shrink-0">
                            +{formatPkr(p.grossProfitPaisa)} ({p.marginPct}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <Card>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-extrabold text-[var(--foreground)]">
                    Complete Product Sales &amp; Profitability Leaderboard
                  </h2>
                  <p className="text-xs text-[var(--foreground-secondary)]">
                    Filter by ranking view and sort by units sold, revenue, gross profit, margin, growth, or lowest sales.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:w-48">
                    <Search className="h-3.5 w-3.5 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Filter product or category..."
                      className="h-9 pl-8 text-xs"
                    />
                  </div>
                  <select
                    aria-label="Sort product leaderboard"
                    value={productSortKey}
                    onChange={(e) => setProductSortKey(e.target.value as ProductSortKey)}
                    className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--foreground)]"
                  >
                    <option value="default">Sort: Preset Ranking</option>
                    <option value="units">Sort: Units Sold</option>
                    <option value="lowest_sales">Sort: Lowest Sales</option>
                    <option value="revenue">Sort: Revenue</option>
                    {canViewProfitMargins && (
                      <>
                        <option value="profit">Sort: Gross Profit</option>
                        <option value="margin">Sort: Profit Margin %</option>
                      </>
                    )}
                    <option value="growth">Sort: Sales Growth</option>
                  </select>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setSortAsc((prev) => !prev)}
                    className="gap-1.5 shrink-0"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    {sortAsc ? "Asc" : "Desc"}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {PRODUCT_RANKINGS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => handleRankingClick(r.key)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                      rankingMode === r.key
                        ? "bg-[var(--primary)] text-white"
                        : "bg-[var(--warm)] border border-[var(--border)] text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {rankedProducts.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--muted)]">
                  No products match this ranking filter in {data.dateRange.label}.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--warm)]/60 text-[var(--muted)] uppercase tracking-wider">
                        <th className="py-2.5 px-3 font-bold">#</th>
                        <th className="py-2.5 px-3 font-bold">Product</th>
                        <th className="py-2.5 px-3 font-bold">Category</th>
                        <th className="py-2.5 px-3 font-bold text-right">Units</th>
                        <th className="py-2.5 px-3 font-bold text-right">Revenue</th>
                        <th className="py-2.5 px-3 font-bold text-right">Share</th>
                        {canViewProfitMargins && (
                          <>
                            <th className="py-2.5 px-3 font-bold text-right">Cost / Price</th>
                            <th className="py-2.5 px-3 font-bold text-right">FIFO COGS</th>
                            <th className="py-2.5 px-3 font-bold text-right">Gross Profit</th>
                            <th className="py-2.5 px-3 font-bold text-right">Margin</th>
                          </>
                        )}
                        <th className="py-2.5 px-3 font-bold text-right">Stock</th>
                        <th className="py-2.5 px-3 font-bold">Trend vs Prev</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {rankedProducts.map((p, idx) => (
                        <tr key={p.key} className="hover:bg-[var(--warm)]/40 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-[var(--muted)]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-[var(--foreground)]">
                            {p.name}
                          </td>
                          <td className="py-2.5 px-3 text-[var(--foreground-secondary)]">
                            {p.category}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            {p.unitsSold}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            {formatPkr(p.revenuePaisa)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[var(--foreground-secondary)]">
                            {p.revenueContributionPct}%
                          </td>
                          {canViewProfitMargins && (
                            <>
                              <td className="py-2.5 px-3 text-right font-mono text-[11px] text-[var(--foreground-secondary)]">
                                {formatPkr(p.costPricePaisa)} / {formatPkr(p.retailPricePaisa)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-[var(--foreground-secondary)]">
                                {formatPkr(p.cogsPaisa)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-500">
                                {formatPkr(p.grossProfitPaisa)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                {p.marginPct}%
                              </td>
                            </>
                          )}
                          <td className="py-2.5 px-3 text-right font-mono">
                            {p.currentStock === null ? (
                              <span className="text-[var(--muted)]">Service</span>
                            ) : p.currentStock === 0 ? (
                              <Badge variant="danger">0</Badge>
                            ) : p.minStockAlert !== null && p.currentStock <= p.minStockAlert ? (
                              <Badge variant="warning">{p.currentStock}</Badge>
                            ) : (
                              <span>{p.currentStock}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant={
                                p.trend === "INCREASING" || p.trend === "NEW"
                                  ? "success"
                                  : p.trend === "DECLINING"
                                  ? "danger"
                                  : "neutral"
                              }
                            >
                              {p.trend}
                              {p.unitsDelta !== 0
                                ? ` (${p.unitsDelta > 0 ? "+" : ""}${p.unitsDelta})`
                                : ""}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: CATEGORY-WISE ANALYTICS & INTERACTIVE DONUT/BAR/TREND VISUALS  */}
      {/* ===================================================================== */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-[10px] font-bold uppercase text-[var(--muted)]">
                  Highest Revenue Category
                </p>
                <p className="text-base font-black text-[var(--primary)] truncate">
                  {data.highestRevenueCategory ?? "—"}
                </p>
              </CardContent>
            </Card>
            {canViewProfitMargins && (
              <Card>
                <CardContent className="p-4 space-y-1">
                  <p className="text-[10px] font-bold uppercase text-[var(--muted)]">
                    Highest Profit Category
                  </p>
                  <p className="text-base font-black text-emerald-500 truncate">
                    {data.highestProfitCategory ?? "—"}
                  </p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-[10px] font-bold uppercase text-[var(--muted)]">
                  Lowest Performing Category
                </p>
                <p className="text-base font-black text-amber-500 truncate">
                  {data.lowestPerformingCategory ?? "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 sm:p-5 space-y-4">
                <h3 className="font-display text-sm font-extrabold text-[var(--foreground)]">
                  Revenue Share by Category
                </h3>
                {data.categories.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] py-10 text-center">
                    No category sales in {data.dateRange.label}.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {/* Interactive Conic-Gradient Donut */}
                    <div className="flex items-center justify-center py-2">
                      {(() => {
                        let acc = 0;
                        const segments = data.categories.map((c, idx) => {
                          const start = acc;
                          acc += c.revenueSharePct;
                          const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                          return `${color} ${start.toFixed(1)}% ${Math.min(100, acc).toFixed(1)}%`;
                        });
                        const gradient = `conic-gradient(${segments.join(", ")})`;
                        return (
                          <div
                            className="relative h-44 w-44 rounded-full shadow-inner flex items-center justify-center"
                            style={{ background: gradient }}
                          >
                            <div className="h-28 w-28 rounded-full bg-[var(--surface)] border border-[var(--border)] flex flex-col items-center justify-center text-center p-2">
                              <span className="text-[10px] font-bold uppercase text-[var(--muted)]">
                                Categories
                              </span>
                              <span className="font-mono text-base font-black text-[var(--foreground)]">
                                {data.categories.length}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="space-y-2">
                      {data.categories.map((c, idx) => (
                        <div
                          key={c.category}
                          className="flex items-center justify-between text-xs gap-2"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{
                                backgroundColor:
                                  CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
                              }}
                            />
                            <span className="font-semibold text-[var(--foreground)] truncate">
                              {c.category}
                            </span>
                          </span>
                          <span className="font-mono font-bold shrink-0">
                            {c.revenueSharePct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardContent className="p-4 sm:p-5 space-y-4">
                <h3 className="font-display text-sm font-extrabold text-[var(--foreground)]">
                  Category Revenue vs Gross Profit
                </h3>
                {data.categories.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] py-10 text-center">
                    No category data to display.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const maxRev = Math.max(
                        1,
                        ...data.categories.map((c) => c.revenuePaisa)
                      );
                      return data.categories.map((c, idx) => {
                        const wRev = Math.round((c.revenuePaisa / maxRev) * 100);
                        const wProf = Math.round(
                          (Math.max(0, c.grossProfitPaisa) / maxRev) * 100
                        );
                        return (
                          <div key={c.category} className="space-y-1 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-[var(--foreground)]">
                                {c.category}
                              </span>
                              <span className="font-mono font-semibold text-[var(--foreground-secondary)]">
                                {formatPkr(c.revenuePaisa)}
                                {canViewProfitMargins
                                  ? ` • GP ${formatPkr(c.grossProfitPaisa)} (${c.marginPct}%)`
                                  : ""}
                              </span>
                            </div>
                            <div className="h-3 rounded-full bg-[var(--warm)] overflow-hidden relative">
                              <div
                                className="h-full rounded-full opacity-35"
                                style={{
                                  width: `${wRev}%`,
                                  backgroundColor:
                                    CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
                                }}
                              />
                              {canViewProfitMargins && (
                                <div
                                  className="h-full rounded-full absolute left-0 top-0"
                                  style={{
                                    width: `${wProf}%`,
                                    backgroundColor:
                                      CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4 sm:p-5 space-y-3">
              <h3 className="font-display text-sm font-extrabold text-[var(--foreground)]">
                Detailed Category Breakdown
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--warm)]/60 text-[var(--muted)] uppercase">
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Revenue</th>
                      <th className="py-2.5 px-3 text-right">Units</th>
                      <th className="py-2.5 px-3 text-right">Bills</th>
                      {canViewProfitMargins && (
                        <>
                          <th className="py-2.5 px-3 text-right">COGS</th>
                          <th className="py-2.5 px-3 text-right">Gross Profit</th>
                          <th className="py-2.5 px-3 text-right">Margin</th>
                        </>
                      )}
                      <th className="py-2.5 px-3 text-right">Share</th>
                      <th className="py-2.5 px-3">Best Product</th>
                      <th className="py-2.5 px-3">Lowest Product</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {data.categories.map((c) => (
                      <tr key={c.category} className="hover:bg-[var(--warm)]/40">
                        <td className="py-2.5 px-3 font-bold text-[var(--foreground)]">
                          {c.category}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {formatPkr(c.revenuePaisa)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {c.unitsSold}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {c.transactionCount}
                        </td>
                        {canViewProfitMargins && (
                          <>
                            <td className="py-2.5 px-3 text-right font-mono text-[var(--muted)]">
                              {formatPkr(c.cogsPaisa)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-500">
                              {formatPkr(c.grossProfitPaisa)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              {c.marginPct}%
                            </td>
                          </>
                        )}
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {c.revenueSharePct}%
                        </td>
                        <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-medium">
                          {c.bestProduct ?? "—"}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--foreground-secondary)]">
                          {c.worstProduct ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {data.categoryTrends.length > 0 && (
            <Card>
              <CardContent className="p-4 sm:p-5 space-y-3">
                <h3 className="font-display text-sm font-extrabold text-[var(--foreground)]">
                  Category Sales Trends Over Time
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {data.categoryTrends.map((ct) => (
                    <div
                      key={ct.dateKey}
                      className="rounded-xl border border-[var(--border)] bg-[var(--warm)]/40 p-2.5 text-xs space-y-1.5"
                    >
                      <div className="flex justify-between font-mono font-bold">
                        <span>{ct.label}</span>
                        <span>{formatPkr(ct.totalRevenuePaisa)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(ct.byCategory)
                          .sort((a, b) => b[1] - a[1])
                          .map(([catName, amt]) => (
                            <Badge key={catName} variant="neutral" className="font-mono text-[10px]">
                              {catName}: {formatPkr(amt)}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: REVENUE, PROFIT, HOURLY & SHIFT ANALYTICS (CLICK-TO-INSPECT)   */}
      {/* ===================================================================== */}
      {activeTab === "charts" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-extrabold text-[var(--foreground)]">
                    Interactive Revenue, Profit &amp; Payment Series
                  </h2>
                  <p className="text-xs text-[var(--foreground-secondary)]">
                    Click any bar or data point to inspect its underlying receipts.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { key: "daily", label: "Daily" },
                      { key: "weekly", label: "Weekly" },
                      { key: "monthly", label: "Monthly" },
                      { key: "yearly", label: "Yearly" },
                      { key: "hourly", label: "Hourly" },
                      ...(canViewProfitMargins
                        ? [
                            { key: "rev_vs_exp", label: "Rev vs Expenses" },
                            { key: "gross_vs_net", label: "Gross vs Net" },
                          ]
                        : []),
                      { key: "cash_vs_digital", label: "Cash vs Digital" },
                    ] as Array<{ key: ChartSeriesMode; label: string }>
                  ).map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setChartMode(m.key)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition ${
                        chartMode === m.key
                          ? "bg-[var(--primary)] text-white"
                          : "bg-[var(--warm)] border border-[var(--border)] text-[var(--foreground-secondary)]"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {activeSeries.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--muted)]">
                  No chart data points available for this view.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {(() => {
                    const maxVal = Math.max(
                      1,
                      ...activeSeries.map((pt) =>
                        Math.max(
                          pt.revenuePaisa,
                          pt.expensesPaisa,
                          pt.grossProfitPaisa,
                          pt.cashPaisa + pt.digitalPaisa
                        )
                      )
                    );

                    return (
                      <div className="grid grid-cols-1 gap-2 max-h-[420px] overflow-y-auto pr-1">
                        {activeSeries.map((pt) => {
                          const primaryVal =
                            chartMode === "gross_vs_net"
                              ? Math.max(0, pt.grossProfitPaisa)
                              : pt.revenuePaisa;
                          const secondaryVal =
                            chartMode === "rev_vs_exp"
                              ? pt.expensesPaisa
                              : chartMode === "gross_vs_net"
                              ? Math.max(0, pt.netProfitPaisa)
                              : chartMode === "cash_vs_digital"
                              ? pt.digitalPaisa
                              : pt.cashPaisa;

                          const primaryPct = Math.round((primaryVal / maxVal) * 100);
                          const secondaryPct = Math.round((secondaryVal / maxVal) * 100);

                          return (
                            <button
                              key={pt.key}
                              type="button"
                              onClick={() =>
                                openInspector(
                                  `${pt.label} (${pt.transactionCount} bills)`,
                                  pt.txIds
                                )
                              }
                              className="w-full text-left rounded-xl border border-[var(--border)] bg-[var(--warm)]/40 hover:border-[var(--primary)]/50 p-2.5 transition cursor-pointer"
                            >
                              <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                                <span className="font-mono font-bold text-[var(--foreground)]">
                                  {pt.label}
                                </span>
                                <span className="font-mono text-[11px] text-[var(--foreground-secondary)]">
                                  {chartMode === "rev_vs_exp"
                                    ? `Rev ${formatPkr(pt.revenuePaisa)} | Exp ${formatPkr(pt.expensesPaisa)}`
                                    : chartMode === "gross_vs_net"
                                    ? `Gross ${formatPkr(pt.grossProfitPaisa)} | Net ${formatPkr(pt.netProfitPaisa)}`
                                    : chartMode === "cash_vs_digital"
                                    ? `Cash ${formatPkr(pt.cashPaisa)} | Digital ${formatPkr(pt.digitalPaisa)}`
                                    : `${formatPkr(pt.revenuePaisa)} (${pt.transactionCount} bills)`}
                                </span>
                              </div>
                              <div className="space-y-1">
                                <div className="h-2.5 rounded-full bg-[var(--surface)] overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-[#FF7B1C] to-[#FF6A00]"
                                    style={{
                                      width: `${
                                        chartMode === "cash_vs_digital"
                                          ? Math.round((pt.cashPaisa / maxVal) * 100)
                                          : primaryPct
                                      }%`,
                                    }}
                                  />
                                </div>
                                {(chartMode === "rev_vs_exp" ||
                                  chartMode === "gross_vs_net" ||
                                  chartMode === "cash_vs_digital") && (
                                  <div className="h-2 rounded-full bg-[var(--surface)] overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        chartMode === "rev_vs_exp"
                                          ? "bg-rose-500"
                                          : chartMode === "gross_vs_net"
                                          ? "bg-emerald-500"
                                          : "bg-blue-500"
                                      }`}
                                      style={{ width: `${secondaryPct}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shift Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.shiftStats.map((sh) => (
              <Card key={sh.shift}>
                <CardContent className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-display text-sm font-extrabold text-[var(--foreground)]">
                        {sh.label}
                      </h4>
                      <p className="text-[11px] font-mono text-[var(--muted)]">
                        {sh.windowLabel}
                      </p>
                    </div>
                    <Badge variant="brand" className="font-mono text-[10px]">
                      {sh.transactionCount} bills
                    </Badge>
                  </div>
                  <div className="text-xl font-black font-mono text-[var(--foreground)]">
                    {formatPkr(sh.revenuePaisa)}
                  </div>
                  <div className="space-y-1 text-xs text-[var(--foreground-secondary)]">
                    <div className="flex justify-between">
                      <span>Cash Sales:</span>
                      <span className="font-mono font-bold text-[var(--foreground)]">
                        {formatPkr(sh.cashPaisa)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Digital Sales:</span>
                      <span className="font-mono font-bold text-[var(--foreground)]">
                        {formatPkr(sh.digitalPaisa)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expenses:</span>
                      <span className="font-mono font-bold text-rose-500">
                        {formatPkr(sh.expensesPaisa)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cash Discrepancy:</span>
                      <span className="font-mono font-bold">
                        {formatPkr(sh.cashVariancePaisa)}
                      </span>
                    </div>
                    <div className="pt-1 text-[11px]">
                      Staff:{" "}
                      {sh.employees.length > 0
                        ? sh.employees.join(", ")
                        : "No active bills"}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => openInspector(`${sh.label} Bills`, sh.txIds)}
                  >
                    Inspect {sh.transactionCount} Bills
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: EMPLOYEE PERFORMANCE LEADERBOARD                               */}
      {/* ===================================================================== */}
      {activeTab === "employees" && (
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-extrabold text-[var(--foreground)]">
                Employee Sales &amp; Shift Attribution ({data.dateRange.label})
              </h2>
              <p className="text-xs text-[var(--foreground-secondary)]">
                Tracked directly from authenticated POS `sold_by` records linked to shop staff profiles.
              </p>
            </div>

            {data.employees.length === 0 ? (
              <div className="py-10 text-center text-xs text-[var(--muted)]">
                No employee sales recorded in this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--warm)]/60 text-[var(--muted)] uppercase">
                      <th className="py-2.5 px-3">Employee</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3 text-right">Revenue</th>
                      <th className="py-2.5 px-3 text-right">Bills</th>
                      <th className="py-2.5 px-3 text-right">AOV</th>
                      <th className="py-2.5 px-3 text-right">Units</th>
                      <th className="py-2.5 px-3 text-right">Morning / Evening</th>
                      <th className="py-2.5 px-3">Top Category</th>
                      <th className="py-2.5 px-3 text-right">Voids</th>
                      <th className="py-2.5 px-3 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {data.employees.map((e) => (
                      <tr key={e.employeeKey} className="hover:bg-[var(--warm)]/40">
                        <td className="py-2.5 px-3 font-bold text-[var(--foreground)]">
                          {e.name}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--foreground-secondary)]">
                          {e.roleLabel}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {formatPkr(e.revenuePaisa)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {e.transactionCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {formatPkr(e.aovPaisa)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {e.unitsSold}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                          {formatPkr(e.morningRevenuePaisa)} /{" "}
                          {formatPkr(e.eveningRevenuePaisa)}
                        </td>
                        <td className="py-2.5 px-3">{e.topCategory}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-500">
                          {e.refundVoidCount}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              openInspector(`Sales by ${e.name}`, e.txIds)
                            }
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: INVENTORY INTELLIGENCE                                         */}
      {/* ===================================================================== */}
      {activeTab === "inventory" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-[10px] font-bold uppercase text-[var(--muted)]">
                  Total SKUs &amp; Units
                </p>
                <p className="text-lg font-black font-mono text-[var(--foreground)]">
                  {data.inventory.totalSkus} SKUs • {data.inventory.totalUnitsInStock} pcs
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-[10px] font-bold uppercase text-[var(--muted)]">
                  Cost Valuation (FIFO)
                </p>
                <p className="text-lg font-black font-mono text-[var(--foreground)]">
                  {canViewProfitMargins
                    ? formatPkr(data.inventory.totalCostValuationPaisa)
                    : "Restricted"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-[10px] font-bold uppercase text-[var(--muted)]">
                  Retail Stock Value
                </p>
                <p className="text-lg font-black font-mono text-[var(--foreground)]">
                  {formatPkr(data.inventory.totalRetailValuationPaisa)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-[10px] font-bold uppercase text-[var(--muted)]">
                  Out / Low Stock Alerts
                </p>
                <p className="text-lg font-black font-mono text-rose-500">
                  {data.inventory.outOfStockItems.length} OOS •{" "}
                  {data.inventory.lowStockItems.length} Low
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 sm:p-5 space-y-3">
                <h3 className="font-display text-sm font-extrabold text-[var(--foreground)]">
                  Restocking Requirements (Low &amp; Out-of-Stock)
                </h3>
                {[
                  ...data.inventory.outOfStockItems.map((x) => ({
                    ...x,
                    stock: 0,
                  })),
                  ...data.inventory.lowStockItems,
                ].length === 0 ? (
                  <p className="text-xs text-emerald-500 font-semibold py-6 text-center flex items-center justify-center gap-1.5">
                    <PackageCheck className="h-4 w-4" /> All stock items are above minimum alert thresholds.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {[
                      ...data.inventory.outOfStockItems.map((x) => ({
                        ...x,
                        stock: 0,
                      })),
                      ...data.inventory.lowStockItems,
                    ].map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-[var(--border)] bg-[var(--warm)]/50 p-3 flex items-center justify-between text-xs gap-2"
                      >
                        <div>
                          <p className="font-bold text-[var(--foreground)]">
                            {item.name}{" "}
                            <span className="text-[var(--muted)] font-normal">
                              ({item.category})
                            </span>
                          </p>
                          <p className="text-[11px] text-[var(--foreground-secondary)]">
                            In stock: {item.stock} (Min {item.minAlert}) → Suggested order:{" "}
                            <strong>{item.suggestedReorder} pcs</strong>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {item.stock === 0 ? (
                            <Badge variant="danger">OUT OF STOCK</Badge>
                          ) : (
                            <Badge variant="warning">LOW ({item.stock})</Badge>
                          )}
                          {canViewProfitMargins && (
                            <p className="text-[10px] font-mono text-[var(--muted)] mt-1">
                              Est. {formatPkr(item.reorderCostPaisa)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5 space-y-3">
                <h3 className="font-display text-sm font-extrabold text-[var(--foreground)]">
                  Dead Stock (0 Sales in {data.dateRange.label})
                </h3>
                {data.inventory.deadStockItems.length === 0 ? (
                  <p className="text-xs text-emerald-500 font-semibold py-6 text-center">
                    Every stocked item moved in {data.dateRange.label}.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.inventory.deadStockItems.map((d) => (
                      <div
                        key={d.id}
                        className="rounded-xl border border-[var(--border)] bg-[var(--warm)]/50 p-3 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-[var(--foreground)]">{d.name}</p>
                          <p className="text-[11px] text-[var(--muted)]">
                            {d.category} • {d.stock} units idle
                          </p>
                        </div>
                        {canViewProfitMargins && (
                          <span className="font-mono font-bold text-amber-500">
                            {formatPkr(d.valuationPaisa)} tied up
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 7: FINANCIAL SUMMARY (P&L RECONCILIATION & CLOSING HISTORY)       */}
      {/* ===================================================================== */}
      {/* =================================================================== */}
      {/* TAB 7: ACCESSORIES PROFIT & LOSS & SAVED CLOSINGS HISTORY          */}
      {/* =================================================================== */}
      {activeTab === "financials" && canViewProfitMargins && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 sm:p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">
                  Accessories Profit &amp; Loss ({data.dateRange.label})
                </h3>
                <Badge variant="brand" className="text-[10px] font-mono">
                  ACCESSORIES ONLY
                </Badge>
              </div>
              <p className="text-[11px] text-[var(--muted)]">
                Movies, Printing &amp; Composing excluded ({data.accessoriesPnl.excludedServiceLines} service lines / {formatPkr(data.accessoriesPnl.excludedServiceRevenuePaisa)} preserved in DB, excluded here).
              </p>
              <div className="space-y-2 text-xs divide-y divide-[var(--border)]">
                <div className="py-2 flex justify-between">
                  <span className="text-[var(--foreground-secondary)]">
                    Gross Accessory Sales ({data.accessoriesPnl.unitsSold} units • {data.accessoriesPnl.billCount} bills)
                  </span>
                  <span className="font-mono font-bold">
                    {formatPkr(data.accessoriesPnl.grossBilledPaisa)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-[var(--foreground-secondary)]">Less: Discounts Applied</span>
                  <span className="font-mono text-rose-500">
                    - {formatPkr(data.accessoriesPnl.discountsPaisa)}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between font-bold text-sm">
                  <span>Net Accessory Revenue</span>
                  <span className="font-mono">
                    {formatPkr(data.accessoriesPnl.netRevenuePaisa)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-[var(--foreground-secondary)]">
                    Less: Accessory Cost of Goods Sold (FIFO)
                  </span>
                  <span className="font-mono text-rose-500">
                    - {formatPkr(data.accessoriesPnl.cogsPaisa)}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between font-bold text-sm text-emerald-500">
                  <span>
                    Accessory Gross Profit ({data.accessoriesPnl.grossMarginPct}%)
                  </span>
                  <span className="font-mono">
                    {formatPkr(data.accessoriesPnl.grossProfitPaisa)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-[var(--foreground-secondary)]">Less: Operating Expenses</span>
                  <span className="font-mono text-rose-500">
                    - {formatPkr(data.accessoriesPnl.operatingExpensesPaisa)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-[var(--foreground-secondary)]">Less: Daily Staff Wages</span>
                  <span className="font-mono text-rose-500">
                    - {formatPkr(data.accessoriesPnl.dailyWagesPaisa)}
                  </span>
                </div>
                <div className="py-3 flex justify-between font-black text-base">
                  <span>
                    Net Accessory Profit ({data.accessoriesPnl.netMarginPct}%)
                  </span>
                  <span
                    className={`font-mono ${
                      data.accessoriesPnl.netOperatingProfitPaisa >= 0
                        ? "text-emerald-500"
                        : "text-rose-500"
                    }`}
                  >
                    {formatPkr(data.accessoriesPnl.netOperatingProfitPaisa)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">
                  Saved Daily Closings History
                </h3>
                <Link
                  href="/dashboard/closing"
                  className="text-xs font-bold text-[var(--primary)] hover:underline"
                >
                  Open Closing Suite →
                </Link>
              </div>
              {data.closingHistory.length === 0 ? (
                <p className="text-xs text-[var(--muted)] py-10 text-center">
                  No daily closings saved yet. Open Daily Closing to record and save your first closing.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {data.closingHistory.map((ch) => (
                    <Link
                      key={ch.closingDate}
                      href={`/dashboard/closing?date=${ch.closingDate}`}
                      className="block rounded-xl border border-[var(--border)] bg-[var(--warm)]/50 hover:border-[var(--primary)]/40 p-3 text-xs transition"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="font-mono text-[var(--foreground)]">
                          {ch.closingDate}
                        </span>
                        <span className="font-mono text-[var(--foreground)]">
                          Sales: {formatPkr(ch.netSalesPaisa)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--foreground-secondary)]">
                        <span>
                          Exp {formatPkr(ch.totalExpensesPaisa)} • Wages{" "}
                          {formatPkr(ch.totalWagesPaisa)}
                        </span>
                        <span
                          className={`font-mono font-bold ${
                            ch.cashDifferencePaisa === 0
                              ? "text-emerald-500"
                              : "text-amber-500"
                          }`}
                        >
                          Var: {formatPkr(ch.cashDifferencePaisa)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CLICK-TO-INSPECT TRANSACTIONS MODAL                                   */}
      {/* ===================================================================== */}
      {inspectedTxIds !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 tw-backdrop-in"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => setInspectedTxIds(null)}
          />
          <div className="glass-modal relative z-10 w-full max-w-2xl max-h-[82vh] rounded-2xl flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-[var(--border)] flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-sm sm:text-base font-extrabold text-[var(--foreground)]">
                  {inspectedTitle}
                </h3>
                <p className="text-[11px] text-[var(--foreground-secondary)]">
                  Showing {inspectedTransactions.length} verified receipts
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedTxIds(null)}
                className="h-8 w-8 rounded-lg border border-[var(--border)] bg-[var(--warm)] flex items-center justify-center cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
              {inspectedTransactions.length === 0 ? (
                <p className="text-xs text-[var(--muted)] py-8 text-center">
                  No transactions in this selection.
                </p>
              ) : (
                inspectedTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--warm)]/50 p-3 text-xs space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-[var(--primary)]">
                          {tx.receiptNumber}
                        </span>
                        <span className="font-bold text-[var(--foreground)]">
                          {tx.customerName}
                        </span>
                        <Badge variant="neutral">{tx.paymentMethod}</Badge>
                      </div>
                      <span className="font-mono font-black text-[var(--foreground)]">
                        {formatPkr(tx.totalPaisa)}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--foreground-secondary)] flex flex-wrap justify-between gap-2">
                      <span>
                        {tx.datePk} {tx.timePk} • {tx.shiftLabel} • Sold by{" "}
                        {tx.soldByName}
                      </span>
                      {canViewProfitMargins && (
                        <span className="font-mono text-emerald-500 font-semibold">
                          Profit: {formatPkr(tx.profitPaisa)}
                        </span>
                      )}
                    </div>
                    {tx.items.length > 0 && (
                      <div className="pt-1 border-t border-[var(--border)]/60 text-[11px] text-[var(--foreground)]">
                        {tx.items
                          .map((i) => `${i.quantity}x ${i.name} (${formatPkr(i.revenuePaisa)})`)
                          .join(" • ")}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
