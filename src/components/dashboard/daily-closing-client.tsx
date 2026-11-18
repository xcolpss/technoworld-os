"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Calendar,
  CheckCircle2,
  Coins,
  Download,
  FileSpreadsheet,
  History,
  Plus,
  Printer,
  Receipt,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SectionRefreshButton } from "@/components/ui/section-refresh-button";
import { formatPkr, pkrToPaisa } from "@/lib/format/currency";
import { downloadCsvFile, downloadXlsxWorkbook } from "@/lib/export/xlsx";
import {
  loadClosingDataForDateAction,
  saveDailyClosingAction,
  voidDailyClosingAction,
  type ClosingExpenseEntry,
  type ClosingHistorySummary,
  type ClosingShiftLabel,
  type ClosingWageEntry,
  type DailyClosingRecord,
} from "@/app/(workspace)/dashboard/closing/actions";
import type { UserRole } from "@/types/system";

const CLOSING_SHIFTS: { value: ClosingShiftLabel; label: string }[] = [
  { value: "FULL_DAY", label: "Full Day" },
  { value: "MORNING", label: "Morning Shift" },
  { value: "EVENING", label: "Evening Shift" },
  { value: "NIGHT", label: "Night Shift" },
];

const SHIFT_LABELS: Record<ClosingShiftLabel, string> = {
  FULL_DAY: "Full Day",
  MORNING: "Morning",
  EVENING: "Evening",
  NIGHT: "Night",
};

interface DailyClosingClientProps {
  initialRecord: DailyClosingRecord;
  initialHistory: ClosingHistorySummary[];
  businessName: string;
  userRole?: UserRole;
  onSavedClosing?: () => void | Promise<unknown>;
  onForceRefresh?: () => void | Promise<unknown>;
  isRefreshing?: boolean;
  lastUpdatedAt?: number;
}

