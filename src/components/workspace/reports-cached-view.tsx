"use client";

import * as React from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { SectionRefreshButton } from "@/components/ui/section-refresh-button";
import { WorkspaceSectionSkeleton } from "@/components/ui/workspace-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AllocationStackedBar,
  MetricBarChart,
} from "@/components/ui/mini-charts";
import { AccessRestricted } from "@/components/auth/access-restricted";
import { hasRequiredRole } from "@/lib/auth/permissions";
import { useWorkspaceUser } from "@/lib/workspace/context";
import { formatPkr } from "@/lib/format/currency";
import { fetchWorkspaceApi, workspaceQueryKeys } from "@/lib/query/cache-keys";
import { Calendar, DollarSign, Info, Layers, TrendingUp } from "lucide-react";

interface ReportsPayload {
  dateRange: {
    period: string;
    label: string;
    startDate: string;
    endDate: string;
    dayCount: number;
  };
  accessoriesOnly: boolean;
  grossSales: number;
  totalDiscounts: number;
  totalRefunds: number;
  salesCount: number;
  unitsSold: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  totalOperatingExpenses: number;
  expenseCount: number;
  netOperatingProfit: number;
  netMarginPct: number;
  excludedServiceSales: number;
  excludedServiceLines: number;
  categoryBreakdown: Array<{
    category: string;
    revenue: number;
    cogs: number;
    grossProfit: number;
    units: number;
  }>;
  totalCashAndWallets: number;
  inventoryValuation: number;
  totalAssets: number;
  totalOwnerCapital: number;
  totalDrawings: number;
  retainedEquity: number;
}

const REPORT_PERIODS = [
  { key: "daily", label: "Daily (Today)" },
  { key: "weekly", label: "Weekly (7 Days)" },
  { key: "this_month", label: "Monthly (This Month)" },
  { key: "last_month", label: "Previous Month" },
  { key: "lifetime", label: "All Time" },
  { key: "custom", label: "Custom Range" },
] as const;

