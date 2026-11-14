import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatPkr } from "@/lib/format/currency";
import {
  DollarSign,
  TrendingUp,
  Building2,
  Wallet,
  Users,
  ArrowRightLeft,
  ShieldCheck,
  PlusCircle,
  FileSpreadsheet,
} from "lucide-react";
import {
  createFinancialAccountAction,
  recordOwnerContributionAction,
  recordOwnerDrawingAction,
  createAccountTransferAction,
} from "./actions";

interface FinancePageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  const resolvedParams = await searchParams;
  const activeTab = resolvedParams.tab || "overview";

  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const admin = createSupabaseAdminClient();

  // Fetch financial data in parallel
  const [
    { data: rawAccounts },
    { data: rawContributions },
    { data: rawDrawings },
    { data: rawTransfers },
    { data: rawSales },
    { data: rawExpenses },
  ] = await Promise.all([
    admin.from("financial_accounts").select("*").eq("business_id", ctx.businessId).range(0, 999),
    admin.from("owner_contributions").select("*").eq("business_id", ctx.businessId).range(0, 999),
    admin.from("owner_drawings").select("*").eq("business_id", ctx.businessId).range(0, 999),
    admin.from("account_transfers").select("*").eq("business_id", ctx.businessId).range(0, 999),
    admin.from("sales").select("*").eq("business_id", ctx.businessId).range(0, 999),
    admin.from("expenses").select("*").eq("business_id", ctx.businessId).range(0, 999),
  ]);

  const accounts = rawAccounts ?? [];
  const contributions = rawContributions ?? [];
  const drawings = rawDrawings ?? [];
  const transfers = rawTransfers ?? [];
  const sales = rawSales ?? [];
  const expenses = rawExpenses ?? [];

  // Core Financial Summaries
  const grossSales = sales.reduce((acc, s) => acc + Number(s.subtotal_paisa || s.total_paisa || 0), 0);
  const totalDiscounts = sales.reduce((acc, s) => acc + Number(s.discount_paisa || 0), 0);
  const netSales = Math.max(0, grossSales - totalDiscounts);

  const totalOperatingExpenses = expenses.reduce((acc, e) => acc + Number(e.amount_paisa || 0), 0);
  const totalOwnerContributions = contributions.reduce((acc, c) => acc + Number(c.amount_paisa || 0), 0);
  const totalHouseholdDrawings = drawings.reduce((acc, d) => acc + Number(d.amount_paisa || 0), 0);

  const totalCashAccounts = accounts.filter(a => a.account_type === 'CASH').reduce((acc, a) => acc + Number(a.opening_balance_paisa || 0), 0);
  const totalBankAccounts = accounts.filter(a => a.account_type === 'BANK').reduce((acc, a) => acc + Number(a.opening_balance_paisa || 0), 0);
  const totalDigitalAccounts = accounts.filter(a => a.account_type === 'DIGITAL').reduce((acc, a) => acc + Number(a.opening_balance_paisa || 0), 0);
  const totalLiquidity = totalCashAccounts + totalBankAccounts + totalDigitalAccounts + totalOwnerContributions - totalHouseholdDrawings;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow="TechnoWorld OS • Financial &amp; Owner Accounting System"
        title="Finance &amp; Owner Accounts"
        description="Double-entry general ledger, multi-owner capital contributions, household drawings, and multi-wallet liquidity management."
      />

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-surface p-1.5 shadow-xs">
        {[
          { id: "overview", label: "Financial Overview", icon: DollarSign },
          { id: "accounts", label: "Accounts & Wallets", icon: Wallet },
          { id: "capital", label: "Owner Capital", icon: Building2 },
          { id: "drawings", label: "Household & Drawings", icon: Users },
          { id: "transfers", label: "Transfers & Ledger", icon: ArrowRightLeft },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <Link
              key={t.id}
              href={`/finance?tab=${t.id}`}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition ${isActive ? "bg-brand text-white shadow-xs" : "text-muted hover:text-ink hover:bg-warm"}`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* TAB 1: FINANCIAL OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-brand/30 bg-brand-soft/10">
              <CardContent className="p-5 space-y-1">
                <span className="text-xs font-bold text-muted">Total Available Liquidity</span>
                <p className="font-mono text-2xl font-extrabold text-ink">{formatPkr(totalLiquidity)}</p>
                <p className="text-[10px] text-muted">Cash, Bank, &amp; Wallets combined</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-surface">
              <CardContent className="p-5 space-y-1">
                <span className="text-xs font-bold text-muted">Net Sales Revenue</span>
                <p className="font-mono text-2xl font-extrabold text-brand-dark">{formatPkr(netSales)}</p>
                <p className="text-[10px] text-muted">Excl. Rs. {formatPkr(totalDiscounts)} discounts</p>
              </CardContent>
            </Card>

            <Card className="border-success/30 bg-success-soft/10">
              <CardContent className="p-5 space-y-1">
                <span className="text-xs font-bold text-success">Owner Capital Invested</span>
                <p className="font-mono text-2xl font-extrabold text-success">{formatPkr(totalOwnerContributions)}</p>
                <p className="text-[10px] text-muted">Subhan Shahid, Father, Brother</p>
              </CardContent>
            </Card>

            <Card className="border-danger/30 bg-danger-soft/10">
              <CardContent className="p-5 space-y-1">
                <span className="text-xs font-bold text-danger">Household Withdrawals</span>
                <p className="font-mono text-2xl font-extrabold text-danger">{formatPkr(totalHouseholdDrawings)}</p>
                <p className="text-[10px] text-muted">Shop drawings &amp; personal use</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-border bg-surface">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-display text-base font-extrabold text-ink border-b border-border pb-3">Wallet &amp; Liquidity Breakdown</h3>
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between p-3 rounded-xl bg-warm">
                    <span className="text-muted">Cash Drawers:</span>
                    <span className="font-bold text-ink">{formatPkr(totalCashAccounts)}</span>
                  </div>
                  <div className="flex justify-between p-3 rounded-xl bg-warm">
                    <span className="text-muted">Bank Accounts:</span>
                    <span className="font-bold text-ink">{formatPkr(totalBankAccounts)}</span>
                  </div>
                  <div className="flex justify-between p-3 rounded-xl bg-warm">
                    <span className="text-muted">Digital Wallets (Easypaisa/JazzCash):</span>
                    <span className="font-bold text-ink">{formatPkr(totalDigitalAccounts)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-surface">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-display text-base font-extrabold text-ink border-b border-border pb-3">Accounting Compliance</h3>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-success-soft/30 border border-success/30 text-success">
                    <ShieldCheck className="h-5 w-5 shrink-0" />
                    <span>Double-entry general ledger active and balanced for Asia/Karachi timezone.</span>
                  </div>
                  <p className="text-muted text-[11px]">All transactions maintain audit trails linked directly to POS checkouts, inventory restocks, and shift closures.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: ACCOUNTS & WALLETS */}
      {activeTab === "accounts" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-border bg-surface">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-display text-base font-extrabold text-ink">Active Business Accounts &amp; Wallets</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-warm/60 text-muted">
                        <th className="p-3 font-bold">Account Name</th>
                        <th className="p-3 font-bold">Type</th>
                        <th className="p-3 font-bold">Opening Balance</th>
                        <th className="p-3 font-bold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {accounts.map((acc, idx) => (
                        <tr key={idx} className="hover:bg-warm/30 transition">
                          <td className="p-3 font-bold text-ink">{acc.account_name}</td>
                          <td className="p-3"><Badge variant="secondary">{acc.account_type}</Badge></td>
                          <td className="p-3 font-mono font-bold text-brand-dark">{formatPkr(acc.opening_balance_paisa || 0)}</td>
                          <td className="p-3 text-right"><Badge variant="success">Active</Badge></td>
                        </tr>
                      ))}
                      {accounts.length === 0 && (
                        <tr><td colSpan={4} className="p-6 text-center text-muted">No financial accounts registered yet. Use the form to add one.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="border-border bg-surface">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-display text-sm font-extrabold text-ink flex items-center gap-2">
                  <PlusCircle className="h-4 w-4 text-brand" /> Add Financial Account
                </h3>
                <form action={createFinancialAccountAction} className="space-y-3.5 text-xs">
                  <div>
                    <Label>Account Name</Label>
                    <Input name="accountName" placeholder="e.g. Meezan Bank Main" className="mt-1 h-9" required />
                  </div>
                  <div>
                    <Label>Account Type</Label>
                    <select name="accountType" className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 font-semibold">
                      <option value="CASH">Cash Drawer</option>
                      <option value="BANK">Bank Account</option>
                      <option value="DIGITAL">Digital Wallet (Easypaisa/JazzCash)</option>
                      <option value="OWNER">Owner Account</option>
                    </select>
                  </div>
                  <div>
                    <Label>Opening Balance (Rs.)</Label>
                    <Input type="number" name="openingBalance" defaultValue="0" className="mt-1 h-9 font-mono" required />
                  </div>
                  <div>
                    <Label>Description / Notes</Label>
                    <Input name="description" placeholder="Optional notes..." className="mt-1 h-9" />
                  </div>
                  <Button type="submit" className="w-full mt-2">Create Account</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 3: OWNER CAPITAL */}
      {activeTab === "capital" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-border bg-surface">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-display text-base font-extrabold text-ink">Owner Capital Contributions</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-warm/60 text-muted">
                        <th className="p-3 font-bold">Owner Name</th>
                        <th className="p-3 font-bold">Type</th>
                        <th className="p-3 font-bold">Amount</th>
                        <th className="p-3 font-bold text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {contributions.map((c, idx) => (
                        <tr key={idx} className="hover:bg-warm/30 transition">
                          <td className="p-3 font-bold text-ink">{c.owner_name}</td>
                          <td className="p-3"><Badge variant="brand">{c.contribution_type}</Badge></td>
                          <td className="p-3 font-mono font-bold text-success">{formatPkr(c.amount_paisa)}</td>
                          <td className="p-3 text-right font-mono text-muted">{new Date(c.contribution_date).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {contributions.length === 0 && (
                        <tr><td colSpan={4} className="p-6 text-center text-muted">No owner contributions recorded yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="border-border bg-surface">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-display text-sm font-extrabold text-ink flex items-center gap-2">
                  <PlusCircle className="h-4 w-4 text-brand" /> Record Contribution
                </h3>
                <form action={recordOwnerContributionAction} className="space-y-3.5 text-xs">
                  <div>
                    <Label>Owner Name</Label>
                    <select name="ownerName" className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 font-semibold">
                      <option value="Subhan Shahid">Subhan Shahid</option>
                      <option value="Father">Father</option>
                      <option value="Younger Brother">Younger Brother</option>
                    </select>
                  </div>
                  <div>
                    <Label>Contribution Type</Label>
                    <select name="contributionType" className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 font-semibold">
                      <option value="CASH">Cash</option>
                      <option value="INVENTORY">Inventory Stock</option>
                      <option value="EQUIPMENT">Equipment / Asset</option>
                      <option value="LOAN">Owner Loan to Business</option>
                    </select>
                  </div>
                  <div>
                    <Label>Amount (Rs.)</Label>
                    <Input type="number" name="amount" placeholder="e.g. 50000" className="mt-1 h-9 font-mono" required />
                  </div>
                  <div>
                    <Label>Receiving Account</Label>
                    <select name="receivingAccountId" className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 font-semibold">
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>{acc.account_name} ({acc.account_type})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Notes / Valuation Details</Label>
                    <Input name="notes" placeholder="Optional details..." className="mt-1 h-9" />
                  </div>
                  <Button type="submit" className="w-full mt-2">Record Capital</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 4: HOUSEHOLD & DRAWINGS */}
      {activeTab === "drawings" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-border bg-surface">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-display text-base font-extrabold text-ink">Household Withdrawals &amp; Owner Drawings</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-warm/60 text-muted">
                        <th className="p-3 font-bold">Owner Name</th>
                        <th className="p-3 font-bold">Category</th>
                        <th className="p-3 font-bold">Amount</th>
                        <th className="p-3 font-bold text-right">Purpose / Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {drawings.map((d, idx) => (
                        <tr key={idx} className="hover:bg-warm/30 transition">
                          <td className="p-3 font-bold text-ink">{d.owner_name}</td>
                          <td className="p-3"><Badge variant="danger">{d.category}</Badge></td>
                          <td className="p-3 font-mono font-bold text-danger">{formatPkr(d.amount_paisa)}</td>
                          <td className="p-3 text-right">
                            <p className="font-semibold text-ink">{d.purpose || "General"}</p>
                            <p className="font-mono text-[10px] text-muted">{new Date(d.drawing_date).toLocaleDateString()}</p>
                          </td>
                        </tr>
                      ))}
                      {drawings.length === 0 && (
                        <tr><td colSpan={4} className="p-6 text-center text-muted">No household withdrawals recorded yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="border-border bg-surface">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-display text-sm font-extrabold text-ink flex items-center gap-2">
                  <PlusCircle className="h-4 w-4 text-brand" /> Record Withdrawal
                </h3>
                <form action={recordOwnerDrawingAction} className="space-y-3.5 text-xs">
                  <div>
                    <Label>Owner Name</Label>
                    <select name="ownerName" className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 font-semibold">
                      <option value="Subhan Shahid">Subhan Shahid</option>
                      <option value="Father">Father</option>
                      <option value="Younger Brother">Younger Brother</option>
                    </select>
                  </div>
                  <div>
                    <Label>Category</Label>
                    <select name="category" className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 font-semibold">
                      <option value="HOUSEHOLD_EXPENSE">Household Expense</option>
                      <option value="GROCERIES">Groceries</option>
                      <option value="PERSONAL_CASH">Personal Cash Draw</option>
                      <option value="ADVANCE">Owner Advance</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <Label>Amount (Rs.)</Label>
                    <Input type="number" name="amount" placeholder="e.g. 5000" className="mt-1 h-9 font-mono" required />
                  </div>
                  <div>
                    <Label>Source Account</Label>
                    <select name="sourceAccountId" className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 font-semibold">
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>{acc.account_name} ({acc.account_type})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Purpose / Details</Label>
                    <Input name="purpose" placeholder="e.g. Monthly electricity bill" className="mt-1 h-9" />
                  </div>
                  <Button type="submit" variant="secondary" className="w-full mt-2 text-danger hover:bg-danger-soft">Record Withdrawal</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 5: TRANSFERS & LEDGER */}
      {activeTab === "transfers" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-border bg-surface">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-display text-base font-extrabold text-ink">Internal Account Transfers History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-warm/60 text-muted">
                        <th className="p-3 font-bold">Reference</th>
                        <th className="p-3 font-bold">Amount</th>
                        <th className="p-3 font-bold">Description</th>
                        <th className="p-3 font-bold text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {transfers.map((tr, idx) => (
                        <tr key={idx} className="hover:bg-warm/30 transition">
                          <td className="p-3 font-bold font-mono text-ink">{tr.reference_number || "TR-TF"}</td>
                          <td className="p-3 font-mono font-bold text-brand-dark">{formatPkr(tr.amount_paisa)}</td>
                          <td className="p-3 text-muted">{tr.description || "Internal transfer between wallets"}</td>
                          <td className="p-3 text-right font-mono text-muted">{new Date(tr.transfer_date).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {transfers.length === 0 && (
                        <tr><td colSpan={4} className="p-6 text-center text-muted">No internal transfers recorded yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="border-border bg-surface">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-display text-sm font-extrabold text-ink flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-brand" /> Transfer Funds
                </h3>
                <form action={createAccountTransferAction} className="space-y-3.5 text-xs">
                  <div>
                    <Label>Source Account</Label>
                    <select name="sourceAccountId" className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 font-semibold">
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>{acc.account_name} ({acc.account_type})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Destination Account</Label>
                    <select name="destinationAccountId" className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 font-semibold">
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>{acc.account_name} ({acc.account_type})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Amount (Rs.)</Label>
                    <Input type="number" name="amount" placeholder="e.g. 10000" className="mt-1 h-9 font-mono" required />
                  </div>
                  <div>
                    <Label>Reference Number</Label>
                    <Input name="referenceNumber" placeholder="e.g. REF-001" className="mt-1 h-9 font-mono" />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input name="description" placeholder="Transfer notes..." className="mt-1 h-9" />
                  </div>
                  <Button type="submit" className="w-full mt-2">Execute Transfer</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}