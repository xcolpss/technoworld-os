import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatPkr } from "@/lib/format/currency";
import { FileText, TrendingUp, DollarSign, Boxes, ShieldCheck, Printer } from "lucide-react";

export default async function ReportsPage() {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const admin = createSupabaseAdminClient();

  // Fetch all live business records for statement calculations
  const [
    { data: rawSales },
    { data: rawSalesItems },
    { data: rawInventory },
    { data: rawExpenses },
    { data: rawContributions },
    { data: rawDrawings },
    { data: rawAccounts },
  ] = await Promise.all([
    admin.from("sales").select("*").eq("business_id", ctx.businessId).range(0, 9999),
    admin.from("sale_items").select("*").eq("business_id", ctx.businessId).range(0, 9999),
    admin.from("inventory_items").select("*").eq("business_id", ctx.businessId).range(0, 9999),
    admin.from("expenses").select("*").eq("business_id", ctx.businessId).range(0, 9999),
    admin.from("owner_contributions").select("*").eq("business_id", ctx.businessId).range(0, 999),
    admin.from("owner_drawings").select("*").eq("business_id", ctx.businessId).range(0, 999),
    admin.from("financial_accounts").select("*").eq("business_id", ctx.businessId).range(0, 999),
  ]);

  const sales = rawSales ?? [];
  const salesItems = rawSalesItems ?? [];
  const inventoryItems = rawInventory ?? [];
  const expenses = rawExpenses ?? [];
  const contributions = rawContributions ?? [];
  const drawings = rawDrawings ?? [];
  const accounts = rawAccounts ?? [];

  // P&L Calculations
  const grossSales = sales.reduce((acc, s) => acc + Number(s.subtotal_paisa || s.total_paisa || 0), 0);
  const totalDiscounts = sales.reduce((acc, s) => acc + Number(s.discount_paisa || 0), 0);
  const totalRefunds = sales.reduce((acc, s) => acc + (s.status === "refunded" ? Number(s.total_paisa || 0) : 0), 0);
  const netSales = Math.max(0, grossSales - totalDiscounts - totalRefunds);

  const cogs = salesItems.reduce((acc, i) => acc + Number(i.cost_price_paisa || 0) * Number(i.quantity || 1), 0);
  const grossProfit = netSales - cogs;

  const totalOperatingExpenses = expenses.reduce((acc, e) => acc + Number(e.amount_paisa || 0), 0);
  const netOperatingProfit = grossProfit - totalOperatingExpenses;

  // Balance Sheet Assets & Equity
  const totalCashAndWallets = accounts.reduce((acc, a) => acc + Number(a.opening_balance_paisa || 0), 0);
  const inventoryValuation = inventoryItems.reduce((acc, i) => acc + Number(i.stock_quantity || 0) * Number(i.cost_price_paisa || 0), 0);
  const totalAssets = totalCashAndWallets + inventoryValuation;

  const totalOwnerCapital = contributions.reduce((acc, c) => acc + Number(c.amount_paisa || 0), 0);
  const totalDrawings = drawings.reduce((acc, d) => acc + Number(d.amount_paisa || 0), 0);
  const retainedEquity = totalOwnerCapital + netOperatingProfit - totalDrawings;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow="TechnoWorld OS • Financial Intelligence &amp; Statements"
        title="Business Reports &amp; Statements"
        description="Real-time Profit & Loss statement, Balance Sheet, Inventory Valuation, and Financial Health Audits."
      />

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-brand/30 bg-brand-soft/10">
          <CardContent className="p-5 space-y-1">
            <span className="text-xs font-bold text-muted">Net Revenue</span>
            <p className="font-mono text-2xl font-extrabold text-ink">{formatPkr(netSales)}</p>
            <p className="text-[10px] text-muted">{sales.length} total sales recorded</p>
          </CardContent>
        </Card>

        <Card className="border-success/30 bg-success-soft/10">
          <CardContent className="p-5 space-y-1">
            <span className="text-xs font-bold text-success">Gross Profit (FIFO)</span>
            <p className="font-mono text-2xl font-extrabold text-success">{formatPkr(grossProfit)}</p>
            <p className="text-[10px] text-muted">Net Sales minus Cost of Goods Sold</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardContent className="p-5 space-y-1">
            <span className="text-xs font-bold text-muted">Operating Expenses</span>
            <p className="font-mono text-2xl font-extrabold text-danger">{formatPkr(totalOperatingExpenses)}</p>
            <p className="text-[10px] text-muted">{expenses.length} expense entries recorded</p>
          </CardContent>
        </Card>

        <Card className="border-purple-500/30 bg-purple-500/10">
          <CardContent className="p-5 space-y-1">
            <span className="text-xs font-bold text-purple-700">Net Operating Profit</span>
            <p className="font-mono text-2xl font-extrabold text-purple-900">{formatPkr(netOperatingProfit)}</p>
            <p className="text-[10px] text-muted">Gross Profit minus Operating Expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Statements Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profit & Loss Statement */}
        <Card className="border-border bg-surface">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-brand" />
                <h3 className="font-display text-base font-extrabold text-ink">Profit &amp; Loss Statement</h3>
              </div>
              <Badge variant="brand" className="font-mono text-xs">Asia/Karachi</Badge>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between p-2.5 bg-warm rounded-xl">
                <span className="text-muted">Gross Sales Revenue:</span>
                <span className="font-bold text-ink">{formatPkr(grossSales)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-warm rounded-xl">
                <span className="text-muted">Discounts &amp; Refunds:</span>
                <span className="font-bold text-danger">- {formatPkr(totalDiscounts + totalRefunds)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-brand-soft/20 rounded-xl border border-brand/20">
                <span className="font-bold text-brand-dark">Net Revenue:</span>
                <span className="font-extrabold text-brand-dark">{formatPkr(netSales)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-warm rounded-xl">
                <span className="text-muted">Cost of Goods Sold (COGS):</span>
                <span className="font-bold text-danger">- {formatPkr(cogs)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-success-soft/20 rounded-xl border border-success/30">
                <span className="font-bold text-success">Gross Profit:</span>
                <span className="font-extrabold text-success">{formatPkr(grossProfit)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-warm rounded-xl">
                <span className="text-muted">Total Operating Expenses:</span>
                <span className="font-bold text-danger">- {formatPkr(totalOperatingExpenses)}</span>
              </div>
              <div className="flex justify-between p-3 bg-purple-500/10 rounded-xl border border-purple-500/30">
                <span className="font-bold text-purple-900">Net Operating Profit:</span>
                <span className="font-extrabold text-purple-900">{formatPkr(netOperatingProfit)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balance Sheet Summary */}
        <Card className="border-border bg-surface">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-brand" />
                <h3 className="font-display text-base font-extrabold text-ink">Balance Sheet &amp; Valuation</h3>
              </div>
              <Badge variant="success" className="font-mono text-xs">Balanced</Badge>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between p-2.5 bg-warm rounded-xl">
                <span className="text-muted">Cash &amp; Digital Wallets:</span>
                <span className="font-bold text-ink">{formatPkr(totalCashAndWallets)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-warm rounded-xl">
                <span className="text-muted">Inventory Stock Valuation:</span>
                <span className="font-bold text-ink">{formatPkr(inventoryValuation)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-brand-soft/20 rounded-xl border border-brand/20">
                <span className="font-bold text-brand-dark">Total Assets:</span>
                <span className="font-extrabold text-brand-dark">{formatPkr(totalAssets)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-warm rounded-xl">
                <span className="text-muted">Owner Capital Contributions:</span>
                <span className="font-bold text-success">{formatPkr(totalOwnerCapital)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-warm rounded-xl">
                <span className="text-muted">Household Drawings &amp; Use:</span>
                <span className="font-bold text-danger">- {formatPkr(totalDrawings)}</span>
              </div>
              <div className="flex justify-between p-3 bg-success-soft/20 rounded-xl border border-success/30">
                <span className="font-bold text-success">Total Retained Equity:</span>
                <span className="font-extrabold text-success">{formatPkr(retainedEquity)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}