export function ReportsCachedView() {
  const user = useWorkspaceUser();
  const allowed = hasRequiredRole(user.role, ["OWNER", "MANAGER"]);
  const queryClient = useQueryClient();

  const [period, setPeriod] = React.useState<string>("this_month");
  const [start, setStart] = React.useState<string>("");
  const [end, setEnd] = React.useState<string>("");
  const [draftStart, setDraftStart] = React.useState<string>("");
  const [draftEnd, setDraftEnd] = React.useState<string>("");
  const [showCustom, setShowCustom] = React.useState<boolean>(false);

  const buildPath = (p: string, s: string, e: string) => {
    const params = new URLSearchParams({ period: p });
    if (p === "custom" && s && e) {
      params.set("start", s);
      params.set("end", e);
    }
    return `reports?${params.toString()}`;
  };

  const queryKey = workspaceQueryKeys.reports(period, start, end);

  const { data, isPending, isFetching, dataUpdatedAt } =
    useQuery<ReportsPayload>({
      queryKey,
      queryFn: () => fetchWorkspaceApi<ReportsPayload>(buildPath(period, start, end)),
      placeholderData: keepPreviousData,
      enabled: allowed,
    });

  const effectiveDraftStart = draftStart || data?.dateRange?.startDate || "";
  const effectiveDraftEnd = draftEnd || data?.dateRange?.endDate || "";

  if (!allowed) {
    return (
      <AccessRestricted
        currentRole={user.role}
        requiredRoles={["OWNER", "MANAGER"]}
        sectionName="Financial & Business Reports"
      />
    );
  }

  const handleForceRefresh = async () => {
    const fresh = await queryClient.fetchQuery({
      queryKey,
      queryFn: () =>
        fetchWorkspaceApi<ReportsPayload>(buildPath(period, start, end), {
          fresh: true,
        }),
      staleTime: 0,
    });
    queryClient.setQueryData(queryKey, fresh);
  };

  const handleSelectPeriod = (nextKey: string) => {
    if (nextKey === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    setPeriod(nextKey);
    setStart("");
    setEnd("");
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveDraftStart || !effectiveDraftEnd) return;
    setPeriod("custom");
    setStart(effectiveDraftStart);
    setEnd(effectiveDraftEnd);
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow="TechnoWorld OS • Accessories Profit & Loss Statements"
        title="Business Reports & Accessories P&L"
        description="Real-time Profit & Loss statement dedicated exclusively to Accessories sales & costs (Movies, Printing & Composing excluded cleanly)."
        actions={
          <SectionRefreshButton
            onRefresh={handleForceRefresh}
            isFetching={isFetching}
            lastUpdatedAt={dataUpdatedAt}
          />
        }
      />

      {/* Period Selection Bar (Daily, Weekly, Monthly, Custom) */}
      <Card>
        <CardContent className="p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {REPORT_PERIODS.map((opt) => {
                const isActive =
                  (opt.key === "custom" && showCustom) ||
                  (period === opt.key && (!showCustom || opt.key === "custom"));
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleSelectPeriod(opt.key)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                      isActive
                        ? "bg-[var(--primary)] text-white shadow-xs"
                        : "border border-[var(--border)] bg-[var(--warm)] text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {data?.dateRange && (
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--foreground-secondary)]">
                <Calendar className="h-3.5 w-3.5 text-[var(--primary)]" />
                <span>
                  {data.dateRange.startDate} → {data.dateRange.endDate} ({data.dateRange.dayCount}d)
                </span>
              </div>
            )}
          </div>

          {showCustom && (
            <form
              onSubmit={handleApplyCustom}
              className="flex flex-wrap items-end gap-2.5 pt-2 border-t border-[var(--border)]"
            >
              <div>
                <span className="block text-[10px] font-bold uppercase text-[var(--muted)] mb-1">
                  From (PKT)
                </span>
                <Input
                  type="date"
                  value={effectiveDraftStart}
                  onChange={(e) => setDraftStart(e.target.value)}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-[var(--muted)] mb-1">
                  To (PKT)
                </span>
                <Input
                  type="date"
                  value={effectiveDraftEnd}
                  onChange={(e) => setDraftEnd(e.target.value)}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>
              <Button type="submit" size="sm">
                Apply Date Range
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {isPending && !data ? (
        <WorkspaceSectionSkeleton cards={4} rows={6} />
      ) : data ? (
        <>
          {/* Scope Notice Banner */}
          <Card className="border-[var(--primary)]/25 bg-[var(--brand-soft)]/25">
            <CardContent className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-[var(--foreground)] font-semibold">
                <Info className="h-4 w-4 text-[var(--primary)] shrink-0" />
                <span>
                  <strong>Accessories-Only P&amp;L Mode Active:</strong> Showing{" "}
                  {data.unitsSold} accessory units across {data.salesCount} bills. Movies, Printing &amp; Composing records remain preserved in DB ({data.excludedServiceLines} service lines / {formatPkr(data.excludedServiceSales)} excluded from P&amp;L).
                </span>
              </div>
              <Badge variant="brand" className="font-mono text-[10px]">
                ACCESSORIES ONLY
              </Badge>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-brand/30 bg-brand-soft/10">
              <CardContent className="p-4 sm:p-5 space-y-1">
                <span className="text-xs font-bold text-muted">
                  Net Accessory Revenue
                </span>
                <p className="font-mono text-xl sm:text-2xl font-extrabold text-ink">
                  {formatPkr(data.netSales)}
                </p>
                <p className="text-[10px] text-muted">
                  {data.unitsSold} units • {data.salesCount} accessory bills
                </p>
              </CardContent>
            </Card>

            <Card className="border-success/30 bg-success-soft/10">
              <CardContent className="p-4 sm:p-5 space-y-1">
                <span className="text-xs font-bold text-success">
                  Accessory Gross Profit ({data.grossMarginPct}%)
                </span>
                <p className="font-mono text-xl sm:text-2xl font-extrabold text-success">
                  {formatPkr(data.grossProfit)}
                </p>
                <p className="text-[10px] text-muted">
                  Accessory Revenue minus COGS ({formatPkr(data.cogs)})
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-surface">
              <CardContent className="p-4 sm:p-5 space-y-1">
                <span className="text-xs font-bold text-muted">
                  Operating Expenses ({data.dateRange.label})
                </span>
                <p className="font-mono text-xl sm:text-2xl font-extrabold text-danger">
                  {formatPkr(data.totalOperatingExpenses)}
                </p>
                <p className="text-[10px] text-muted">
                  {data.expenseCount} expense entries recorded
                </p>
              </CardContent>
            </Card>

            <Card className="border-purple-500/30 bg-purple-500/10">
              <CardContent className="p-4 sm:p-5 space-y-1">
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                  Net Accessory Profit ({data.netMarginPct}%)
                </span>
                <p className="font-mono text-xl sm:text-2xl font-extrabold text-purple-900 dark:text-purple-200">
                  {formatPkr(data.netOperatingProfit)}
                </p>
                <p className="text-[10px] text-muted">
                  Accessory Gross Profit minus Expenses
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            <Card className="lg:col-span-7">
              <CardContent className="p-4 sm:p-6">
                <MetricBarChart
                  title={`Accessories P&L Breakdown (${data.dateRange.label})`}
                  subtitle="Exclusive view of Accessories revenue, COGS, operating expenses & profit"
                  height={176}
                  data={[
                    {
                      label: "Acc. Revenue",
                      value: data.netSales,
                      formattedValue: formatPkr(data.netSales),
                      tone: "brand",
                    },
                    {
                      label: "Gross Profit",
                      value: Math.max(0, data.grossProfit),
                      formattedValue: formatPkr(data.grossProfit),
                      tone: "success",
                    },
                    {
                      label: "Acc. COGS",
                      value: data.cogs,
                      formattedValue: formatPkr(data.cogs),
                      tone: "neutral",
                    },
                    {
                      label: "OpEx",
                      value: data.totalOperatingExpenses,
                      formattedValue: formatPkr(data.totalOperatingExpenses),
                      tone: "danger",
                    },
                    {
                      label: "Net Profit",
                      value: Math.max(0, data.netOperatingProfit),
                      formattedValue: formatPkr(data.netOperatingProfit),
                      tone: "info",
                    },
                  ]}
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-5">
              <CardContent className="p-4 sm:p-6 flex flex-col justify-center space-y-6">
                <div className="space-y-1">
                  <h3 className="font-display text-sm sm:text-base font-extrabold text-[var(--foreground)]">
                    Asset &amp; Equity Composition
                  </h3>
                  <p className="text-[11px] text-[var(--foreground-secondary)]">
                    Balance sheet distribution across liquid wallets and physical stock
                  </p>
                </div>
                <AllocationStackedBar
                  title="Total Assets Mix"
                  segments={[
                    {
                      label: "Cash & Wallets",
                      value: data.totalCashAndWallets,
                      formattedValue: formatPkr(data.totalCashAndWallets),
                      tone: "info",
                    },
                    {
                      label: "Inventory Value",
                      value: data.inventoryValuation,
                      formattedValue: formatPkr(data.inventoryValuation),
                      tone: "brand",
                    },
                  ]}
                />
                <AllocationStackedBar
                  title="Capital vs Drawings"
                  segments={[
                    {
                      label: "Owner Capital",
                      value: data.totalOwnerCapital,
                      formattedValue: formatPkr(data.totalOwnerCapital),
                      tone: "success",
                    },
                    {
                      label: "Drawings",
                      value: data.totalDrawings,
                      formattedValue: formatPkr(data.totalDrawings),
                      tone: "danger",
                    },
                  ]}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border bg-surface">
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-brand shrink-0" />
                    <h3 className="font-display text-sm sm:text-base font-extrabold text-ink">
                      Accessories Profit &amp; Loss Statement
                    </h3>
                  </div>
                  <Badge variant="brand" className="font-mono text-xs">
                    {data.dateRange.label}
                  </Badge>
                </div>

                <div className="space-y-2.5 text-xs font-mono">
                  <div className="flex flex-wrap items-center justify-between gap-1 p-2.5 bg-warm rounded-xl">
                    <span className="text-muted">Gross Accessory Sales:</span>
                    <span className="font-bold text-ink">{formatPkr(data.grossSales)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1 p-2.5 bg-warm rounded-xl">
                    <span className="text-muted">Discounts Applied:</span>
                    <span className="font-bold text-danger">
                      - {formatPkr(data.totalDiscounts + data.totalRefunds)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1 p-2.5 bg-brand-soft/20 rounded-xl border border-brand/20">
                    <span className="font-bold text-brand-dark">Net Accessory Revenue:</span>
                    <span className="font-extrabold text-brand-dark">{formatPkr(data.netSales)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1 p-2.5 bg-warm rounded-xl">
                    <span className="text-muted">Accessory Purchase Cost (COGS):</span>
                    <span className="font-bold text-danger">- {formatPkr(data.cogs)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1 p-2.5 bg-success-soft/20 rounded-xl border border-success/30">
                    <span className="font-bold text-success">
                      Accessory Gross Profit ({data.grossMarginPct}%):
                    </span>
                    <span className="font-extrabold text-success">{formatPkr(data.grossProfit)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1 p-2.5 bg-warm rounded-xl">
                    <span className="text-muted">Operating Expenses:</span>
                    <span className="font-bold text-danger">
                      - {formatPkr(data.totalOperatingExpenses)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1 p-3 bg-purple-500/10 rounded-xl border border-purple-500/30">
                    <span className="font-bold text-purple-900 dark:text-purple-200">
                      Net Accessory Operating Profit ({data.netMarginPct}%):
                    </span>
                    <span className="font-extrabold text-purple-900 dark:text-purple-200">
                      {formatPkr(data.netOperatingProfit)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-surface">
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-brand shrink-0" />
                    <h3 className="font-display text-sm sm:text-base font-extrabold text-ink">
                      Balance Sheet &amp; Stock Valuation
                    </h3>
                  </div>
                  <Badge variant="success" className="font-mono text-xs">
                    Balanced
                  </Badge>
                </div>

                <div className="space-y-2.5 text-xs font-mono">
                  <div className="flex flex-wrap items-center justify-between gap-1 p-2.5 bg-warm rounded-xl">
                    <span className="text-muted">Cash &amp; Digital Wallets:</span>
                    <span className="font-bold text-ink">
                      {formatPkr(data.totalCashAndWallets)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1 p-2.5 bg-warm rounded-xl">
                    <span className="text-muted">Accessories Stock Valuation (Cost):</span>
                    <span className="font-bold text-ink">
                      {formatPkr(data.inventoryValuation)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1 p-2.5 bg-brand-soft/20 rounded-xl border border-brand/20">
                    <span className="font-bold text-brand-dark">Total Assets:</span>
                    <span className="font-extrabold text-brand-dark">
                      {formatPkr(data.totalAssets)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1 p-2.5 bg-warm rounded-xl">
                    <span className="text-muted">Owner Capital Contributions:</span>
                    <span className="font-bold text-success">
                      {formatPkr(data.totalOwnerCapital)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1 p-2.5 bg-warm rounded-xl">
                    <span className="text-muted">Household Drawings &amp; Use:</span>
                    <span className="font-bold text-danger">
                      - {formatPkr(data.totalDrawings)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1 p-3 bg-success-soft/20 rounded-xl border border-success/30">
                    <span className="font-bold text-success">Total Retained Equity:</span>
                    <span className="font-extrabold text-success">
                      {formatPkr(data.retainedEquity)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Accessories Category Profit Breakdown */}
          <Card className="border-border bg-surface">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-brand shrink-0" />
                  <h3 className="font-display text-sm sm:text-base font-extrabold text-ink">
                    Accessories Profit by Category ({data.dateRange.label})
                  </h3>
                </div>
                <Badge className="font-mono text-xs">
                  {data.categoryBreakdown.length} Accessory Categories
                </Badge>
              </div>
              {data.categoryBreakdown.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted">
                  No accessory sales recorded in this date range.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-warm/60 text-muted uppercase">
                        <th className="py-2.5 px-3 font-bold">Category</th>
                        <th className="py-2.5 px-3 text-right font-bold">Units</th>
                        <th className="py-2.5 px-3 text-right font-bold">Revenue</th>
                        <th className="py-2.5 px-3 text-right font-bold">Cost (COGS)</th>
                        <th className="py-2.5 px-3 text-right font-bold">Gross Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono">
                      {data.categoryBreakdown.map((cat) => (
                        <tr key={cat.category} className="hover:bg-warm/40">
                          <td className="py-2.5 px-3 font-sans font-bold text-ink">
                            {cat.category}
                          </td>
                          <td className="py-2.5 px-3 text-right">{cat.units}</td>
                          <td className="py-2.5 px-3 text-right font-bold">
                            {formatPkr(cat.revenue)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-rose-500">
                            {formatPkr(cat.cogs)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-emerald-500">
                            {formatPkr(cat.grossProfit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
