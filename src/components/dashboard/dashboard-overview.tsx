"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Box,
  Calendar,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Flame,
  Layers,
  Monitor,
  Percent,
  ReceiptText,
  RefreshCw,
  Scale,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserCheck,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { formatPkr } from "@/lib/format/currency";

export interface DashboardMetrics {
  periodLabel: string;
  grossSalesPaisa: number;
  netSalesPaisa: number;
  grossProfitPaisa: number;
  netOperatingProfitPaisa: number;
  totalOperatingExpensesPaisa: number;
  totalRefundsPaisa: number;
  totalDiscountsPaisa: number;
  transactionCount: number;
  avgTransactionValuePaisa: number;
  liquidityPaisa: number;
  udhaarPaisa: number;
  morningRevenuePaisa: number;
  eveningRevenuePaisa: number;
  peakHourLabel: string;
  bestDayOfWeek: string;
}

export interface CategoryStat {
  category: string;
  revenuePaisa: number;
  txCount: number;
  quantitySold: number;
  grossProfitPaisa: number;
}

export interface ProductLeaderboardItem {
  name: string;
  category: string;
  unitsSold: number;
  revenuePaisa: number;
  cogsPaisa: number;
  grossProfitPaisa: number;
  marginPercent: number;
}

export interface BusinessAlertItem {
  id: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  message: string;
  timestamp: string;
}

export interface DashboardActivityItem {
  id: string;
  kind: "SALE" | "EXPENSE" | "REPAYMENT" | "SHIFT";
  title: string;
  subtitle: string;
  amountPaisa: number;
  timePk: string;
}

interface DashboardOverviewProps {
  metrics: DashboardMetrics;
  categories: CategoryStat[];
  topProducts: ProductLeaderboardItem[];
  alerts: BusinessAlertItem[];
  recentActivity: DashboardActivityItem[];
  activePeriod: string;
  customStartDate: string;
  customEndDate: string;
}

