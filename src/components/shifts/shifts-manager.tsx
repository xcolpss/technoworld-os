"use client";

import * as React from "react";
import {
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  Lock,
  Monitor,
  Play,
  ReceiptText,
  Smartphone,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { formatPkr, pkrToPaisa } from "@/lib/format/currency";
import type {
  CloseShiftPayload,
  OpenShiftPayload,
} from "@/app/(workspace)/shifts/actions";

export interface TerminalOption {
  id: string;
  code: string;
  name: string;
}

export interface ShiftFinancialBreakdown {
  cashSalesPaisa: number;
  digitalSalesPaisa: number;
  jazzCashPaisa: number;
  easyPaisaPaisa: number;
  bankPaisa: number;
  expensesPaisa: number;
}

export interface ShiftSessionRecord {
  id: string;
  terminal_id: string;
  terminal_code: string;
  terminal_name: string;
  status: "OPEN" | "CLOSED";
  opening_float_paisa: number;
  expected_closing_paisa: number;
  actual_closing_paisa: number;
  variance_paisa: number;
  notes: string | null;
  opened_pk: string;
  closed_pk: string | null;
  financials: ShiftFinancialBreakdown;
}

interface ShiftsManagerProps {
  terminals: TerminalOption[];
  sessions: ShiftSessionRecord[];
  onOpenShift: (payload: OpenShiftPayload) => Promise<void>;
  onCloseShift: (payload: CloseShiftPayload) => Promise<void>;
}

export function ShiftsManager({
  terminals,
  sessions,
  onOpenShift,
  onCloseShift,
}: ShiftsManagerProps) {
  const [showOpenModal, setShowOpenModal] = React.useState(false);
  const [selectedTerminalId, setSelectedTerminalId] = React.useState(
    terminals[0]?.id ?? ""
  );
  const [floatPkr, setFloatPkr] = React.useState("2000");

  const [closingSession, setClosingSession] =
    React.useState<ShiftSessionRecord | null>(null);
  const [actualCountPkr, setActualCountPkr] = React.useState("");
  const [closeNotes, setCloseNotes] = React.useState("");

  const [feedback, setFeedback] = React.useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const openSessions = sessions.filter((s) => s.status === "OPEN");
  const closedSessions = sessions.filter((s) => s.status === "CLOSED");

  function handleOpenShiftSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        await onOpenShift({
          terminalId: selectedTerminalId,
          openingFloatPaisa: pkrToPaisa(floatPkr),
        });
        setShowOpenModal(false);
        setFeedback({ type: "ok", text: "Shift started successfully!" });
      } catch (err) {
        setFeedback({
          type: "err",
          text: err instanceof Error ? err.message : "Failed to open shift.",
        });
      }
    });
  }

  function handleCloseShiftSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!closingSession) return;
    setFeedback(null);
    const actualPaisa = pkrToPaisa(actualCountPkr);

    startTransition(async () => {
      try {
        await onCloseShift({
          sessionId: closingSession.id,
          actualClosingPaisa: actualPaisa,
          notes: closeNotes,
        });
        setClosingSession(null);
        setActualCountPkr("");
        setCloseNotes("");
        setFeedback({ type: "ok", text: "Shift reconciled & closed!" });
      } catch (err) {
        setFeedback({
          type: "err",
          text: err instanceof Error ? err.message : "Failed to close shift.",
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Schedule Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-sm font-extrabold text-ink">
              Scheduled Shift Hours (PKT)
            </h2>
            <p className="text-xs text-muted">
              Shift 1: <strong>08:00 – 16:00</strong> • Shift 2: <strong>16:00 – 00:00</strong> (Optional / Flexible)
            </p>
          </div>
        </div>

        <Button type="button" onClick={() => setShowOpenModal(true)}>
          <Play className="h-4 w-4" />
          Start New Shift
        </Button>
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

      {/* Active Open Shifts & Detailed Handover Cards */}
      <div className="space-y-3">
        <h3 className="font-display text-xs font-extrabold uppercase tracking-wider text-muted">
          Active Open Shift Handoff ({openSessions.length})
        </h3>

        {openSessions.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center space-y-2">
              <Monitor className="mx-auto h-8 w-8 text-muted" />
              <p className="text-sm font-bold text-ink">No active shift currently open</p>
              <p className="text-xs text-muted">
                Shifts are optional. You can start a shift anytime or let staff record sales directly.
              </p>
              <div className="pt-2">
                <Button type="button" size="sm" onClick={() => setShowOpenModal(true)}>
                  Start Shift Now
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {openSessions.map((sess) => {
              const fin = sess.financials;
              const totalEarnings =
                fin.cashSalesPaisa +
                fin.jazzCashPaisa +
                fin.easyPaisaPaisa +
                fin.bankPaisa;

              return (
                <Card key={sess.id} className="border-brand/40 bg-brand-soft/10">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-5 w-5 text-brand" />
                        <div>
                          <span className="font-bold text-sm text-ink">
                            {sess.terminal_code} — {sess.terminal_name}
                          </span>
                          <p className="text-[10px] text-muted">Opened at {sess.opened_pk}</p>
                        </div>
                      </div>
                      <Badge variant="success">OPEN HANDOFF</Badge>
                    </div>

                    {/* Financial Summary Breakdown */}
                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div className="rounded-xl bg-surface border border-border p-3 space-y-1">
                        <span className="text-[11px] font-semibold text-muted">Shift Earnings</span>
                        <p className="font-mono text-base font-extrabold text-brand-dark">
                          {formatPkr(totalEarnings)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-surface border border-border p-3 space-y-1">
                        <span className="text-[11px] font-semibold text-muted">Expenses Paid</span>
                        <p className="font-mono text-base font-extrabold text-danger">
                          -{formatPkr(fin.expensesPaisa)}
                        </p>
                      </div>
                    </div>

                    {/* Payment Account Breakdown */}
                    <div className="rounded-xl bg-surface border border-border p-3 space-y-2 text-xs">
                      <p className="text-[11px] font-bold uppercase text-muted">Earnings by Account</p>
                      <div className="grid grid-cols-2 gap-2 font-mono">
                        <div className="flex justify-between">
                          <span className="text-muted font-sans">Cash Sales:</span>
                          <span className="font-bold">{formatPkr(fin.cashSalesPaisa)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted font-sans">JazzCash:</span>
                          <span className="font-bold">{formatPkr(fin.jazzCashPaisa)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted font-sans">EasyPaisa:</span>
                          <span className="font-bold">{formatPkr(fin.easyPaisaPaisa)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted font-sans">Bank:</span>
                          <span className="font-bold">{formatPkr(fin.bankPaisa)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-warm p-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-muted">Opening Float: {formatPkr(sess.opening_float_paisa)}</span>
                        <p className="font-mono text-sm font-extrabold text-ink">
                          Expected Till Cash: {formatPkr(sess.expected_closing_paisa)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setClosingSession(sess);
                          setActualCountPkr(
                            String(Math.round(sess.expected_closing_paisa / 100))
                          );
                        }}
                      >
                        <Lock className="h-3.5 w-3.5" />
                        Close &amp; Handover
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Closed Shift History */}
      <div className="space-y-3 pt-4">
        <h3 className="font-display text-xs font-extrabold uppercase tracking-wider text-muted">
          Past Handoffs &amp; Reconciliations ({closedSessions.length})
        </h3>

        {closedSessions.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-xs text-muted">
              No closed shift history recorded yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {closedSessions.map((sess) => {
              const variance = sess.variance_paisa;
              const isMatch = variance === 0;
              const isShort = variance < 0;

              return (
                <Card key={sess.id}>
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink">
                          {sess.terminal_code} ({sess.terminal_name})
                        </span>
                        <Badge variant="neutral">CLOSED</Badge>
                        <Badge
                          variant={
                            isMatch
                              ? "success"
                              : isShort
                              ? "danger"
                              : "warning"
                          }
                        >
                          {isMatch
                            ? "Exact Match"
                            : isShort
                            ? `Short: ${formatPkr(Math.abs(variance))}`
                            : `Over: ${formatPkr(variance)}`}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted">
                        Opened {sess.opened_pk} • Closed {sess.closed_pk ?? "—"}
                        {sess.notes ? ` • Note: ${sess.notes}` : ""}
                      </p>
                    </div>

                    <div className="text-right font-mono text-xs space-y-0.5">
                      <p className="text-muted">
                        Expected: {formatPkr(sess.expected_closing_paisa)}
                      </p>
                      <p className="font-extrabold text-ink">
                        Counted: {formatPkr(sess.actual_closing_paisa)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: Open New Shift */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
            <h3 className="font-display text-base font-extrabold text-ink">
              Start New Counter Shift
            </h3>

            <form onSubmit={handleOpenShiftSubmit} className="space-y-3.5">
              <div>
                <Label className="text-xs">Terminal / Counter</Label>
                <select
                  value={selectedTerminalId}
                  onChange={(e) => setSelectedTerminalId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-2.5 text-xs font-semibold"
                >
                  {terminals.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} — {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">Opening Float / Till Cash (Rs.)</Label>
                <Input
                  type="number"
                  min="0"
                  value={floatPkr}
                  onChange={(e) => setFloatPkr(e.target.value)}
                  className="mt-1 h-10 font-mono text-sm font-extrabold"
                  required
                />
                <p className="mt-1 text-[11px] text-muted">
                  Starting cash placed in the register drawer for change.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowOpenModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Open Shift
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reconcile & Close Shift */}
      {closingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
            <h3 className="font-display text-base font-extrabold text-ink">
              Shift Handover &amp; Reconciliation • {closingSession.terminal_code}
            </h3>

            <div className="rounded-xl bg-warm p-3 text-xs space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-muted font-sans">Opening Float:</span>
                <span>{formatPkr(closingSession.opening_float_paisa)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted font-sans">Cash Sales:</span>
                <span>{formatPkr(closingSession.financials.cashSalesPaisa)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-extrabold text-brand-dark">
                <span className="font-sans">Expected Cash in Till:</span>
                <span>{formatPkr(closingSession.expected_closing_paisa)}</span>
              </div>
            </div>

            <form onSubmit={handleCloseShiftSubmit} className="space-y-3.5">
              <div>
                <Label className="text-xs">
                  Actual Physical Cash Counted in Till (Rs.)
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={actualCountPkr}
                  onChange={(e) => setActualCountPkr(e.target.value)}
                  placeholder="Count notes and coins..."
                  className="mt-1 h-10 font-mono text-sm font-extrabold"
                  required
                />
              </div>

              <div>
                <Label className="text-xs">Handoff Notes / Next Shift Prep (Optional)</Label>
                <Input
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="e.g. Handed over to evening shift..."
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setClosingSession(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Complete Handover &amp; Start Next Shift
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}