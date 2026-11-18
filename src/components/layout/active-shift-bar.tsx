"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  Check,
  Clock,
  SlidersHorizontal,
  Timer,
} from "lucide-react";
import type { UserRole } from "@/types/system";
import type { ShiftScheduleState } from "@/app/api/workspace/shift-state/route";
import { workspaceQueryKeys } from "@/lib/query/cache-keys";

type ShiftKey = "MORNING" | "EVENING" | "NIGHT";

function parseTimeToSeconds(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr) || 0;
  const m = Number(mStr) || 0;
  return h * 3600 + m * 60;
}

function getPkClockSeconds(nowMs: number): {
  secondsOfDay: number;
  datePk: string;
  timeLabel: string;
} {
  const d = new Date(nowMs);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hrRaw = Number(get("hour"));
  const hr = hrRaw === 24 ? 0 : hrRaw;
  const min = Number(get("minute"));
  const sec = Number(get("second"));
  const datePk = `${get("year")}-${get("month")}-${get("day")}`;
  const timeLabel = `${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  return {
    secondsOfDay: hr * 3600 + min * 60 + sec,
    datePk,
    timeLabel,
  };
}

function isInWindow(nowSec: number, startSec: number, endSec: number): boolean {
  if (startSec === endSec) return false;
  if (startSec < endSec) {
    return nowSec >= startSec && nowSec < endSec;
  }
  return nowSec >= startSec || nowSec < endSec;
}

function secondsUntilEnd(nowSec: number, endSec: number): number {
  const DAY = 86400;
  // Normalize 00:00 endSec (0) to end-of-day unless wrapped past midnight
  const target = endSec === 0 && nowSec > 0 ? DAY : endSec;
  if (target > nowSec) return target - nowSec;
  return DAY - nowSec + target;
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function fetchShiftState(): Promise<ShiftScheduleState> {
  const res = await fetch("/api/workspace/shift-state", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!res.ok) {
    throw new Error("Failed to load shift state");
  }
  return res.json();
}

export function ActiveShiftBar({ userRole }: { userRole: UserRole }) {
  const queryClient = useQueryClient();
  const canSwitch = userRole === "OWNER" || userRole === "MANAGER";

  const { data: schedule } = useQuery<ShiftScheduleState>({
    queryKey: ["workspace", "shift-state"],
    queryFn: fetchShiftState,
    staleTime: 60 * 1000,
  });

  const [nowMs, setNowMs] = React.useState<number>(() => Date.now());
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);

  const morningStart = schedule?.morningStart ?? "08:00";
  const morningEnd = schedule?.morningEnd ?? "16:00";
  const eveningStart = schedule?.eveningStart ?? "16:00";
  const eveningEnd = schedule?.eveningEnd ?? "00:00";

  const [draftOverrides, setDraftOverrides] = React.useState<{
    mStart?: string;
    mEnd?: string;
    eStart?: string;
    eEnd?: string;
  }>({});

  const draftMorningStart = draftOverrides.mStart ?? morningStart;
  const draftMorningEnd = draftOverrides.mEnd ?? morningEnd;
  const draftEveningStart = draftOverrides.eStart ?? eveningStart;
  const draftEveningEnd = draftOverrides.eEnd ?? eveningEnd;

  // Real-time 1-second timer for automatic countdown & shift transition
  React.useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    if (!popoverOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopoverOpen(false);
    };
    window.addEventListener("mousedown", onOutside);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onOutside);
      window.removeEventListener("keydown", onEsc);
    };
  }, [popoverOpen]);

  const { secondsOfDay, datePk, timeLabel } = getPkClockSeconds(nowMs);
  const mStartSec = parseTimeToSeconds(morningStart);
  const mEndSec = parseTimeToSeconds(morningEnd);
  const eStartSec = parseTimeToSeconds(eveningStart);
  const eEndSec = parseTimeToSeconds(eveningEnd);

  const clockShift: ShiftKey = isInWindow(secondsOfDay, mStartSec, mEndSec)
    ? "MORNING"
    : isInWindow(secondsOfDay, eStartSec, eEndSec)
    ? "EVENING"
    : "NIGHT";

  const hasValidOverride =
    Boolean(schedule?.overrideShift) && schedule?.overrideDate === datePk;
  const activeShift: ShiftKey = hasValidOverride
    ? (schedule!.overrideShift as ShiftKey)
    : clockShift;

  const endSecForActive =
    activeShift === "MORNING"
      ? mEndSec
      : activeShift === "EVENING"
      ? eEndSec
      : mStartSec;
  const remainingSeconds = secondsUntilEnd(secondsOfDay, endSecForActive);
  const countdownStr = formatCountdown(remainingSeconds);

  async function applyShiftUpdate(payload: {
    overrideShift?: ShiftKey | null;
    morningStart?: string;
    morningEnd?: string;
    eveningStart?: string;
    eveningEnd?: string;
  }) {
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/workspace/shift-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to update shift.");
      }
      queryClient.setQueryData(["workspace", "shift-state"], json);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.section("shifts") }),
        queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.section("dashboard") }),
      ]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        suppressHydrationWarning
        onClick={() => setPopoverOpen((v) => !v)}
        aria-expanded={popoverOpen}
        title="Active Shift Status, Countdown Timer & Shift Switcher"
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[var(--warm)] border border-[var(--border)] hover:border-[var(--primary)]/40 text-[11px] sm:text-xs font-mono text-[var(--foreground)] shadow-[inset_0_1px_0_var(--glass-highlight)] transition cursor-pointer"
      >
        <span className="hidden lg:inline text-[var(--foreground-secondary)]">
          Shifts:
        </span>

        {/* Morning Pill */}
        <span
          className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all ${
            activeShift === "MORNING"
              ? "bg-gradient-to-r from-[#FF7B1C] to-[#FF6A00] text-white font-extrabold shadow-xs"
              : "text-[var(--foreground-secondary)] opacity-70"
          }`}
        >
          {activeShift === "MORNING" && (
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          )}
          <span>Morning {morningStart}–{morningEnd}</span>
        </span>

        {/* Evening Pill */}
        <span
          className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all ${
            activeShift === "EVENING"
              ? "bg-gradient-to-r from-[#FF7B1C] to-[#FF6A00] text-white font-extrabold shadow-xs"
              : "text-[var(--foreground-secondary)] opacity-70"
          }`}
        >
          {activeShift === "EVENING" && (
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          )}
          <span>Evening {eveningStart}–{eveningEnd}</span>
        </span>

        {/* Night Pill when active */}
        {activeShift === "NIGHT" && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-500 text-white font-extrabold shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            <span>Night Shift</span>
          </span>
        )}

        {/* Mobile active label */}
        <span className="sm:hidden inline-flex items-center gap-1 font-extrabold text-[var(--primary)]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {activeShift === "MORNING"
            ? "AM"
            : activeShift === "EVENING"
            ? "PM"
            : "NIGHT"}
        </span>

        {/* Live Countdown Timer */}
        <span
          suppressHydrationWarning
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/12 border border-emerald-500/25 px-2 py-0.5 text-[10px] sm:text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400"
        >
          <Timer className="h-3 w-3 shrink-0" />
          <span>{countdownStr} left</span>
        </span>

        {hasValidOverride && (
          <span className="hidden xl:inline rounded-md bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400">
            Manual
          </span>
        )}
      </button>

      {popoverOpen && (
        <div className="glass-modal absolute left-0 mt-2 w-80 sm:w-96 rounded-2xl p-4 z-50 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--primary)]" />
              <div>
                <h4 className="font-display text-xs font-extrabold text-[var(--foreground)]">
                  Live Shift Monitor (PKT {timeLabel})
                </h4>
                <p className="text-[10px] font-mono text-[var(--muted)]">
                  {hasValidOverride
                    ? `Switched manually to ${activeShift}`
                    : `Auto-detected by Asia/Karachi schedule`}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
              {countdownStr} left
            </span>
          </div>

          {errorMsg && (
            <p className="rounded-xl bg-rose-500/10 border border-rose-500/25 px-3 py-2 text-[11px] font-bold text-rose-500">
              {errorMsg}
            </p>
          )}

          {/* Active Shift Quick Switcher */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
              <ArrowRightLeft className="h-3 w-3 text-[var(--primary)]" />
              {canSwitch ? "Switch Active Shift" : "Current Shift Status"}
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {(
                [
                  { key: null, label: `Auto (${clockShift})` },
                  { key: "MORNING", label: `Morning (${morningStart}–${morningEnd})` },
                  { key: "EVENING", label: `Evening (${eveningStart}–${eveningEnd})` },
                  { key: "NIGHT", label: "Night Shift" },
                ] as Array<{ key: ShiftKey | null; label: string }>
              ).map((opt) => {
                const selected =
                  opt.key === null
                    ? !hasValidOverride
                    : hasValidOverride && activeShift === opt.key;
                return (
                  <button
                    key={opt.key ?? "AUTO"}
                    type="button"
                    disabled={!canSwitch || saving}
                    onClick={() => applyShiftUpdate({ overrideShift: opt.key })}
                    className={`flex items-center justify-between gap-1.5 rounded-xl px-2.5 py-2 text-left text-[11px] font-bold border transition ${
                      selected
                        ? "border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)]"
                        : "border-[var(--border)] bg-[var(--warm)] text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
                    } ${!canSwitch ? "opacity-75 cursor-default" : "cursor-pointer"}`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {canSwitch && (
            <div className="space-y-2.5 border-t border-[var(--border)] pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                <SlidersHorizontal className="h-3 w-3 text-[var(--primary)]" />
                Shift Schedule Hours (PKT)
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div>
                  <span className="text-[10px] text-[var(--muted)]">Morning Start</span>
                  <input
                    type="time"
                    value={draftMorningStart}
                    onChange={(e) => setDraftOverrides((p) => ({ ...p, mStart: e.target.value }))}
                    className="mt-0.5 h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2 text-[var(--foreground)]"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-[var(--muted)]">Morning End</span>
                  <input
                    type="time"
                    value={draftMorningEnd}
                    onChange={(e) => setDraftOverrides((p) => ({ ...p, mEnd: e.target.value }))}
                    className="mt-0.5 h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2 text-[var(--foreground)]"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-[var(--muted)]">Evening Start</span>
                  <input
                    type="time"
                    value={draftEveningStart}
                    onChange={(e) => setDraftOverrides((p) => ({ ...p, eStart: e.target.value }))}
                    className="mt-0.5 h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2 text-[var(--foreground)]"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-[var(--muted)]">Evening End</span>
                  <input
                    type="time"
                    value={draftEveningEnd}
                    onChange={(e) => setDraftOverrides((p) => ({ ...p, eEnd: e.target.value }))}
                    className="mt-0.5 h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2 text-[var(--foreground)]"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  applyShiftUpdate({
                    morningStart: draftMorningStart,
                    morningEnd: draftMorningEnd,
                    eveningStart: draftEveningStart,
                    eveningEnd: draftEveningEnd,
                  })
                }
                className="w-full rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] py-2 text-xs font-extrabold text-white transition cursor-pointer disabled:opacity-60"
              >
                {saving ? "Saving Schedule..." : "Save Schedule & Sync Timer"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