export function DashboardOverview({
  metrics,
  categories,
  topProducts,
  alerts,
  recentActivity,
  activePeriod,
  customStartDate,
  customEndDate,
}: DashboardOverviewProps) {
  const [period, setPeriod] = React.useState(activePeriod || "TODAY");
  const [startDate, setStartDate] = React.useState(customStartDate);
  const [endDate, setEndDate] = React.useState(customEndDate);

  function handlePeriodChange(newPeriod: string) {
    setPeriod(newPeriod);
    if (newPeriod !== "CUSTOM_RANGE") {
      window.location.href = `/dashboard?period=${newPeriod}`;
    }
  }

  function handleCustomRangeSubmit(e: React.FormEvent) {
    e.preventDefault();
    window.location.href = `/dashboard?period=CUSTOM_RANGE&start=${startDate}&end=${endDate}`;
  }

  return (
    <div className="space-y-6">
      {/* 1. GLOBAL DATE FILTER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-brand" />
          <div>
            <h3 className="font-display text-sm font-extrabold text-ink">
              Reporting Period: <span className="text-brand">{metrics.periodLabel}</span>
            </h3>
            <p className="text-xs text-muted">Asia/Karachi Timezone • Monday Week Start</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "TODAY", label: "Today" },
              { id: "YESTERDAY", label: "Yesterday" },
              { id: "THIS_WEEK", label: "This Week" },
              { id: "THIS_MONTH", label: "This Month" },
              { id: "THIS_YEAR", label: "This Year" },
              { id: "LIFETIME", label: "Lifetime" },
              { id: "CUSTOM_RANGE", label: "Custom Range" },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePeriodChange(p.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                period === p.id
                  ? "bg-brand text-white shadow-xs"
                  : "bg-warm text-muted hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {period === "CUSTOM_RANGE" && (
        <form
          onSubmit={handleCustomRangeSubmit}
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand/40 bg-brand-soft/20 p-4"
        >
          <div className="flex items-center gap-2">
            <Label className="text-xs font-bold">Start:</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 text-xs font-mono"
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs font-bold">End:</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 text-xs font-mono"
              required
            />
          </div>
          <Button type="submit" size="sm">
            Apply Date Range
          </Button>
        </form>
      )}

      {/* Quick Action Navigation Bar */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Link href="/pos">
          <Button className="h-11 w-full text-xs sm:text-sm font-extrabold shadow-sm">
            <ShoppingBag className="h-4 w-4" />
            Open POS Counter
          </Button>
        </Link>
        <Link href="/expenses">
          <Button variant="secondary" className="h-11 w-full text-xs sm:text-sm font-extrabold">
            <ReceiptText className="h-4 w-4" />
            Expenses &amp; Vault
          </Button>
        </Link>
        <Link href="/customers">
          <Button variant="secondary" className="h-11 w-full text-xs sm:text-sm font-extrabold">
            <UserCheck className="h-4 w-4" />
            Udhaar Ledger
          </Button>
        </Link>
        <Link href="/shifts">
          <Button variant="secondary" className="h-11 w-full text-xs sm:text-sm font-extrabold">
            <Monitor className="h-4 w-4" />
            Counter Shifts
          </Button>
        </Link>
      </div>

      {/* 2. FINANCIAL OVERVIEW CARDS (9 Core Metrics) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-brand/30 bg-brand-soft/15">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted">Gross Sales</span>
              <TrendingUp className="h-4 w-4 text-brand" />
            </div>
            <p className="font-mono text-2xl font-extrabold text-brand-dark">
              {formatPkr(metrics.grossSalesPaisa)}
            </p>
            <p className="text-[11px] text-muted">Total sales before discounts &amp; refunds</p>
          </CardContent>
        </Card>

        <Card className="border-brand/30 bg-surface">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted">Net Sales</span>
              <DollarSign className="h-4 w-4 text-brand" />
            </div>
            <p className="font-mono text-2xl font-extrabold text-ink">
              {formatPkr(metrics.netSalesPaisa)}
            </p>
            <p className="text-[11px] text-muted">Gross sales minus discounts &amp; refunds</p>
          </CardContent>
        </Card>

        <Card className="border-success/30 bg-success-soft/20">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-success">Gross Profit</span>
              <Activity className="h-4 w-4 text-success" />
            </div>
            <p className="font-mono text-2xl font-extrabold text-success">
              {formatPkr(metrics.grossProfitPaisa)}
            </p>
            <p className="text-[11px] text-muted">Net sales minus cost of goods sold (COGS)</p>
          </CardContent>
        </Card>

        <Card className="border-brand/30 bg-surface">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted">Net Operating Profit</span>
              <Trophy className="h-4 w-4 text-brand" />
            </div>
            <p className="font-mono text-2xl font-extrabold text-ink">
              {formatPkr(metrics.netOperatingProfitPaisa)}
            </p>
            <p className="text-[11px] text-muted">Gross profit minus operating expenses</p>
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger-soft/20">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-danger">Operating Expenses</span>
              <TrendingDown className="h-4 w-4 text-danger" />
            </div>
            <p className="font-mono text-2xl font-extrabold text-danger">
              {formatPkr(metrics.totalOperatingExpensesPaisa)}
            </p>
            <p className="text-[11px] text-muted">Shop rent, utilities, paper, toner, salary</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted">Refunds &amp; Discounts</span>
              <RefreshCw className="h-4 w-4 text-muted" />
            </div>
            <p className="font-mono text-lg font-extrabold text-ink">
              Ref: {formatPkr(metrics.totalRefundsPaisa)} | Disc: {formatPkr(metrics.totalDiscountsPaisa)}
            </p>
            <p className="text-[11px] text-muted">Total returned items &amp; price concessions</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted">Transactions &amp; AOV</span>
              <ShoppingBag className="h-4 w-4 text-brand" />
            </div>
            <p className="font-mono text-lg font-extrabold text-ink">
              {metrics.transactionCount} Txns | AOV: {formatPkr(metrics.avgTransactionValuePaisa)}
            </p>
            <p className="text-[11px] text-muted">Total bills checked out &amp; average ticket size</p>
          </CardContent>
        </Card>

        <Card className="border-success/30 bg-success-soft/10">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-success">Total Liquidity</span>
              <Wallet className="h-4 w-4 text-success" />
            </div>
            <p className="font-mono text-xl font-extrabold text-success">
              {formatPkr(metrics.liquidityPaisa)}
            </p>
            <p className="text-[11px] text-muted">Actual available cash &amp; digital balances</p>
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger-soft/10">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-danger">Uncollected Udhaar</span>
              <CreditCard className="h-4 w-4 text-danger" />
            </div>
            <p className="font-mono text-xl font-extrabold text-danger">
              {formatPkr(metrics.udhaarPaisa)}
            </p>
            <p className="text-[11px] text-muted">Customer credit pending repayment</p>
          </CardContent>
        </Card>
      </div>

      {/* 5. SHIFT PERFORMANCE & 4. CATEGORY BREAKDOWN */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* SHIFT PERFORMANCE */}
        <div className="lg:col-span-6 space-y-4">
          <h2 className="font-display text-base font-extrabold text-ink flex items-center gap-2">
            <Clock className="h-5 w-5 text-brand" />
            Shift Performance (Morning vs. Evening)
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <Card className="border-brand/40 bg-brand-soft/10">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-bold text-muted">Morning Shift (08:00–16:00)</span>
                <p className="font-mono text-xl font-extrabold text-brand-dark">
                  {formatPkr(metrics.morningRevenuePaisa)}
                </p>
                <p className="text-[11px] text-muted">Registered morning sales</p>
              </CardContent>
            </Card>

            <Card className="border-brand/40 bg-brand-soft/10">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-bold text-muted">Evening Shift (16:00–00:00)</span>
                <p className="font-mono text-xl font-extrabold text-brand-dark">
                  {formatPkr(metrics.eveningRevenuePaisa)}
                </p>
                <p className="text-[11px] text-muted">Registered evening sales</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-bold text-muted flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5 text-warning" /> Peak Traffic Window
                </span>
                <p className="font-mono text-lg font-extrabold text-ink">
                  {metrics.peakHourLabel}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-1">
                <span className="text-xs font-bold text-muted flex items-center gap-1">
                  <Trophy className="h-3.5 w-3.5 text-brand" /> Best Revenue Day
                </span>
                <p className="font-mono text-lg font-extrabold text-ink">
                  {metrics.bestDayOfWeek}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 4. SALES CATEGORY BREAKDOWN */}
        <div className="lg:col-span-6 space-y-4">
          <h2 className="font-display text-base font-extrabold text-ink flex items-center gap-2">
            <Layers className="h-5 w-5 text-brand" />
            Sales Category Breakdown
          </h2>

          <Card>
            <CardContent className="p-4">
              {categories.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted">No category data recorded for this period.</p>
              ) : (
                <div className="space-y-3">
                  {categories.map((cat) => (
                    <div key={cat.category} className="flex items-center justify-between border-b border-border pb-2.5 text-xs">
                      <div>
                        <p className="font-bold text-ink">{cat.category}</p>
                        <p className="text-[11px] text-muted">
                          {cat.txCount} txns • {cat.quantitySold} units sold
                        </p>
                      </div>
                      <div className="text-right font-mono">
                        <p className="font-extrabold text-brand-dark">{formatPkr(cat.revenuePaisa)}</p>
                        <p className="text-[11px] text-success">GP: {formatPkr(cat.grossProfitPaisa)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 6. PRODUCT & SERVICE LEADERBOARDS & 11. BUSINESS ALERTS */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* PRODUCT PERFORMANCE LEADERBOARD */}
        <div className="lg:col-span-7 space-y-4">
          <h2 className="font-display text-base font-extrabold text-ink flex items-center gap-2">
            <Box className="h-5 w-5 text-brand" />
            Top Demanded Products &amp; Accessories
          </h2>

          {topProducts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-xs text-muted">
                No product sales recorded for this period.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {topProducts.map((p, idx) => (
                <Card key={`${p.name}-${idx}`} className="hover:border-brand/40 transition">
                  <CardContent className="p-3.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-warm font-mono font-extrabold text-muted">
                        #{idx + 1}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-bold text-ink truncate">{p.name}</p>
                        <p className="text-[11px] text-muted">
                          {p.category} • Sold: <strong className="text-brand">{p.unitsSold}</strong> • Margin: <strong className="text-success">{p.marginPercent.toFixed(1)}%</strong>
                        </p>
                      </div>
                    </div>
                    <div className="text-right font-mono shrink-0">
                      <p className="font-extrabold text-brand-dark">{formatPkr(p.revenuePaisa)}</p>
                      <p className="text-[11px] text-success">GP: {formatPkr(p.grossProfitPaisa)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* 11. INTELLIGENT BUSINESS ALERTS & 12. LIVE ACTIVITY */}
        <div className="lg:col-span-5 space-y-4">
          <h2 className="font-display text-base font-extrabold text-ink flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Intelligent Business Alerts
          </h2>

          <Card className="border-warning/30 bg-warning-soft/10">
            <CardContent className="p-4 space-y-3">
              {alerts.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted">No active business alerts. All systems nominal.</p>
              ) : (
                alerts.map((al) => (
                  <div key={al.id} className="rounded-xl border border-warning/40 bg-surface p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink">{al.title}</span>
                      <Badge variant={al.severity === "HIGH" ? "danger" : "warning"}>{al.severity}</Badge>
                    </div>
                    <p className="text-muted">{al.message}</p>
                    <p className="text-[10px] text-muted">{al.timestamp}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <h2 className="font-display text-base font-extrabold text-ink flex items-center gap-2 pt-2">
            <ReceiptText className="h-5 w-5 text-brand" />
            Live Shop Activity Feed
          </h2>

          <Card>
            <CardContent className="p-4 space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {recentActivity.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted">No recent activity recorded.</p>
              ) : (
                recentActivity.map((act) => (
                  <div key={act.id} className="flex items-center justify-between border-b border-border pb-2 text-xs">
                    <div>
                      <p className="font-bold text-ink">{act.title}</p>
                      <p className="text-[10px] text-muted">{act.subtitle} • {act.timePk}</p>
                    </div>
                    <span className="font-mono font-extrabold text-brand-dark">{formatPkr(act.amountPaisa)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}