export function DailyClosingClient({
  initialRecord,
  initialHistory,
  businessName,
  userRole = "OWNER",
  onSavedClosing,
  onForceRefresh,
  isRefreshing = false,
  lastUpdatedAt,
}: DailyClosingClientProps) {
  const router = useRouter();
  const [record, setRecord] = React.useState<DailyClosingRecord>(initialRecord);
  const [history, setHistory] =
    React.useState<ClosingHistorySummary[]>(initialHistory);

  const [reportDate, setReportDate] = React.useState(initialRecord.closingDate);
  const [shiftLabel, setShiftLabel] = React.useState<ClosingShiftLabel>(
    initialRecord.shiftLabel ?? "FULL_DAY"
  );
  const [morningCashPkr, setMorningCashPkr] = React.useState(
    String(Math.round(initialRecord.morningCashPaisa / 100))
  );
  const [eveningCashPkr, setEveningCashPkr] = React.useState(
    String(Math.round(initialRecord.eveningCashPaisa / 100))
  );
  const [nightCashPkr, setNightCashPkr] = React.useState(
    String(Math.round(initialRecord.nightCashPaisa / 100))
  );
  const [actualClosingPkr, setActualClosingPkr] = React.useState(
    String(Math.round(initialRecord.actualClosingPaisa / 100))
  );
  const [expenses, setExpenses] = React.useState<ClosingExpenseEntry[]>(
    initialRecord.closingExpenses
  );
  const [wages, setWages] = React.useState<ClosingWageEntry[]>(
    initialRecord.wages
  );
  const [notes, setNotes] = React.useState(initialRecord.notes);

  const [newExpDesc, setNewExpDesc] = React.useState("");
  const [newExpCat, setNewExpCat] = React.useState("Utilities");
  const [newExpAmtPkr, setNewExpAmtPkr] = React.useState("");

  const [newStaffName, setNewStaffName] = React.useState("");
  const [newStaffRole, setNewStaffRole] = React.useState("Staff");
  const [newStaffWagePkr, setNewStaffWagePkr] = React.useState("");

  const [isLoadingDate, setIsLoadingDate] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [voidTarget, setVoidTarget] = React.useState<{
    closingId?: string;
    closingDate: string;
    shiftLabel: ClosingShiftLabel;
  } | null>(null);
  const [voidReason, setVoidReason] = React.useState("");
  const [isVoiding, setIsVoiding] = React.useState(false);
  const canVoidClosing = userRole === "OWNER" || userRole === "MANAGER";
  const [toast, setToast] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const syncFormFromRecord = React.useCallback(
    (next: DailyClosingRecord, nextHistory: ClosingHistorySummary[]) => {
      setRecord(next);
      setHistory(nextHistory);
      setReportDate(next.closingDate);
      setShiftLabel(next.shiftLabel ?? "FULL_DAY");
      setMorningCashPkr(String(Math.round(next.morningCashPaisa / 100)));
      setEveningCashPkr(String(Math.round(next.eveningCashPaisa / 100)));
      setNightCashPkr(String(Math.round(next.nightCashPaisa / 100)));
      setActualClosingPkr(String(Math.round(next.actualClosingPaisa / 100)));
      setExpenses(next.closingExpenses);
      setWages(next.wages);
      setNotes(next.notes);
    },
    []
  );

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  };

  const handleLoadSelection = async (
    nextDate: string,
    nextShift: ClosingShiftLabel
  ) => {
    if (!nextDate) return;
    setReportDate(nextDate);
    setShiftLabel(nextShift);
    setIsLoadingDate(true);
    try {
      const res = await loadClosingDataForDateAction(nextDate, nextShift);
      syncFormFromRecord(res.record, res.history);
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to load closing date."
      );
    } finally {
      setIsLoadingDate(false);
    }
  };

  const handleDateChange = (nextDate: string) => {
    void handleLoadSelection(nextDate, shiftLabel);
  };

  const handleShiftChange = (nextShift: ClosingShiftLabel) => {
    void handleLoadSelection(reportDate, nextShift);
  };

  const morningCashPaisa = pkrToPaisa(morningCashPkr || "0");
  const eveningCashPaisa = pkrToPaisa(eveningCashPkr || "0");
  const nightCashPaisa = pkrToPaisa(nightCashPkr || "0");
  const actualClosingPaisa = pkrToPaisa(actualClosingPkr || "0");

  const totalExpensesPaisa = expenses.reduce(
    (acc, e) => acc + Math.max(0, Number(e.amountPaisa || 0)),
    0
  );
  const totalWagesPaisa = wages.reduce(
    (acc, w) => acc + Math.max(0, Number(w.wagePaisa || 0)),
    0
  );
  const totalOutflowsPaisa = totalExpensesPaisa + totalWagesPaisa;
  const totalCashCountedInPaisa =
    morningCashPaisa + eveningCashPaisa + nightCashPaisa;
  const expectedClosingPaisa = totalCashCountedInPaisa - totalOutflowsPaisa;
  const cashDifferencePaisa = actualClosingPaisa - expectedClosingPaisa;

  // Monthly summary computed from non-voided persisted historical closings in current month
  const currentMonthPrefix = reportDate.slice(0, 7);
  const monthlySummary = React.useMemo(() => {
    const matching = history.filter(
      (h) => h.status !== "VOIDED" && h.closingDate.startsWith(currentMonthPrefix)
    );
    return matching.reduce(
      (acc, h) => ({
        daysClosed: acc.daysClosed + 1,
        netSalesPaisa: acc.netSalesPaisa + h.netSalesPaisa,
        expensesPaisa: acc.expensesPaisa + h.totalExpensesPaisa,
        wagesPaisa: acc.wagesPaisa + h.totalWagesPaisa,
        variancePaisa: acc.variancePaisa + h.cashDifferencePaisa,
      }),
      {
        daysClosed: 0,
        netSalesPaisa: 0,
        expensesPaisa: 0,
        wagesPaisa: 0,
        variancePaisa: 0,
      }
    );
  }, [currentMonthPrefix, history]);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = pkrToPaisa(newExpAmtPkr);
    if (!newExpDesc.trim() || amt <= 0) return;
    setExpenses((prev) => [
      ...prev,
      {
        id: `exp-${Date.now()}`,
        description: newExpDesc.trim(),
        category: newExpCat,
        amountPaisa: amt,
        paidBy: record.preparedByName || "Owner",
        method: "CASH_TILL",
        fromDb: false,
      },
    ]);
    setNewExpDesc("");
    setNewExpAmtPkr("");
  };

  const handleRemoveExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const handleWageChange = (id: string, pkrValue: string) => {
    const nextPaisa = pkrToPaisa(pkrValue || "0");
    setWages((prev) =>
      prev.map((w) => (w.id === id ? { ...w, wagePaisa: nextPaisa } : w))
    );
  };

  const handleWageNotesChange = (id: string, nextNotes: string) => {
    setWages((prev) =>
      prev.map((w) => (w.id === id ? { ...w, notes: nextNotes } : w))
    );
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = pkrToPaisa(newStaffWagePkr || "0");
    if (!newStaffName.trim()) return;
    setWages((prev) => [
      ...prev,
      {
        id: `staff-${Date.now()}`,
        name: newStaffName.trim(),
        role: newStaffRole,
        wagePaisa: amt,
        notes: "Daily wage",
      },
    ]);
    setNewStaffName("");
    setNewStaffWagePkr("");
  };

  const handleRemoveWage = (id: string) => {
    setWages((prev) => prev.filter((w) => w.id !== id));
  };

  const handleConfirmVoidClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidTarget) return;
    setIsVoiding(true);
    try {
      const updated = await voidDailyClosingAction({
        closingId: voidTarget.closingId,
        closingDate: voidTarget.closingDate,
        shiftLabel: voidTarget.shiftLabel,
        reason: voidReason,
      });
      if (
        updated.record.closingDate === reportDate &&
        updated.record.shiftLabel === shiftLabel
      ) {
        syncFormFromRecord(updated.record, updated.history);
      } else {
        setHistory(updated.history);
      }
      showToast(
        "success",
        `Daily closing for ${voidTarget.closingDate} (${SHIFT_LABELS[voidTarget.shiftLabel]}) marked VOIDED. You can now save a replacement closing.`
      );
      setVoidTarget(null);
      setVoidReason("");
      if (onSavedClosing) await onSavedClosing();
      else router.refresh();
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to void daily closing."
      );
    } finally {
      setIsVoiding(false);
    }
  };

  const handleSaveClosing = async () => {
    setIsSaving(true);
    try {
      const saved = await saveDailyClosingAction({
        closingDate: reportDate,
        shiftLabel,
        replacesClosingId: record.replacesClosingId ?? null,
        morningCashPaisa,
        eveningCashPaisa,
        nightCashPaisa,
        actualClosingPaisa,
        closingExpenses: expenses,
        wages,
        notes,
      });
      syncFormFromRecord(saved.record, saved.history);
      showToast(
        "success",
        record.replacesClosingId
          ? `Replacement daily closing for ${reportDate} (${SHIFT_LABELS[shiftLabel]}) saved! Original voided record remains preserved.`
          : `Daily closing for ${reportDate} (${SHIFT_LABELS[shiftLabel]}) saved permanently to Local PostgreSQL!`
      );
      if (onSavedClosing) await onSavedClosing();
      else router.refresh();
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to save daily closing."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCsv = () => {
    downloadCsvFile(
      `TechnoWorld-Daily-Closing-${reportDate}.csv`,
      ["Section", "Item / Metric", "Category / Role", "Amount (PKR)", "Notes"],
      [
        ["Sales", "Gross POS Sales", reportDate, Math.round(record.grossSalesPaisa / 100), `${record.transactionCount} bills`],
        ["Sales", "Refunds & Voids", reportDate, Math.round(record.refundsPaisa / 100), ""],
        ["Sales", "Net Sales", reportDate, Math.round(record.netSalesPaisa / 100), ""],
        ["Sales", "Digital Payments", reportDate, Math.round(record.digitalSalesPaisa / 100), "JazzCash / EasyPaisa / Bank / Card"],
        ["Cash", "Morning Shift Cash", "08:00-16:00", Math.round(morningCashPaisa / 100), ""],
        ["Cash", "Evening Shift Cash", "16:00-00:00", Math.round(eveningCashPaisa / 100), ""],
        ["Cash", "Night / Other Cash", "After-Hours", Math.round(nightCashPaisa / 100), ""],
        ...expenses.map((e) => [
          "Expense",
          e.description,
          e.category,
          Math.round(e.amountPaisa / 100),
          e.fromDb ? "Synced from /expenses" : "Added in Closing",
        ]),
        ...wages.map((w) => [
          "Daily Wage",
          w.name,
          w.role,
          Math.round(w.wagePaisa / 100),
          w.notes,
        ]),
        ["Reconciliation", "Expected Closing Cash", reportDate, Math.round(expectedClosingPaisa / 100), ""],
        ["Reconciliation", "Actual Physical Cash", reportDate, Math.round(actualClosingPaisa / 100), ""],
        ["Reconciliation", "Cash Variance", reportDate, Math.round(cashDifferencePaisa / 100), cashDifferencePaisa === 0 ? "Exact Match" : "Check Drawer"],
      ]
    );
  };

  const handleExportExcel = () => {
    downloadXlsxWorkbook(`TechnoWorld-Closing-${reportDate}.xlsx`, [
      {
        name: "Daily Closing Summary",
        headers: ["Metric", "Value (PKR)", "Details"],
        rows: [
          ["Business", businessName, reportDate],
          ["Gross POS Sales", Math.round(record.grossSalesPaisa / 100), `${record.transactionCount} bills`],
          ["Refunds & Voids", Math.round(record.refundsPaisa / 100), ""],
          ["Net Sales", Math.round(record.netSalesPaisa / 100), ""],
          ["Digital Sales Collected", Math.round(record.digitalSalesPaisa / 100), "JazzCash / EasyPaisa / Bank / Card"],
          ["Morning Cash", Math.round(morningCashPaisa / 100), "08:00-16:00 PKT"],
          ["Evening Cash", Math.round(eveningCashPaisa / 100), "16:00-00:00 PKT"],
          ["Night Cash", Math.round(nightCashPaisa / 100), "After-Hours"],
          ["Total Cash Inflows", Math.round(totalCashCountedInPaisa / 100), ""],
          ["Total Expenses", Math.round(totalExpensesPaisa / 100), `${expenses.length} items`],
          ["Total Daily Wages", Math.round(totalWagesPaisa / 100), `${wages.length} staff`],
          ["Expected Closing Cash", Math.round(expectedClosingPaisa / 100), ""],
          ["Actual Counted Cash", Math.round(actualClosingPaisa / 100), ""],
          ["Variance", Math.round(cashDifferencePaisa / 100), notes],
        ],
      },
      {
        name: "Expenses",
        headers: ["Description", "Category", "Amount (PKR)", "Source"],
        rows: expenses.map((e) => [
          e.description,
          e.category,
          Math.round(e.amountPaisa / 100),
          e.fromDb ? "Live Expense Ledger" : "Closing Entry",
        ]),
      },
      {
        name: "Daily Wages",
        headers: ["Staff Name", "Role", "Wage (PKR)", "Notes"],
        rows: wages.map((w) => [
          w.name,
          w.role,
          Math.round(w.wagePaisa / 100),
          w.notes,
        ]),
      },
      {
        name: "Closing History",
        headers: ["Date", "Net Sales (PKR)", "Expenses (PKR)", "Wages (PKR)", "Expected (PKR)", "Actual (PKR)", "Variance (PKR)"],
        rows: history.map((h) => [
          h.closingDate,
          Math.round(h.netSalesPaisa / 100),
          Math.round(h.totalExpensesPaisa / 100),
          Math.round(h.totalWagesPaisa / 100),
          Math.round(h.expectedClosingPaisa / 100),
          Math.round(h.actualClosingPaisa / 100),
          Math.round(h.cashDifferencePaisa / 100),
        ]),
      },
    ]);
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-xs font-bold text-[var(--foreground-secondary)] hover:text-[var(--primary)] transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Executive BI Dashboard
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/sales"
            className="text-xs font-bold text-[var(--primary)] hover:underline"
          >
            View in Sales History
          </Link>
          <Badge
            variant={
              record.status === "VOIDED"
                ? "danger"
                : record.status === "SAVED"
                ? "success"
                : "warning"
            }
            className="font-mono text-xs px-3 py-1"
          >
            {record.status === "VOIDED"
              ? `VOIDED (${reportDate} • ${SHIFT_LABELS[shiftLabel]})`
              : record.status === "SAVED"
              ? `Saved in Database (${reportDate} • ${SHIFT_LABELS[shiftLabel]})`
              : record.replacedVoided
              ? `Replacement Draft (${reportDate} • ${SHIFT_LABELS[shiftLabel]})`
              : `Live Draft (${reportDate} • ${SHIFT_LABELS[shiftLabel]})`}
          </Badge>
        </div>
      </div>

      <PageHeader
        eyebrow={`${businessName} • Accountant & Daily Reconciliation`}
        title="Daily Closing & Financial Sheet"
        description="Auto-populated from live POS sales, digital collections, and shop expenses. Record shift cash counts, daily staff wages, save historical closings, and export."
        actions={
          <div className="print:hidden flex flex-wrap items-center gap-2">
            {onForceRefresh && (
              <SectionRefreshButton
                onRefresh={onForceRefresh}
                isFetching={isRefreshing}
                lastUpdatedAt={lastUpdatedAt}
              />
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleExportCsv}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleExportExcel}
              className="gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" /> Excel (.xlsx)
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" /> Printable PDF
            </Button>
            {canVoidClosing && record.status === "SAVED" && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  setVoidTarget({
                    closingId: record.id ?? undefined,
                    closingDate: reportDate,
                    shiftLabel,
                  });
                  setVoidReason("");
                }}
                className="gap-1.5"
              >
                <Ban className="h-3.5 w-3.5" /> Void Entry
              </Button>
            )}
            <Button
              type="button"
              loading={isSaving}
              onClick={handleSaveClosing}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />{" "}
              {record.replacedVoided && record.status === "DRAFT"
                ? "Save Replacement Closing"
                : "Save Daily Closing"}
            </Button>
          </div>
        }
      />

      {record.status === "DRAFT" && record.replacedVoided && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-start gap-2.5 text-amber-500 font-bold">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p>
                  Creating replacement closing for {reportDate} ({SHIFT_LABELS[shiftLabel]}). Previous closing was VOIDED and remains preserved in audit &amp; Sales History.
                </p>
                <p className="font-normal text-[11px] opacity-90 mt-0.5">
                  Void Reason: {record.replacedVoided.voidReason || "Correction required"}
                  {record.replacedVoided.voidedByName
                    ? ` • Voided by ${record.replacedVoided.voidedByName}`
                    : ""}
                </p>
              </div>
            </div>
            <Badge variant="warning" className="font-mono shrink-0">
              REPLACEMENT READY
            </Badge>
          </CardContent>
        </Card>
      )}

      {record.status === "VOIDED" && (
        <Card className="border-rose-500/40 bg-rose-500/10">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-start gap-2.5 text-rose-500 font-bold">
              <Ban className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p>
                  This Daily Closing entry ({reportDate}) is VOIDED and excluded from all totals, monthly summaries, and Profit &amp; Loss reports.
                </p>
                <p className="font-normal text-[11px] opacity-90 mt-0.5">
                  Reason: {record.voidReason || "Accidental entry"}
                  {record.voidedByName ? ` • Voided by ${record.voidedByName}` : ""}
                </p>
              </div>
            </div>
            <Badge variant="danger" className="font-mono shrink-0">
              AUDIT PRESERVED
            </Badge>
          </CardContent>
        </Card>
      )}

      {toast && (
        <Card
          className={
            toast.type === "success"
              ? "border-emerald-500/35 bg-emerald-500/10"
              : "border-rose-500/35 bg-rose-500/10"
          }
        >
          <CardContent className="p-3.5 flex items-center gap-2.5 text-xs font-bold">
            <CheckCircle2
              className={`h-4 w-4 shrink-0 ${
                toast.type === "success" ? "text-emerald-500" : "text-rose-500"
              }`}
            />
            <span>{toast.message}</span>
          </CardContent>
        </Card>
      )}

      {/* Live POS & Date Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label htmlFor="closingDatePicker" className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[var(--primary)]" />
              Closing Date &amp; Shift (PKT)
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                id="closingDatePicker"
                type="date"
                value={reportDate}
                disabled={isLoadingDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="h-9 font-mono text-xs font-bold"
              />
              <select
                aria-label="Closing Shift"
                value={shiftLabel}
                disabled={isLoadingDate}
                onChange={(e) =>
                  handleShiftChange(e.target.value as ClosingShiftLabel)
                }
                className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs font-bold text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              >
                {CLOSING_SHIFTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-[10px] font-bold uppercase text-[var(--muted)]">
              Live POS Net Sales ({record.transactionCount} bills)
            </p>
            <p className="text-xl font-black font-mono text-[var(--foreground)]">
              {formatPkr(record.netSalesPaisa)}
            </p>
            <p className="text-[10px] text-[var(--foreground-secondary)]">
              Gross {formatPkr(record.grossSalesPaisa)} • Refunds {formatPkr(record.refundsPaisa)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-[10px] font-bold uppercase text-[var(--muted)]">
              Live Cash vs Digital Split
            </p>
            <p className="text-sm font-black font-mono text-[var(--foreground)]">
              Cash: {formatPkr(record.cashCollectedPaisa)}
            </p>
            <p className="text-xs font-mono font-bold text-blue-500">
              Digital: {formatPkr(record.digitalSalesPaisa)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-[10px] font-bold uppercase text-[var(--muted)]">
              Expected Drawer vs Actual
            </p>
            <p className="text-sm font-black font-mono text-[var(--foreground)]">
              Exp: {formatPkr(expectedClosingPaisa)}
            </p>
            <p
              className={`text-xs font-mono font-bold ${
                cashDifferencePaisa === 0
                  ? "text-emerald-500"
                  : "text-amber-500"
              }`}
            >
              Diff: {formatPkr(cashDifferencePaisa)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Shift Cash Drawer Inputs */}
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
            <Coins className="h-5 w-5 text-[var(--primary)]" />
            <h3 className="font-display text-sm sm:text-base font-extrabold text-[var(--foreground)]">
              Shift Cash Counts &amp; Drawer Reconciliation (PKR)
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <Label>Morning Shift Cash (08:00–16:00)</Label>
              <Input
                type="number"
                min={0}
                value={morningCashPkr}
                onChange={(e) => setMorningCashPkr(e.target.value)}
                className="font-mono font-bold"
              />
            </div>
            <div>
              <Label>Evening Shift Cash (16:00–00:00)</Label>
              <Input
                type="number"
                min={0}
                value={eveningCashPkr}
                onChange={(e) => setEveningCashPkr(e.target.value)}
                className="font-mono font-bold"
              />
            </div>
            <div>
              <Label>Night / Carry-In Cash</Label>
              <Input
                type="number"
                min={0}
                value={nightCashPkr}
                onChange={(e) => setNightCashPkr(e.target.value)}
                className="font-mono font-bold"
              />
            </div>
            <div>
              <Label>Actual Counted Closing Cash</Label>
              <Input
                type="number"
                min={0}
                value={actualClosingPkr}
                onChange={(e) => setActualClosingPkr(e.target.value)}
                className="font-mono font-bold border-[var(--primary)]/50"
              />
            </div>
          </div>
          <div>
            <Label>Accountant / Closing Remarks</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain any cash variance, bank deposits, or owner handover notes..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Expenses & Daily Staff Wages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Expenses Card */}
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="font-display text-sm sm:text-base font-extrabold text-[var(--foreground)] flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[var(--primary)]" />
                Daily Shop Expenses
              </h3>
              <span className="font-mono text-sm font-black text-rose-500">
                {formatPkr(totalExpensesPaisa)}
              </span>
            </div>

            <form
              onSubmit={handleAddExpense}
              className="print:hidden grid grid-cols-1 sm:grid-cols-3 gap-2"
            >
              <Input
                placeholder="Description"
                value={newExpDesc}
                onChange={(e) => setNewExpDesc(e.target.value)}
                className="text-xs"
              />
              <Input
                type="number"
                min={1}
                placeholder="Amount (PKR)"
                value={newExpAmtPkr}
                onChange={(e) => setNewExpAmtPkr(e.target.value)}
                className="text-xs font-mono"
              />
              <div className="flex gap-1.5">
                <select
                  value={newExpCat}
                  onChange={(e) => setNewExpCat(e.target.value)}
                  className="h-11 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 text-xs font-semibold"
                >
                  <option value="Utilities">Utilities</option>
                  <option value="Staff Welfare">Welfare</option>
                  <option value="Supplies">Supplies</option>
                  <option value="Maintenance">Repair</option>
                  <option value="Other">Other</option>
                </select>
                <Button type="submit" size="sm" aria-label="Add expense">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </form>

            {expenses.length === 0 ? (
              <p className="text-xs text-[var(--muted)] py-6 text-center">
                No expenses logged for {reportDate}.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {expenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--warm)]/50 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-[var(--foreground)] truncate">
                        {exp.description}
                      </p>
                      <p className="text-[10px] text-[var(--muted)]">
                        {exp.category} •{" "}
                        {exp.fromDb ? "Synced from /expenses" : "Closing entry"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-rose-500">
                        {formatPkr(exp.amountPaisa)}
                      </span>
                      {!exp.fromDb && (
                        <button
                          type="button"
                          onClick={() => handleRemoveExpense(exp.id)}
                          className="print:hidden p-1 text-[var(--muted)] hover:text-rose-500 cursor-pointer"
                          aria-label={`Remove ${exp.description}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Staff Wages Card */}
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="font-display text-sm sm:text-base font-extrabold text-[var(--foreground)] flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--primary)]" />
                Daily Staff Wages
              </h3>
              <span className="font-mono text-sm font-black text-amber-500">
                {formatPkr(totalWagesPaisa)}
              </span>
            </div>

            <form
              onSubmit={handleAddStaff}
              className="print:hidden grid grid-cols-1 sm:grid-cols-3 gap-2"
            >
              <Input
                placeholder="Staff Name"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                className="text-xs"
              />
              <Input
                type="number"
                min={0}
                placeholder="Wage (PKR)"
                value={newStaffWagePkr}
                onChange={(e) => setNewStaffWagePkr(e.target.value)}
                className="text-xs font-mono"
              />
              <div className="flex gap-1.5">
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value)}
                  className="h-11 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 text-xs font-semibold"
                >
                  <option value="Staff">Staff</option>
                  <option value="Management">Management</option>
                  <option value="Support">Support</option>
                </select>
                <Button type="submit" size="sm" aria-label="Add staff wage">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </form>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {wages.map((w) => (
                <div
                  key={w.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--warm)]/50 p-2.5 grid grid-cols-12 items-center gap-2 text-xs"
                >
                  <div className="col-span-4 min-w-0">
                    <p className="font-bold text-[var(--foreground)] truncate">
                      {w.name}
                    </p>
                    <p className="text-[10px] text-[var(--muted)] truncate">
                      {w.role}
                    </p>
                  </div>
                  <div className="col-span-4">
                    <Input
                      type="text"
                      value={w.notes}
                      onChange={(e) =>
                        handleWageNotesChange(w.id, e.target.value)
                      }
                      placeholder="Notes"
                      className="h-8 text-[11px]"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      min={0}
                      value={Math.round(w.wagePaisa / 100)}
                      onChange={(e) => handleWageChange(w.id, e.target.value)}
                      className="h-8 text-xs font-mono font-bold text-right"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveWage(w.id)}
                      className="print:hidden p-1 text-[var(--muted)] hover:text-rose-500 cursor-pointer"
                      aria-label={`Remove ${w.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Summary + Historical Saved Closings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 sm:p-5 space-y-3">
            <h3 className="font-display text-sm font-extrabold text-[var(--foreground)]">
              Monthly Summary ({currentMonthPrefix})
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--foreground-secondary)]">Days Closed:</span>
                <span className="font-mono font-bold">{monthlySummary.daysClosed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--foreground-secondary)]">Saved Net Sales:</span>
                <span className="font-mono font-bold">{formatPkr(monthlySummary.netSalesPaisa)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--foreground-secondary)]">Total Expenses:</span>
                <span className="font-mono font-bold text-rose-500">{formatPkr(monthlySummary.expensesPaisa)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--foreground-secondary)]">Total Wages:</span>
                <span className="font-mono font-bold text-amber-500">{formatPkr(monthlySummary.wagesPaisa)}</span>
              </div>
              <div className="flex justify-between border-t border-[var(--border)] pt-2">
                <span className="font-bold">Net Variance:</span>
                <span className="font-mono font-black">{formatPkr(monthlySummary.variancePaisa)}</span>
              </div>
            </div>
            <p className="text-[11px] text-[var(--muted)] pt-2 border-t border-[var(--border)]">
              Export status: CSV, Excel (.xlsx), and Printable PDF are active. Google Sheets / Slides cloud sync is not configured (no Google OAuth workspace credentials configured).
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <h3 className="font-display text-sm font-extrabold text-[var(--foreground)] flex items-center gap-2">
              <History className="h-4 w-4 text-[var(--primary)]" />
              Historical Saved Daily Closings (Click to Load / Edit)
            </h3>
            {history.length === 0 ? (
              <p className="text-xs text-[var(--muted)] py-8 text-center">
                No historical closings saved yet. Click Save Daily Closing above to record today.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--warm)]/60 text-[var(--muted)] uppercase">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Shift</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3 text-right">Net Sales</th>
                      <th className="py-2 px-3 text-right">Expenses</th>
                      <th className="py-2 px-3 text-right">Wages</th>
                      <th className="py-2 px-3 text-right">Actual Cash</th>
                      <th className="py-2 px-3 text-right">Variance</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {history.map((h) => {
                      const isVoided = h.status === "VOIDED";
                      return (
                        <tr
                          key={h.id}
                          className={
                            isVoided
                              ? "bg-rose-500/5 opacity-75"
                              : "hover:bg-[var(--warm)]/40"
                          }
                        >
                          <td className={`py-2 px-3 font-mono font-bold ${isVoided ? "line-through text-rose-500" : ""}`}>
                            {h.closingDate}
                          </td>
                          <td className="py-2 px-3 text-xs font-semibold text-[var(--foreground-secondary)]">
                            {SHIFT_LABELS[h.shiftLabel] ?? h.shiftLabel}
                          </td>
                          <td className="py-2 px-3">
                            {isVoided ? (
                              <Badge variant="danger" className="text-[10px]">
                                VOIDED
                              </Badge>
                            ) : (
                              <Badge variant="success" className="text-[10px]">
                                ACTIVE
                              </Badge>
                            )}
                          </td>
                          <td className={`py-2 px-3 text-right font-mono ${isVoided ? "line-through text-[var(--muted)]" : ""}`}>
                            {formatPkr(h.netSalesPaisa)}
                          </td>
                          <td className={`py-2 px-3 text-right font-mono text-rose-500 ${isVoided ? "line-through opacity-60" : ""}`}>
                            {formatPkr(h.totalExpensesPaisa)}
                          </td>
                          <td className={`py-2 px-3 text-right font-mono text-amber-500 ${isVoided ? "line-through opacity-60" : ""}`}>
                            {formatPkr(h.totalWagesPaisa)}
                          </td>
                          <td className={`py-2 px-3 text-right font-mono font-bold ${isVoided ? "line-through text-[var(--muted)]" : ""}`}>
                            {formatPkr(h.actualClosingPaisa)}
                          </td>
                          <td className={`py-2 px-3 text-right font-mono font-bold ${isVoided ? "line-through text-[var(--muted)]" : ""}`}>
                            {formatPkr(h.cashDifferencePaisa)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  void handleLoadSelection(
                                    h.closingDate,
                                    h.shiftLabel
                                  )
                                }
                              >
                                {isVoided ? "Replace" : "Load"}
                              </Button>
                              {canVoidClosing && !isVoided && (
                                <Button
                                  type="button"
                                  variant="danger"
                                  size="sm"
                                  onClick={() => {
                                    setVoidTarget({
                                      closingId: h.id,
                                      closingDate: h.closingDate,
                                      shiftLabel: h.shiftLabel,
                                    });
                                    setVoidReason("");
                                  }}
                                >
                                  <Ban className="h-3 w-3" /> Void
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Modal for Voiding a Daily Closing Entry */}
      {voidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm tw-backdrop-in p-4">
          <div className="glass-modal w-full max-w-md rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">
                  Void Daily Closing ({voidTarget.closingDate} •{" "}
                  {SHIFT_LABELS[voidTarget.shiftLabel]})?
                </h3>
                <p className="text-xs text-[var(--foreground-secondary)] mt-1">
                  The original closing record will be preserved as <strong className="text-rose-500">VOIDED</strong> in audit logs and Sales History. POS sales, payments, inventory, and cash sessions will not be modified, and you can immediately save a replacement closing for this shift.
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmVoidClosing} className="space-y-3">
              <div>
                <Label htmlFor="voidClosingReason">Reason for Voiding</Label>
                <Input
                  id="voidClosingReason"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Accidental duplicate submission or wrong cash count"
                  className="mt-1 h-10 text-xs"
                  required
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isVoiding}
                  onClick={() => {
                    setVoidTarget(null);
                    setVoidReason("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  loading={isVoiding}
                  className="gap-1.5"
                >
                  <Ban className="h-3.5 w-3.5" /> Confirm Void Entry
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
