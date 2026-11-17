"use client";

import * as React from "react";
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { formatPkr, pkrToPaisa } from "@/lib/format/currency";
import type {
  CreateCustomerPayload,
  RecordRepaymentPayload,
} from "@/app/(workspace)/customers/actions";

export interface LedgerEntry {
  id: string;
  entry_type: "CREDIT_SALE" | "REPAYMENT" | "ADJUSTMENT";
  amount_paisa: number;
  payment_method: string | null;
  notes: string | null;
  created_pk: string;
}

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  customer_type: "REGULAR" | "CORPORATE" | "SCHOOL" | "VIP";
  credit_limit_paisa: number;
  notes: string | null;
  total_credit_paisa: number;
  total_repaid_paisa: number;
  current_udhaar_paisa: number;
  ledger: LedgerEntry[];
}

interface CustomersManagerProps {
  customers: CustomerRecord[];
  onCreateCustomer: (payload: CreateCustomerPayload) => Promise<void>;
  onRecordRepayment: (payload: RecordRepaymentPayload) => Promise<void>;
}

export function CustomersManager({
  customers,
  onCreateCustomer,
  onRecordRepayment,
}: CustomersManagerProps) {
  const [selectedCustId, setSelectedCustId] = React.useState<string>(
    customers[0]?.id ?? ""
  );
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL");

  // New Customer Modal State
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newPhone, setNewPhone] = React.useState("");
  const [newAddress, setNewAddress] = React.useState("");
  const [newType, setNewType] = React.useState<
    "REGULAR" | "CORPORATE" | "SCHOOL" | "VIP"
  >("REGULAR");
  const [newLimitPkr, setNewLimitPkr] = React.useState("50000");

  // Repayment Modal State
  const [showRepayModal, setShowRepayModal] = React.useState(false);
  const [repayAmountPkr, setRepayAmountPkr] = React.useState("");
  const [repayMethod, setRepayMethod] = React.useState<
    "CASH" | "JAZZCASH" | "EASYPAISA" | "BANK_TRANSFER"
  >("CASH");
  const [repayNotes, setRepayNotes] = React.useState("");

  const [feedback, setFeedback] = React.useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!selectedCustId && customers.length > 0) {
      setSelectedCustId(customers[0].id);
    }
  }, [customers, selectedCustId]);

  const activeCustomer =
    customers.find((c) => c.id === selectedCustId) ?? customers[0];

  const filteredCustomers = customers.filter((c) => {
    if (typeFilter !== "ALL" && c.customer_type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !c.name.toLowerCase().includes(q) &&
        !(c.phone ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const totalOutstandingUdhaarPaisa = customers.reduce(
    (sum, c) => sum + c.current_udhaar_paisa,
    0
  );

  function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        await onCreateCustomer({
          name: newName,
          phone: newPhone,
          address: newAddress,
          customerType: newType,
          creditLimitPaisa: pkrToPaisa(newLimitPkr),
        });
        setNewName("");
        setNewPhone("");
        setNewAddress("");
        setShowAddModal(false);
        setFeedback({ type: "ok", text: "Customer added successfully!" });
      } catch (err) {
        setFeedback({
          type: "err",
          text: err instanceof Error ? err.message : "Failed to add customer.",
        });
      }
    });
  }

  function handleRepayment(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCustomer) return;
    setFeedback(null);
    const amountPaisa = pkrToPaisa(repayAmountPkr);
    if (amountPaisa <= 0) {
      setFeedback({ type: "err", text: "Enter a valid repayment amount." });
      return;
    }

    startTransition(async () => {
      try {
        await onRecordRepayment({
          customerId: activeCustomer.id,
          amountPaisa,
          paymentMethod: repayMethod,
          notes: repayNotes,
        });
        setRepayAmountPkr("");
        setRepayNotes("");
        setShowRepayModal(false);
        setFeedback({
          type: "ok",
          text: `Recorded repayment of ${formatPkr(amountPaisa)} from ${
            activeCustomer.name
          }!`,
        });
      } catch (err) {
        setFeedback({
          type: "err",
          text: err instanceof Error ? err.message : "Repayment failed.",
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted">Total Active Customers</p>
              <UserCheck className="h-4 w-4 text-brand" />
            </div>
            <p className="mt-1 font-mono text-xl font-extrabold text-ink">
              {customers.length}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">Registered accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted">Total Outstanding Udhaar</p>
              <CreditCard className="h-4 w-4 text-danger" />
            </div>
            <p className="mt-1 font-mono text-xl font-extrabold text-danger">
              {formatPkr(totalOutstandingUdhaarPaisa)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">Uncollected credit balance</p>
          </CardContent>
        </Card>

        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs font-medium text-muted">New Account</p>
            <p className="mt-1 text-sm font-bold text-ink">Add Client or School</p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowAddModal(true)}
          >
            <UserPlus className="h-4 w-4" />
            Add Customer
          </Button>
        </Card>
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold ${
            feedback.type === "ok"
              ? "bg-success-soft text-success border border-success/30"
              : "bg-danger-soft text-danger border border-danger/30"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main 2-Column Split: Left = Customer Directory | Right = Selected Customer Ledger */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* LEFT (5 Cols): Search & Customer List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="glass-panel flex flex-wrap items-center gap-2 rounded-2xl border p-3">
            <div className="relative w-full min-[400px]:w-auto flex-1 min-w-0 min-[400px]:min-w-[140px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or phone..."
                className="h-9 pl-8 text-xs"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 w-full min-[400px]:w-auto rounded-xl border border-border bg-warm px-2.5 text-xs font-semibold"
            >
              <option value="ALL">All Types</option>
              <option value="REGULAR">Regular</option>
              <option value="CORPORATE">Corporate</option>
              <option value="SCHOOL">School</option>
              <option value="VIP">VIP</option>
            </select>
          </div>

          {filteredCustomers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-xs text-muted">
                No customers found. Click <strong>Add Customer</strong> above.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredCustomers.map((c) => {
                const isSelected = activeCustomer?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCustId(c.id)}
                    className={`card-3d-tile w-full flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-left cursor-pointer ${
                      isSelected
                        ? "border-[var(--primary)] bg-[var(--brand-soft)] shadow-[inset_0_1px_0_var(--glass-highlight),0_6px_18px_-4px_rgba(255,106,0,0.2)]"
                        : "border-[var(--border)] bg-[var(--surface)] backdrop-blur-md hover:border-[var(--primary)]/40"
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink truncate">
                          {c.name}
                        </span>
                        <Badge
                          variant={
                            c.customer_type === "CORPORATE"
                              ? "neutral"
                              : c.customer_type === "SCHOOL"
                              ? "success"
                              : "brand"
                          }
                        >
                          {c.customer_type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted">
                        {c.phone ? c.phone : "No phone"}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[10px] uppercase font-bold text-muted">
                        Udhaar
                      </p>
                      <p
                        className={`font-mono text-sm font-extrabold ${
                          c.current_udhaar_paisa > 0
                            ? "text-danger"
                            : "text-success"
                        }`}
                      >
                        {formatPkr(c.current_udhaar_paisa)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT (7 Cols): Active Customer Profile & Credit Ledger */}
        <div className="lg:col-span-7">
          {activeCustomer ? (
            <Card className="border-brand/30">
              <CardContent className="p-4 sm:p-5 space-y-5">
                {/* Customer Header & Repayment Button */}
                <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 border-b border-border pb-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-base sm:text-lg font-extrabold text-ink break-words">
                        {activeCustomer.name}
                      </h2>
                      <Badge variant="neutral">
                        {activeCustomer.customer_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted break-words">
                      {activeCustomer.phone ?? "No Phone"} •{" "}
                      {activeCustomer.address ?? "No Address"}
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => setShowRepayModal(true)}
                  >
                    <Wallet className="h-4 w-4" />
                    Record Repayment
                  </Button>
                </div>

                {/* Balance Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  <div className="rounded-xl border border-border bg-warm p-3">
                    <span className="text-[11px] font-semibold text-muted">
                      Current Udhaar
                    </span>
                    <p className="mt-0.5 font-mono text-lg font-extrabold text-danger">
                      {formatPkr(activeCustomer.current_udhaar_paisa)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-warm p-3">
                    <span className="text-[11px] font-semibold text-muted">
                      Total Repaid
                    </span>
                    <p className="mt-0.5 font-mono text-lg font-extrabold text-success">
                      {formatPkr(activeCustomer.total_repaid_paisa)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-warm p-3">
                    <span className="text-[11px] font-semibold text-muted">
                      Credit Limit
                    </span>
                    <p className="mt-0.5 font-mono text-lg font-extrabold text-ink">
                      {formatPkr(activeCustomer.credit_limit_paisa)}
                    </p>
                  </div>
                </div>

                {/* Ledger History */}
                <div className="space-y-3">
                  <h3 className="font-display text-xs font-extrabold uppercase tracking-wider text-muted">
                    Credit &amp; Repayment Ledger ({activeCustomer.ledger.length})
                  </h3>

                  {activeCustomer.ledger.length === 0 ? (
                    <div className="rounded-xl border border-border bg-warm/50 p-6 text-center text-xs text-muted">
                      No credit purchases or repayments recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                      {activeCustomer.ledger.map((l) => {
                        const isRepay = l.entry_type === "REPAYMENT";
                        return (
                          <div
                            key={l.id}
                            className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3 rounded-xl border border-border bg-surface p-3 text-xs"
                          >
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <Badge
                                  variant={isRepay ? "success" : "danger"}
                                >
                                  {isRepay
                                    ? `REPAYMENT (${l.payment_method ?? "CASH"})`
                                    : "CREDIT SALE (UDHAAR)"}
                                </Badge>
                                <span className="text-muted text-[11px]">
                                  {l.created_pk}
                                </span>
                              </div>
                              <p className="text-ink font-semibold truncate">
                                {l.notes ?? (isRepay ? "Installment Payment" : "Store Purchase")}
                              </p>
                            </div>

                            <span
                              className={`font-mono font-extrabold text-sm shrink-0 ${
                                isRepay ? "text-success" : "text-danger"
                              }`}
                            >
                              {isRepay ? "-" : "+"}
                              {formatPkr(l.amount_paisa)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-xs text-muted">
                Select a customer on the left to view their profile and credit ledger.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* MODAL: Add Customer */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm tw-backdrop-in p-3 sm:p-4">
          <div className="glass-modal w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-4 sm:p-6 space-y-4">
            <h3 className="font-display text-base font-extrabold text-ink">
              Register New Customer / Corporate Account
            </h3>

            <form onSubmit={handleCreateCustomer} className="space-y-3.5">
              <div>
                <Label className="text-xs">Customer / Business Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Allied School Branch / Ali Khan"
                  className="mt-1 h-9 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Phone Number</Label>
                  <Input
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="0300-1234567"
                    className="mt-1 h-9 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Customer Type</Label>
                  <select
                    value={newType}
                    onChange={(e) =>
                      setNewType(
                        e.target.value as
                          | "REGULAR"
                          | "CORPORATE"
                          | "SCHOOL"
                          | "VIP"
                      )
                    }
                    className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-2.5 text-xs font-semibold"
                  >
                    <option value="REGULAR">Regular</option>
                    <option value="CORPORATE">Corporate</option>
                    <option value="SCHOOL">School / College</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Address</Label>
                <Input
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="e.g. Commercial Market Rawalpindi"
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Credit Limit (Rs.)</Label>
                <Input
                  type="number"
                  min="0"
                  value={newLimitPkr}
                  onChange={(e) => setNewLimitPkr(e.target.value)}
                  className="mt-1 h-9 font-mono text-xs"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Customer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Record Repayment */}
      {showRepayModal && activeCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm tw-backdrop-in p-3 sm:p-4">
          <div className="glass-modal w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-4 sm:p-6 space-y-4">
            <h3 className="font-display text-base font-extrabold text-ink">
              Record Udhaar Repayment • {activeCustomer.name}
            </h3>

            <form onSubmit={handleRepayment} className="space-y-3.5">
              <div>
                <Label className="text-xs">Repayment Amount (Rs.)</Label>
                <Input
                  type="number"
                  min="1"
                  value={repayAmountPkr}
                  onChange={(e) => setRepayAmountPkr(e.target.value)}
                  placeholder="e.g. 5000"
                  className="mt-1 h-10 font-mono text-sm font-extrabold"
                  required
                />
                <p className="mt-1 text-[11px] text-muted">
                  Current Udhaar Balance:{" "}
                  <strong className="text-danger">
                    {formatPkr(activeCustomer.current_udhaar_paisa)}
                  </strong>
                </p>
              </div>

              <div>
                <Label className="text-xs">Payment Method</Label>
                <select
                  value={repayMethod}
                  onChange={(e) =>
                    setRepayMethod(
                      e.target.value as
                        | "CASH"
                        | "JAZZCASH"
                        | "EASYPAISA"
                        | "BANK_TRANSFER"
                    )
                  }
                  className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-2.5 text-xs font-semibold"
                >
                  <option value="CASH">Cash (Adds to Till Drawer)</option>
                  <option value="JAZZCASH">JazzCash</option>
                  <option value="EASYPAISA">EasyPaisa</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              <div>
                <Label className="text-xs">Notes / Receipt Ref (Optional)</Label>
                <Input
                  value={repayNotes}
                  onChange={(e) => setRepayNotes(e.target.value)}
                  placeholder="e.g. Partial payment via JazzCash..."
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowRepayModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Confirm Repayment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}