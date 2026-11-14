"use client";

import * as React from "react";
import {
  ArrowLeftRight,
  Banknote,
  Building2,
  Calendar,
  HandCoins,
  Pencil,
  Plus,
  ReceiptText,
  Scale,
  Search,
  Settings2,
  Smartphone,
  Trash2,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { formatPkr, pkrToPaisa } from "@/lib/format/currency";
import type {
  AccountBucket,
  AdjustAccountPayload,
  CreateExpensePayload,
  TransferAccountPayload,
} from "@/app/(workspace)/expenses/actions";

export interface ExpenseRecord {
  id: string;
  category: string;
  description: string;
  amount_paisa: number;
  payment_source: string;
  expense_date: string;
  notes: string | null;
  created_time_pk: string;
}

export interface MovementRecord {
  id: string;
  movement_kind: "TRANSFER" | "ADJUSTMENT";
  from_account: string | null;
  to_account: string | null;
  amount_paisa: number;
  reason: string;
  created_pk: string;
}

export interface OpenDrawerOption {
  id: string;
  label: string;
  expected_closing_paisa: number;
}

interface ExpensesManagerProps {
  expenses: ExpenseRecord[];
  movements: MovementRecord[];
  accountBalancesPaisa: Record<AccountBucket, number>;
  openDrawers: OpenDrawerOption[];
  todayPk: string;
  onCreateExpense: (payload: CreateExpensePayload) => Promise<void>;
  onDeleteExpense: (expenseId: string) => Promise<void>;
  onTransferAccounts: (payload: TransferAccountPayload) => Promise<void>;
  onAdjustBalance: (payload: AdjustAccountPayload) => Promise<void>;
}

const DEFAULT_EXPENSE_CATEGORIES = [
  "Paper & Printing Rolls",
  "Toner, Ink & Printer Parts",
  "Electricity / Generator Fuel",
  "Internet & Phone Bill",
  "Tea, Water & Staff Lunch",
  "Shop Rent & Maintenance",
  "Stock / Wholesale Purchase",
  "Other Shop Expense",
];

const STORAGE_KEY_EXP_CATS = "technoworld_expense_categories_v1";

const ACCOUNT_META: Array<{
  id: AccountBucket;
  label: string;
  shortLabel: string;
  hint: string;
}> = [
  {
    id: "CASH_TILL",
    label: "Cash in Till (Drawer)",
    shortLabel: "Cash in Till",
    hint: "Counter drawer cash",
  },
  {
    id: "CASH_IN_HAND",
    label: "Cash in Hand (Owner/Safe)",
    shortLabel: "Cash in Hand",
    hint: "Collected / safe cash",
  },
  {
    id: "EASYPAISA",
    label: "EasyPaisa",
    shortLabel: "EasyPaisa",
    hint: "EasyPaisa wallet",
  },
  {
    id: "JAZZCASH",
    label: "JazzCash",
    shortLabel: "JazzCash",
    hint: "JazzCash wallet",
  },
  {
    id: "BANK_TRANSFER",
    label: "Bank Account",
    shortLabel: "Bank Account",
    hint: "Shop bank account",
  },
];

function formatAccountName(code: string | null | undefined): string {
  if (!code) return "—";
  if (code === "CASH_DRAWER" || code === "CASH_TILL") return "Cash in Till";
  if (code === "OWNER_CASH" || code === "CASH_IN_HAND") return "Cash in Hand";
  if (code === "EASYPAISA") return "EasyPaisa";
  if (code === "JAZZCASH") return "JazzCash";
  if (code === "BANK_TRANSFER" || code === "BANK_WALLET")
    return "Bank Account";
  return code;
}

export function ExpensesManager({
  expenses,
  movements,
  accountBalancesPaisa,
  openDrawers,
  todayPk,
  onCreateExpense,
  onDeleteExpense,
  onTransferAccounts,
  onAdjustBalance,
}: ExpensesManagerProps) {
  // --- Custom Expense Categories State (Add, Edit, Remove) ---
  const [categories, setCategories] = React.useState<string[]>(
    DEFAULT_EXPENSE_CATEGORIES
  );
  const [managingCats, setManagingCats] = React.useState(false);
  const [newCatName, setNewCatName] = React.useState("");
  const [editingCatIndex, setEditingCatIndex] = React.useState<number | null>(
    null
  );
  const [editCatValue, setEditCatValue] = React.useState("");

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_EXP_CATS);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCategories(parsed);
          setCategory(parsed[0]);
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  function persistCategories(next: string[]) {
    setCategories(next);
    try {
      window.localStorage.setItem(STORAGE_KEY_EXP_CATS, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }

  function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    const clean = newCatName.trim();
    if (!clean) return;
    if (categories.some((c) => c.toLowerCase() === clean.toLowerCase())) return;
    const next = [...categories, clean];
    persistCategories(next);
    setCategory(clean);
    setNewCatName("");
  }

  function handleSaveCategoryEdit(idx: number) {
    const clean = editCatValue.trim();
    if (!clean) return;
    const oldVal = categories[idx];
    const next = categories.map((c, i) => (i === idx ? clean : c));
    persistCategories(next);
    if (category === oldVal) setCategory(clean);
    setEditingCatIndex(null);
  }

  function handleRemoveCategory(idx: number) {
    if (categories.length <= 1) return;
    const removed = categories[idx];
    const next = categories.filter((_, i) => i !== idx);
    persistCategories(next);
    if (category === removed) setCategory(next[0]);
  }

  // --- Left Panel Mode: EXPENSE | TRANSFER | TILL_SPLIT | ADJUST ---
  const [panelMode, setPanelMode] = React.useState<
    "EXPENSE" | "TRANSFER" | "TILL_SPLIT" | "ADJUST"
  >("EXPENSE");

  // Expense Form State
  const [category, setCategory] = React.useState(DEFAULT_EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = React.useState("");
  const [amountPkr, setAmountPkr] = React.useState("");
  const [paymentSource, setPaymentSource] =
    React.useState<AccountBucket>("CASH_TILL");
  const [selectedDrawerId, setSelectedDrawerId] = React.useState(
    openDrawers[0]?.id ?? ""
  );
  const [expenseDate, setExpenseDate] = React.useState(todayPk);
  const [notes, setNotes] = React.useState("");

  // Transfer Between Accounts State
  const [fromAccount, setFromAccount] =
    React.useState<AccountBucket>("EASYPAISA");
  const [toAccount, setToAccount] =
    React.useState<AccountBucket>("BANK_TRANSFER");
  const [transferPkr, setTransferPkr] = React.useState("");
  const [transferReason, setTransferReason] = React.useState("");

  // Leave Cash in Till / Move Excess to Cash in Hand State
  const [leaveInTillPkr, setLeaveInTillPkr] = React.useState("2000");

  // Manual Balance Adjustment State (Computer Error Fix)
  const [adjustAccount, setAdjustAccount] =
    React.useState<AccountBucket>("CASH_TILL");
  const [actualCountedPkr, setActualCountedPkr] = React.useState("");
  const [adjustReason, setAdjustReason] = React.useState("");

  // Right Panel Tabs & Filters
  const [rightTab, setRightTab] = React.useState<"EXPENSES" | "MOVEMENTS">(
    "EXPENSES"
  );
  const [dateFilter, setDateFilter] = React.useState<"TODAY" | "ALL" | "CUSTOM">(
    "TODAY"
  );
  const [customDate, setCustomDate] = React.useState(todayPk);
  const [accountFilter, setAccountFilter] = React.useState<string>("ALL");
  const [search, setSearch] = React.useState("");
  const [feedback, setFeedback] = React.useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const amountPaisa = pkrToPaisa(amountPkr);
    if (amountPaisa <= 0) {
      setFeedback({ type: "err", text: "Enter a valid amount in Rs." });
      return;
    }

    startTransition(async () => {
      try {
        await onCreateExpense({
          category,
          description,
          amountPaisa,
          paymentSource,
          expenseDate,
          cashSessionId:
            paymentSource === "CASH_TILL" ? selectedDrawerId || null : null,
          notes,
        });
        setDescription("");
        setAmountPkr("");
        setNotes("");
        setFeedback({
          type: "ok",
          text: `Saved! Deducted from ${formatAccountName(paymentSource)}.`,
        });
      } catch (err) {
        setFeedback({
          type: "err",
          text: err instanceof Error ? err.message : "Failed to save expense.",
        });
      }
    });
  }

  function handleTransferSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const amountPaisa = pkrToPaisa(transferPkr);
    if (amountPaisa <= 0) {
      setFeedback({ type: "err", text: "Enter a valid transfer amount." });
      return;
    }

    startTransition(async () => {
      try {
        await onTransferAccounts({
          fromAccount,
          toAccount,
          amountPaisa,
          reason: transferReason,
        });
        setTransferPkr("");
        setTransferReason("");
        setFeedback({
          type: "ok",
          text: `Transferred ${formatPkr(amountPaisa)} from ${formatAccountName(
            fromAccount
          )} to ${formatAccountName(toAccount)}.`,
        });
      } catch (err) {
        setFeedback({
          type: "err",
          text: err instanceof Error ? err.message : "Transfer failed.",
        });
      }
    });
  }

  function handleTillSplitSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const currentTillPaisa = accountBalancesPaisa.CASH_TILL;
    const leavePaisa = Math.max(0, pkrToPaisa(leaveInTillPkr));
    const dropToHandPaisa = currentTillPaisa - leavePaisa;

    if (dropToHandPaisa <= 0) {
      setFeedback({
        type: "err",
        text: `Till currently has ${formatPkr(
          currentTillPaisa
        )}, which is already at or below ${formatPkr(leavePaisa)}.`,
      });
      return;
    }

    startTransition(async () => {
      try {
        await onTransferAccounts({
          fromAccount: "CASH_TILL",
          toAccount: "CASH_IN_HAND",
          amountPaisa: dropToHandPaisa,
          reason: `Left ${formatPkr(leavePaisa)} float in Till • Moved ${formatPkr(
            dropToHandPaisa
          )} to Cash in Hand`,
        });
        setFeedback({
          type: "ok",
          text: `Left ${formatPkr(leavePaisa)} in Till and moved ${formatPkr(
            dropToHandPaisa
          )} to Cash in Hand!`,
        });
      } catch (err) {
        setFeedback({
          type: "err",
          text: err instanceof Error ? err.message : "Till split failed.",
        });
      }
    });
  }

  function handleManualAdjustSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (actualCountedPkr.trim() === "") {
      setFeedback({
        type: "err",
        text: "Enter the actual physical/app balance in Rs.",
      });
      return;
    }
    const actualPaisa = pkrToPaisa(actualCountedPkr);
    const currentPaisa = accountBalancesPaisa[adjustAccount];

    startTransition(async () => {
      try {
        await onAdjustBalance({
          account: adjustAccount,
          currentCalculatedPaisa: currentPaisa,
          actualCountedPaisa: actualPaisa,
          reason: adjustReason,
        });
        setActualCountedPkr("");
        setAdjustReason("");
        setFeedback({
          type: "ok",
          text: `${formatAccountName(adjustAccount)} updated to ${formatPkr(
            actualPaisa
          )} and logged in Audit Trail.`,
        });
      } catch (err) {
        setFeedback({
          type: "err",
          text: err instanceof Error ? err.message : "Adjustment failed.",
        });
      }
    });
  }

  function handleDelete(exp: ExpenseRecord) {
    if (
      !window.confirm(
        `Delete expense "${exp.description}" (${formatPkr(
          exp.amount_paisa
        )})? Balance will be restored to ${formatAccountName(
          exp.payment_source
        )}.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await onDeleteExpense(exp.id);
        setFeedback({
          type: "ok",
          text: `Deleted expense and restored ${formatPkr(
            exp.amount_paisa
          )} to ${formatAccountName(exp.payment_source)}.`,
        });
      } catch (err) {
        setFeedback({
          type: "err",
          text: err instanceof Error ? err.message : "Delete failed.",
        });
      }
    });
  }

  const totalLiquidPaisa =
    accountBalancesPaisa.CASH_TILL +
    accountBalancesPaisa.CASH_IN_HAND +
    accountBalancesPaisa.EASYPAISA +
    accountBalancesPaisa.JAZZCASH +
    accountBalancesPaisa.BANK_TRANSFER;

  const filteredExpenses = expenses.filter((e) => {
    if (dateFilter === "TODAY" && e.expense_date !== todayPk) return false;
    if (dateFilter === "CUSTOM" && customDate && e.expense_date !== customDate) {
      return false;
    }
    if (accountFilter !== "ALL") {
      const normalized =
        e.payment_source === "CASH_DRAWER"
          ? "CASH_TILL"
          : e.payment_source === "OWNER_CASH"
          ? "CASH_IN_HAND"
          : e.payment_source === "BANK_WALLET"
          ? "BANK_TRANSFER"
          : e.payment_source;
      if (normalized !== accountFilter) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !e.description.toLowerCase().includes(q) &&
        !e.category.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const totalFilteredExpensesPaisa = filteredExpenses.reduce(
    (sum, e) => sum + e.amount_paisa,
    0
  );

  return (
    <div className="space-y-5">
      {/* 1. Live 5-Account Treasury Bar (Cash in Till, Cash in Hand, EasyPaisa, JazzCash, Bank) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="border-brand/30 bg-brand-soft/30">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase text-brand-dark">
                Total All Accounts
              </p>
              <Wallet className="h-4 w-4 text-brand" />
            </div>
            <p className="mt-1 font-mono text-lg font-extrabold text-brand-dark">
              {formatPkr(totalLiquidPaisa)}
            </p>
            <p className="mt-0.5 text-[10px] text-muted">
              Combined shop liquidity
            </p>
          </CardContent>
        </Card>

        {ACCOUNT_META.map((acc) => {
          const bal = accountBalancesPaisa[acc.id] ?? 0;
          const Icon =
            acc.id === "CASH_TILL"
              ? Banknote
              : acc.id === "CASH_IN_HAND"
              ? HandCoins
              : acc.id === "BANK_TRANSFER"
              ? Building2
              : Smartphone;

          return (
            <Card key={acc.id}>
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-muted">
                    {acc.shortLabel}
                  </p>
                  <Icon className="h-3.5 w-3.5 text-brand" />
                </div>
                <p
                  className={`mt-1 font-mono text-lg font-extrabold ${
                    bal < 0 ? "text-danger" : "text-ink"
                  }`}
                >
                  {formatPkr(bal)}
                </p>
                <p className="mt-0.5 text-[10px] text-muted">{acc.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* LEFT (5 Cols): Action Switcher (Log Expense | Transfer | Till/Hand Split | Manual Adjust) */}
        <div className="lg:col-span-5">
          <Card className="border-brand/30 sticky top-20">
            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* 4-Way Action Tabs */}
              <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-warm p-1 sm:grid-cols-4">
                {(
                  [
                    { id: "EXPENSE", label: "+ Expense" },
                    { id: "TRANSFER", label: "Transfer" },
                    { id: "TILL_SPLIT", label: "Till / Hand" },
                    { id: "ADJUST", label: "Fix Balance" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setPanelMode(t.id);
                      setFeedback(null);
                    }}
                    className={`rounded-lg py-2 px-1.5 text-[11px] font-extrabold transition ${
                      panelMode === t.id
                        ? "bg-brand text-white shadow-xs"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* MODE 1: RECORD EXPENSE (With Manage Categories + Exact 5-Account Selector) */}
              {panelMode === "EXPENSE" && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between border-b border-border pb-2.5">
                    <div>
                      <h2 className="font-display text-sm font-extrabold text-ink flex items-center gap-1.5">
                        <ReceiptText className="h-4 w-4 text-brand" />
                        Record Shop Expense
                      </h2>
                      <p className="text-[11px] text-muted">
                        Choose exact account where money was taken from.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={managingCats ? "primary" : "secondary"}
                      onClick={() => setManagingCats((v) => !v)}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      {managingCats ? "Done" : "Categories"}
                    </Button>
                  </div>

                  {/* Inline Add / Edit / Remove Expense Categories Manager */}
                  {managingCats && (
                    <div className="rounded-xl border border-brand/30 bg-brand-soft/30 p-3 space-y-2.5">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-brand-dark">
                        Add, Edit or Remove Expense Categories
                      </p>
                      <form onSubmit={handleAddCategory} className="flex gap-1.5">
                        <Input
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          placeholder="New category (e.g. Staff Salary)..."
                          className="h-8 text-xs flex-1"
                          required
                        />
                        <Button type="submit" size="sm" className="h-8 px-2.5">
                          <Plus className="h-3.5 w-3.5" />
                          Add
                        </Button>
                      </form>

                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                        {categories.map((cat, idx) => (
                          <div
                            key={`${cat}-${idx}`}
                            className="flex items-center justify-between gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs"
                          >
                            {editingCatIndex === idx ? (
                              <div className="flex flex-1 items-center gap-1">
                                <Input
                                  value={editCatValue}
                                  onChange={(e) =>
                                    setEditCatValue(e.target.value)
                                  }
                                  className="h-7 text-xs"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => handleSaveCategoryEdit(idx)}
                                >
                                  Save
                                </Button>
                              </div>
                            ) : (
                              <>
                                <span className="font-semibold text-ink truncate">
                                  {cat}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCatIndex(idx);
                                      setEditCatValue(cat);
                                    }}
                                    className="rounded p-1 text-muted hover:bg-warm hover:text-ink"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  {categories.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCategory(idx)}
                                      className="rounded p-1 text-muted hover:bg-danger-soft hover:text-danger"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleAddExpense} className="space-y-3">
                    <div>
                      <Label htmlFor="expCat" className="text-xs">
                        Expense Category
                      </Label>
                      <select
                        id="expCat"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 text-xs font-semibold text-ink"
                      >
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="expDesc" className="text-xs">
                        Description / Item Purchased
                      </Label>
                      <Input
                        id="expDesc"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="e.g. 2 Reams A4 Paper, Toner, Tea..."
                        className="mt-1 h-9 text-xs"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <Label htmlFor="expAmount" className="text-xs">
                          Amount (Rs.)
                        </Label>
                        <Input
                          id="expAmount"
                          type="number"
                          min="1"
                          value={amountPkr}
                          onChange={(e) => setAmountPkr(e.target.value)}
                          placeholder="e.g. 1200"
                          className="mt-1 h-9 font-mono text-sm font-extrabold"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="expDate" className="text-xs">
                          Date
                        </Label>
                        <Input
                          id="expDate"
                          type="date"
                          value={expenseDate}
                          onChange={(e) => setExpenseDate(e.target.value)}
                          className="mt-1 h-9 text-xs"
                          required
                        />
                      </div>
                    </div>

                    {/* Exact 5-Account Selector */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Paid From Which Account?
                      </Label>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {ACCOUNT_META.map((acc) => (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => setPaymentSource(acc.id)}
                            className={`rounded-xl border py-2 px-2 text-left transition active:scale-95 ${
                              paymentSource === acc.id
                                ? "border-brand bg-brand text-white shadow-xs"
                                : "border-border bg-surface text-ink hover:bg-warm"
                            }`}
                          >
                            <p className="text-[11px] font-extrabold leading-tight">
                              {acc.shortLabel}
                            </p>
                            <p
                              className={`font-mono text-[10px] mt-0.5 ${
                                paymentSource === acc.id
                                  ? "text-white/90"
                                  : "text-muted"
                              }`}
                            >
                              {formatPkr(accountBalancesPaisa[acc.id] ?? 0)}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {paymentSource === "CASH_TILL" && openDrawers.length > 0 && (
                      <div className="rounded-xl bg-warm/60 p-2 text-xs">
                        <span className="text-[11px] font-bold text-muted">
                          Active Till Counter:
                        </span>
                        <select
                          value={selectedDrawerId}
                          onChange={(e) => setSelectedDrawerId(e.target.value)}
                          className="mt-1 h-8 w-full rounded-lg border border-border bg-surface px-2 text-xs font-semibold"
                        >
                          {openDrawers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="expNotes" className="text-xs">
                        Note / Vendor (Optional)
                      </Label>
                      <Input
                        id="expNotes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Optional receipt or supplier note..."
                        className="mt-1 h-8 text-xs"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isPending}
                      className="h-10 w-full text-xs"
                    >
                      <Plus className="h-4 w-4" />
                      {isPending
                        ? "Saving..."
                        : `Save Expense (${formatAccountName(paymentSource)})`}
                    </Button>
                  </form>
                </div>
              )}

              {/* MODE 2: INTERNAL TRANSFER BETWEEN ACCOUNTS */}
              {panelMode === "TRANSFER" && (
                <form onSubmit={handleTransferSubmit} className="space-y-3.5">
                  <div className="border-b border-border pb-2.5">
                    <h2 className="font-display text-sm font-extrabold text-ink flex items-center gap-1.5">
                      <ArrowLeftRight className="h-4 w-4 text-brand" />
                      Transfer Money Between Accounts
                    </h2>
                    <p className="text-[11px] text-muted">
                      Move funds between Cash in Till, Cash in Hand, EasyPaisa, JazzCash, or Bank.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <Label className="text-xs">From Account</Label>
                      <select
                        value={fromAccount}
                        onChange={(e) =>
                          setFromAccount(e.target.value as AccountBucket)
                        }
                        className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-2.5 text-xs font-semibold"
                      >
                        {ACCOUNT_META.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.shortLabel} ({formatPkr(accountBalancesPaisa[a.id])})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs">To Account</Label>
                      <select
                        value={toAccount}
                        onChange={(e) =>
                          setToAccount(e.target.value as AccountBucket)
                        }
                        className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-2.5 text-xs font-semibold"
                      >
                        {ACCOUNT_META.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.shortLabel} ({formatPkr(accountBalancesPaisa[a.id])})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Transfer Amount (Rs.)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={transferPkr}
                      onChange={(e) => setTransferPkr(e.target.value)}
                      placeholder="e.g. 5000"
                      className="mt-1 h-10 font-mono text-sm font-extrabold"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Note / Reason (Optional)</Label>
                    <Input
                      value={transferReason}
                      onChange={(e) => setTransferReason(e.target.value)}
                      placeholder="e.g. Sent EasyPaisa balance to Meezan Bank"
                      className="mt-1 h-9 text-xs"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isPending}
                    className="h-10 w-full text-xs"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    {isPending ? "Transferring..." : "Complete Account Transfer"}
                  </Button>
                </form>
              )}

              {/* MODE 3: LEAVE CASH IN TILL / MOVE EXCESS TO CASH IN HAND */}
              {panelMode === "TILL_SPLIT" && (
                <form onSubmit={handleTillSplitSubmit} className="space-y-3.5">
                  <div className="border-b border-border pb-2.5">
                    <h2 className="font-display text-sm font-extrabold text-ink flex items-center gap-1.5">
                      <HandCoins className="h-4 w-4 text-brand" />
                      Set Cash Left in Till vs. Cash in Hand
                    </h2>
                    <p className="text-[11px] text-muted">
                      Enter how much change/float you are leaving inside the counter till — the rest moves to Cash in Hand.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-warm p-3 text-xs">
                    <div>
                      <span className="text-muted">Current Cash in Till:</span>
                      <p className="font-mono text-sm font-extrabold text-ink">
                        {formatPkr(accountBalancesPaisa.CASH_TILL)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted">Current Cash in Hand:</span>
                      <p className="font-mono text-sm font-extrabold text-brand-dark">
                        {formatPkr(accountBalancesPaisa.CASH_IN_HAND)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">
                      Amount to Leave Inside Till (Rs.)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={leaveInTillPkr}
                      onChange={(e) => setLeaveInTillPkr(e.target.value)}
                      placeholder="e.g. 2000"
                      className="mt-1 h-10 font-mono text-sm font-extrabold"
                      required
                    />
                    <p className="mt-1 text-[11px] font-semibold text-success">
                      Will move{" "}
                      {formatPkr(
                        Math.max(
                          0,
                          accountBalancesPaisa.CASH_TILL -
                            pkrToPaisa(leaveInTillPkr)
                        )
                      )}{" "}
                      to Cash in Hand.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={isPending}
                    className="h-10 w-full text-xs"
                  >
                    <HandCoins className="h-4 w-4" />
                    {isPending
                      ? "Updating..."
                      : "Confirm Till Float & Move Cash to Hand"}
                  </Button>
                </form>
              )}

              {/* MODE 4: MANUAL BALANCE CORRECTION (COMPUTER / ROUNDING ERROR FIX) */}
              {panelMode === "ADJUST" && (
                <form
                  onSubmit={handleManualAdjustSubmit}
                  className="space-y-3.5"
                >
                  <div className="border-b border-border pb-2.5">
                    <h2 className="font-display text-sm font-extrabold text-ink flex items-center gap-1.5">
                      <Scale className="h-4 w-4 text-brand" />
                      Manual Account Balance Correction
                    </h2>
                    <p className="text-[11px] text-muted">
                      Fix computer/rounding discrepancies by entering the exact physical cash or mobile wallet balance.
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs">Select Account to Correct</Label>
                    <select
                      value={adjustAccount}
                      onChange={(e) =>
                        setAdjustAccount(e.target.value as AccountBucket)
                      }
                      className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-3 text-xs font-semibold"
                    >
                      {ACCOUNT_META.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label} (System:{" "}
                          {formatPkr(accountBalancesPaisa[a.id])})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-xl bg-warm/60 px-3 py-2 text-xs flex justify-between">
                    <span className="text-muted">System Balance:</span>
                    <strong className="font-mono font-bold text-ink">
                      {formatPkr(accountBalancesPaisa[adjustAccount])}
                    </strong>
                  </div>

                  <div>
                    <Label className="text-xs">
                      Actual Physical / App Balance Now (Rs.)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={actualCountedPkr}
                      onChange={(e) => setActualCountedPkr(e.target.value)}
                      placeholder="Enter exact Rs. currently in account"
                      className="mt-1 h-10 font-mono text-sm font-extrabold"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-xs">
                      Reason for Correction (Saved in Audit Trail)
                    </Label>
                    <Input
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="e.g. Opening wallet balance, small change rounding..."
                      className="mt-1 h-9 text-xs"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isPending}
                    className="h-10 w-full text-xs"
                  >
                    <Scale className="h-4 w-4" />
                    {isPending
                      ? "Applying..."
                      : "Set Exact Balance & Log Audit"}
                  </Button>
                </form>
              )}

              {feedback && (
                <p
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                    feedback.type === "ok"
                      ? "bg-success-soft text-success"
                      : "bg-danger-soft text-danger"
                  }`}
                >
                  {feedback.text}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT (7 Cols): Expense Ledger & Account Transfers/Adjustments History */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface p-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex rounded-xl border border-border bg-warm p-1">
                <button
                  type="button"
                  onClick={() => setRightTab("EXPENSES")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    rightTab === "EXPENSES"
                      ? "bg-brand text-white shadow-xs"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  Expenses ({filteredExpenses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab("MOVEMENTS")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    rightTab === "MOVEMENTS"
                      ? "bg-brand text-white shadow-xs"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  Transfers &amp; Adjustments ({movements.length})
                </button>
              </div>

              {rightTab === "EXPENSES" && (
                <>
                  <select
                    value={dateFilter}
                    onChange={(e) =>
                      setDateFilter(
                        e.target.value as "TODAY" | "ALL" | "CUSTOM"
                      )
                    }
                    className="h-9 rounded-xl border border-border bg-warm px-2.5 text-xs font-semibold text-ink"
                  >
                    <option value="TODAY">Today</option>
                    <option value="ALL">All Dates</option>
                    <option value="CUSTOM">Pick Date</option>
                  </select>

                  {dateFilter === "CUSTOM" && (
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
                    value={accountFilter}
                    onChange={(e) => setAccountFilter(e.target.value)}
                    className="h-9 rounded-xl border border-border bg-warm px-2.5 text-xs font-semibold text-ink"
                  >
                    <option value="ALL">All Accounts</option>
                    {ACCOUNT_META.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.shortLabel}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>

            {rightTab === "EXPENSES" && (
              <div className="relative flex-1 min-w-[160px] sm:max-w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search expenses..."
                  className="h-9 pl-8 text-xs"
                />
              </div>
            )}
          </div>

          {rightTab === "EXPENSES" ? (
            <>
              <div className="flex items-center justify-between rounded-xl border border-border bg-warm/50 px-4 py-2 text-xs">
                <span className="font-semibold text-muted">
                  Filtered Expenses Total:
                </span>
                <span className="font-mono text-sm font-extrabold text-danger">
                  -{formatPkr(totalFilteredExpensesPaisa)}
                </span>
              </div>

              {filteredExpenses.length === 0 ? (
                <Card>
                  <CardContent className="p-10 text-center space-y-2">
                    <ReceiptText className="mx-auto h-8 w-8 text-muted" />
                    <p className="text-sm font-bold text-ink">
                      No expenses found for this filter
                    </p>
                    <p className="text-xs text-muted">
                      Record an expense on the left and pick Cash in Till, Cash in Hand, EasyPaisa, JazzCash, or Bank.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2.5">
                  {filteredExpenses.map((exp) => (
                    <Card
                      key={exp.id}
                      className="hover:border-brand/40 transition"
                    >
                      <CardContent className="p-3.5 flex items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-ink">
                              {exp.description}
                            </span>
                            <Badge variant="neutral">
                              {formatAccountName(exp.payment_source)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted">
                            {exp.category} • {exp.expense_date} at{" "}
                            {exp.created_time_pk}
                            {exp.notes ? ` • ${exp.notes}` : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-mono text-sm font-extrabold text-danger">
                            -{formatPkr(exp.amount_paisa)}
                          </span>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleDelete(exp)}
                            className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger"
                            title="Delete & Restore Balance"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          ) : movements.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center space-y-2">
                <ArrowLeftRight className="mx-auto h-8 w-8 text-muted" />
                <p className="text-sm font-bold text-ink">
                  No transfers or balance adjustments yet
                </p>
                <p className="text-xs text-muted">
                  Use the <strong>Transfer</strong>, <strong>Till / Hand</strong>, or <strong>Fix Balance</strong> tabs on the left to move funds or reconcile accounts.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {movements.map((m) => (
                <Card key={m.id}>
                  <CardContent className="p-3.5 flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            m.movement_kind === "TRANSFER"
                              ? "neutral"
                              : "warning"
                          }
                        >
                          {m.movement_kind === "TRANSFER"
                            ? "ACCOUNT TRANSFER"
                            : "MANUAL ADJUSTMENT"}
                        </Badge>
                        <span className="text-xs font-extrabold text-ink">
                          {m.movement_kind === "TRANSFER"
                            ? `${formatAccountName(
                                m.from_account
                              )} → ${formatAccountName(m.to_account)}`
                            : `${formatAccountName(
                                m.to_account ?? m.from_account
                              )} (${m.to_account ? "+" : "-"})`}
                        </span>
                      </div>
                      <p className="text-xs text-muted">
                        {m.reason} • {m.created_pk}
                      </p>
                    </div>

                    <span className="font-mono text-sm font-extrabold text-brand-dark shrink-0">
                      {formatPkr(m.amount_paisa)}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}