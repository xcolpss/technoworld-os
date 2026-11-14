import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatPkr } from "@/lib/format/currency";
import {
  TrendingUp,
  DollarSign,
  Boxes,
  ShieldCheck,
  RefreshCcw,
  ArrowRight,
  Clock,
  Wallet,
  AlertTriangle,
  Users2,
  Receipt,
  Activity,
  BarChart3,
  PieChart,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
} from "lucide-react";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { period?: string; start?: string; end?: string };
}) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const admin = createSupabaseAdminClient();
  const period = searchParams.period || "this_month";

  // Date range calculation based on period (Asia/Karachi timezone logic)
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date(now);
  let prevStartDate = new Date();
  let prevEndDate = new Date();

  if (period === "today") {
    startDate.setHours(0, 0, 0, 0);
    prevStartDate.setDate(prevStartDate.getDate() - 1);
    prevStartDate.setHours(0, 0, 0, 0);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    prevEndDate.setHours(23, 59, 59, 999);
  } else if (period === "yesterday") {
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    endDate.setDate(endDate.getDate() - 1);
    endDate.setHours(23, 59, 59, 999);
    prevStartDate.setDate(prevStartDate.getDate() - 2);
    prevStartDate.setHours(0, 0, 0, 0);
    prevEndDate.setDate(prevEndDate.getDate() - 2);
    prevEndDate.setHours(23, 59, 59, 999);
  } else if (period === "this_week") {
    const day = startDate.getDay();
    const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    startDate.setDate(diff);
    startDate.setHours(0, 0, 0, 0);
    prevStartDate.setDate(startDate.getDate() - 7);
    prevEndDate.setDate(startDate.getDate() - 1);
    prevEndDate.setHours(23, 59, 59, 999);
  } else if (period === "this_year") {
    startDate = new Date(now.getFullYear(), 0, 1);
    prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
    prevEndDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
  } else if (period === "lifetime") {
    startDate = new Date(2020, 0, 1);
    prevStartDate = new Date(2019, 0, 1);
    prevEndDate = new Date(2019, 11, 31, 23, 59, 59, 999);
  } else {
    // Default: This Month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  }

  // Fetch all core datasets in parallel for lightning-fast server rendering
  const [
    { data: rawSales },
    { data: rawSaleItems },
    { data: rawInventory },
    { data: rawExpenses },
    { data: rawAccounts },
    { data: rawShifts },
    { data: rawEmployees },
    { data: rawAuditLogs },
  ] = await Promise.all([
    admin.from("sales").select("*").eq("business_id", ctx.businessId).gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
    admin.from("sale_items").select("*").eq("business_id", ctx.businessId),
    admin.from("inventory_items").select("*").eq("business_id", ctx.businessId),
    admin.from("expenses").select("*").eq("business_id", ctx.businessId).gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
    admin.from("financial_accounts").select("*").eq("business_id", ctx.businessId),
    admin.from("cash_sessions").select("*").eq("business_id", ctx.businessId),
    admin.from("employees").select("*").eq("business_id", ctx.businessId),
    admin.from("audit_logs").select("*").eq("business_id", ctx.businessId).order("created_at", { ascending: false }).limit(20),
  ]);

  const sales = rawSales ?? [];
  const saleItems = rawSaleItems ?? [];
  const inventory = rawInventory ?? [];
  const expenses = rawExpenses ?? [];
  const accounts = rawAccounts ?? [];
  const shifts = rawShifts ?? [];
  const employees = rawEmployees ?? [];
  const auditLogs = rawAuditLogs ?? [];

  // Financial KPI calculations
  const grossSales = sales.reduce((acc, s) => acc + Number(s.subtotal_paisa || s.total_paisa || 0), 0);
  const totalDiscounts = sales.reduce((acc, s) => acc + Number(s.discount_paisa || 0), 0);
  const totalRefunds = sales.reduce((acc, s) => acc + (s.status === "refunded" ? Number(s.total_paisa || 0) : 0), 0);
  const netSales = Math.max(0, grossSales - totalDiscounts - totalRefunds);
  
  const cogs = saleItems.reduce((acc, i) => acc + Number(i.cost_price_paisa || 0) * Number(i.quantity || 1), 0);
  const grossProfit = netSales - cogs;
  const totalOperatingExpenses = expenses.reduce((acc, e) => acc + Number(e.amount_paisa || 0), 0);
  const netOperatingProfit = grossProfit - totalOperatingExpenses;
  const totalTransactions = sales.length;
  const avgTransactionValue = totalTransactions > 0 ? Math.round(netSales / totalTransactions) : 0;

  // Liquidity breakdown
  const totalLiquidity = accounts.reduce((acc, a) => acc + Number(a.opening_balance_paisa || 0), 0);
  const cashDrawerBalance = accounts.filter(a => a.account_type === 'cash').reduce((acc, a) => acc + Number(a.opening_balance_paisa || 0), 0);
  const bankBalance = accounts.filter(a => a.account_type === 'bank').reduce((acc, a) => acc + Number(a.opening_balance_paisa || 0), 0);
  const walletBalance = accounts.filter(a => ['easypaisa', 'jazzcash', 'wallet'].includes(a.account_type)).reduce((acc, a) => acc + Number(a.opening_balance_paisa || 0), 0);

  // Inventory Valuation (FIFO Cost)
  const inventoryFifoValuation = inventory.reduce((acc, i) => acc + Number(i.stock_quantity || 0) * Number(i.cost_price_paisa || 0), 0);
  const lowStockItems = inventory.filter(i => Number(i.stock_quantity || 0) <= Number(i.min_stock_level || 5));
  const outOfStockItems = inventory.filter(i => Number(i.stock_quantity || 0) <= 0);

  // Shift performance split (Morning 08:00-16:00 vs Evening 16:00-00:00)
  const morningSales = sales.filter(s => {
    const hour = new Date(s.created_at).getHours();
    return hour >= 8 && hour < 16;
  });
  const eveningSales = sales.filter(s => {
    const hour = new Date(s.created_at).getHours();
    return hour >= 16 || hour < 8;
  });

  const morningRevenue = morningSales.reduce((acc, s) => acc + Number(s.total_paisa || 0), 0);
  const eveningRevenue = eveningSales.reduce((acc, s) => acc + Number(s.total_paisa || 0), 0);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">

      {/* DAILY CLOSING & ACCOUNTANT SUITE PROMINENT CARD */}
      <Card className="border-[var(--primary)]/40 bg-[var(--primary)]/5 shadow-xs">
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center font-black text-lg shadow-sm">
              <span className="font-mono">DC</span>
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">Daily Closing &amp; Accountant Reports</h3>
              <p className="text-xs text-[var(--foreground-secondary)] mt-0.5">Prepare daily accounts, record wages and expenses, reconcile cash, and export your daily report.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link href="/dashboard/closing" className="w-full sm:w-auto">
              <Button className="w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs gap-2">
                Create Daily Closing <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    
      {/* EXISTING KPI CARDS */}

      {/* SECTION 1: Header & Global Date Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <PageHeader
          eyebrow="TechnoWorld OS â€¢ Business Intelligence &amp; Executive Dashboard"
          title="Owner Dashboard &amp; Analytics"
          description="Comprehensive real-time financial tracking, shift audits, FIFO inventory intelligence, and financial liquidity."
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-1 text-xs font-semibold">
            <Link href="/dashboard?period=today" className={`px-3 py-1.5 rounded-lg transition ${period === 'today' ? 'bg-[var(--primary)] text-white shadow-xs' : 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'}`}>Today</Link>
            <Link href="/dashboard?period=yesterday" className={`px-3 py-1.5 rounded-lg transition ${period === 'yesterday' ? 'bg-[var(--primary)] text-white shadow-xs' : 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'}`}>Yesterday</Link>
            <Link href="/dashboard?period=this_week" className={`px-3 py-1.5 rounded-lg transition ${period === 'this_week' ? 'bg-[var(--primary)] text-white shadow-xs' : 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'}`}>This Week</Link>
            <Link href="/dashboard?period=this_month" className={`px-3 py-1.5 rounded-lg transition ${period === 'this_month' ? 'bg-[var(--primary)] text-white shadow-xs' : 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'}`}>This Month</Link>
            <Link href="/dashboard?period=this_year" className={`px-3 py-1.5 rounded-lg transition ${period === 'this_year' ? 'bg-[var(--primary)] text-white shadow-xs' : 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'}`}>This Year</Link>
            <Link href="/dashboard?period=lifetime" className={`px-3 py-1.5 rounded-lg transition ${period === 'lifetime' ? 'bg-[var(--primary)] text-white shadow-xs' : 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'}`}>Lifetime</Link>
          </div>
          <Badge variant="success" className="font-mono text-xs px-3 py-2 shadow-xs">
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5 inline" /> Asia/Karachi (PKT)
          </Badge>
          <Link href="/dashboard">
            <Button variant="secondary" size="sm" className="gap-2">
              <RefreshCcw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </Link>
        </div>
      </div>

      {/* SECTION 2: Financial KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">Gross Sales</span>
            <p className="font-mono text-xl font-extrabold text-[var(--foreground)]">{formatPkr(grossSales)}</p>
            <p className="text-[10px] text-[var(--foreground-secondary)]">{totalTransactions} total transactions</p>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">Net Sales</span>
            <p className="font-mono text-xl font-extrabold text-[var(--primary)]">{formatPkr(netSales)}</p>
            <p className="text-[10px] text-[var(--foreground-secondary)]">Excl. discounts &amp; refunds</p>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">Gross Profit (FIFO)</span>
            <p className="font-mono text-xl font-extrabold text-[var(--success)]">{formatPkr(grossProfit)}</p>
            <p className="text-[10px] text-[var(--foreground-secondary)]">Net Sales minus COGS</p>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">Net Operating Profit</span>
            <p className="font-mono text-xl font-extrabold text-[var(--info)]">{formatPkr(netOperatingProfit)}</p>
            <p className="text-[10px] text-[var(--foreground-secondary)]">After operating expenses</p>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">Operating Expenses</span>
            <p className="font-mono text-xl font-extrabold text-[var(--danger)]">{formatPkr(totalOperatingExpenses)}</p>
            <p className="text-[10px] text-[var(--foreground-secondary)]">{expenses.length} expense records</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">Cost of Goods Sold</span>
            <p className="font-mono text-xl font-extrabold text-[var(--foreground)]">{formatPkr(cogs)}</p>
            <p className="text-[10px] text-[var(--foreground-secondary)]">FIFO item valuation</p>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">Total Refunds</span>
            <p className="font-mono text-xl font-extrabold text-[var(--danger)]">{formatPkr(totalRefunds)}</p>
            <p className="text-[10px] text-[var(--foreground-secondary)]">Returned transactions</p>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">Total Discounts</span>
            <p className="font-mono text-xl font-extrabold text-[var(--warning)]">{formatPkr(totalDiscounts)}</p>
            <p className="text-[10px] text-[var(--foreground-secondary)]">Promotional markdowns</p>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">Total Transactions</span>
            <p className="font-mono text-xl font-extrabold text-[var(--foreground)]">{totalTransactions}</p>
            <p className="text-[10px] text-[var(--foreground-secondary)]">Completed checkouts</p>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-[var(--foreground-secondary)] uppercase tracking-wider">Avg Transaction Value</span>
            <p className="font-mono text-xl font-extrabold text-[var(--foreground)]">{formatPkr(avgTransactionValue)}</p>
            <p className="text-[10px] text-[var(--foreground-secondary)]">Per completed sale</p>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 5: Morning vs Evening Shift Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2.5">
                <Clock className="h-5 w-5 text-[var(--primary)]" />
                <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">Morning Shift (08:00 â€“ 16:00)</h3>
              </div>
              <Badge variant="brand" className="font-mono text-xs">Active Shift</Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 rounded-xl bg-[var(--surface-secondary)]">
                <span className="text-[var(--foreground-secondary)]">Gross Sales Revenue:</span>
                <p className="text-base font-bold text-[var(--foreground)] mt-1">{formatPkr(morningRevenue)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface-secondary)]">
                <span className="text-[var(--foreground-secondary)]">Transactions:</span>
                <p className="text-base font-bold text-[var(--foreground)] mt-1">{morningSales.length} sales</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2.5">
                <Clock className="h-5 w-5 text-[var(--primary)]" />
                <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">Evening Shift (16:00 â€“ 00:00)</h3>
              </div>
              <Badge variant="success" className="font-mono text-xs">Audited</Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 rounded-xl bg-[var(--surface-secondary)]">
                <span className="text-[var(--foreground-secondary)]">Gross Sales Revenue:</span>
                <p className="text-base font-bold text-[var(--foreground)] mt-1">{formatPkr(eveningRevenue)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface-secondary)]">
                <span className="text-[var(--foreground-secondary)]">Transactions:</span>
                <p className="text-base font-bold text-[var(--foreground)] mt-1">{eveningSales.length} sales</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 7 & 8: Inventory Intelligence & Financial Accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2.5">
                <Boxes className="h-5 w-5 text-[var(--primary)]" />
                <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">Inventory Intelligence Overview</h3>
              </div>
              <Link href="/inventory">
                <Button variant="secondary" size="sm" className="text-xs">Manage Stock</Button>
              </Link>
            </div>
            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between p-2.5 bg-[var(--surface-secondary)] rounded-xl">
                <span className="text-[var(--foreground-secondary)]">Total Active SKUs:</span>
                <span className="font-bold text-[var(--foreground)]">{inventory.length} items</span>
              </div>
              <div className="flex justify-between p-2.5 bg-[var(--surface-secondary)] rounded-xl">
                <span className="text-[var(--foreground-secondary)]">Total Stock Valuation (FIFO Cost):</span>
                <span className="font-bold text-[var(--success)]">{formatPkr(inventoryFifoValuation)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-[var(--surface-secondary)] rounded-xl">
                <span className="text-[var(--foreground-secondary)]">Low Stock Items (&lt;= Min Level):</span>
                <span className="font-bold text-[var(--warning)]">{lowStockItems.length} products</span>
              </div>
              <div className="flex justify-between p-2.5 bg-[var(--surface-secondary)] rounded-xl">
                <span className="text-[var(--foreground-secondary)]">Out of Stock Items:</span>
                <span className="font-bold text-[var(--danger)]">{outOfStockItems.length} products</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2.5">
                <Wallet className="h-5 w-5 text-[var(--primary)]" />
                <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">Financial Accounts &amp; Liquidity</h3>
              </div>
              <Link href="/finance">
                <Button variant="secondary" size="sm" className="text-xs">Open Accounts</Button>
              </Link>
            </div>
            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between p-2.5 bg-[var(--surface-secondary)] rounded-xl">
                <span className="text-[var(--foreground-secondary)]">Total Business Liquidity:</span>
                <span className="font-bold text-[var(--primary)]">{formatPkr(totalLiquidity)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-[var(--surface-secondary)] rounded-xl">
                <span className="text-[var(--foreground-secondary)]">Shop Cash Drawer:</span>
                <span className="font-bold text-[var(--foreground)]">{formatPkr(cashDrawerBalance)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-[var(--surface-secondary)] rounded-xl">
                <span className="text-[var(--foreground-secondary)]">Bank Accounts:</span>
                <span className="font-bold text-[var(--foreground)]">{formatPkr(bankBalance)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-[var(--surface-secondary)] rounded-xl">
                <span className="text-[var(--foreground-secondary)]">Digital Wallets (JazzCash / Easypaisa):</span>
                <span className="font-bold text-[var(--foreground)]">{formatPkr(walletBalance)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 12 & 13: Business Alerts & Live Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="h-5 w-5 text-[var(--warning)]" />
                <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">Business Alerts &amp; Notifications</h3>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">{lowStockItems.length + (accounts.length === 0 ? 1 : 0)} Alerts</Badge>
            </div>
            <div className="space-y-3 text-xs">
              {lowStockItems.length > 0 && (
                <div className="p-3 rounded-xl bg-[var(--warning)]/10 border border-[var(--warning)]/30 flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-[var(--warning)] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-[var(--foreground)]">Low Stock Warning</p>
                    <p className="text-[11px] text-[var(--foreground-secondary)]">{lowStockItems.length} accessories require immediate restocking.</p>
                  </div>
                </div>
              )}
              {accounts.length === 0 && (
                <div className="p-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-[var(--danger)] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-[var(--foreground)]">Financial Accounts Not Configured</p>
                    <p className="text-[11px] text-[var(--foreground-secondary)]">Configure opening balances in Finance &amp; Accounts.</p>
                  </div>
                </div>
              )}
              {lowStockItems.length === 0 && accounts.length > 0 && (
                <div className="p-4 text-center text-[var(--foreground-secondary)]">
                  <CheckCircle2 className="h-6 w-6 mx-auto text-[var(--success)] mb-1" />
                  All systems operating normally. Zero active business alerts.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2.5">
                <Activity className="h-5 w-5 text-[var(--primary)]" />
                <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">Live Shop Activity Feed</h3>
              </div>
              <Link href="/audit">
                <Button variant="secondary" size="sm" className="text-xs">Full Audit Log</Button>
              </Link>
            </div>
            <div className="space-y-2.5 text-xs font-mono">
              {auditLogs.slice(0, 5).map((log: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-[var(--surface-secondary)] rounded-xl">
                  <div>
                    <p className="font-bold text-[var(--foreground)]">{log.action_type || "ACTIVITY"}</p>
                    <p className="text-[10px] text-[var(--foreground-secondary)]">{log.description || "System event recorded."}</p>
                  </div>
                  <span className="text-[10px] text-[var(--foreground-secondary)]">{new Date(log.created_at).toLocaleTimeString()}</span>
                </div>
              ))}
              {auditLogs.length === 0 && (
                <div className="p-4 text-center text-[var(--foreground-secondary)] font-sans">
                  No activity logged yet. Transactions will appear here in real time.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}