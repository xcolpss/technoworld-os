"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, Moon, Sun, Monitor, CheckCircle2, Store, Clock, KeyRound } from "lucide-react";

export function SettingsClient({ businessName }: { businessName: string }) {
  const queryClient = useQueryClient();
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("light");
  const [shopName, setShopName] = useState(businessName || "TechnoWorld OS • Rawalpindi");
  const [printerWidth, setPrinterWidth] = useState("80mm");
  const [morningShiftStart, setMorningShiftStart] = useState("08:00");
  const [morningShiftEnd, setMorningShiftEnd] = useState("16:00");
  const [eveningShiftStart, setEveningShiftStart] = useState("16:00");
  const [eveningShiftEnd, setEveningShiftEnd] = useState("00:00");
  const [saved, setSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleChangePassword() {
    setPwMessage(null);
    if (!currentPassword || newPassword.length < 6) {
      setPwMessage({ type: "err", text: "New password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: "err", text: "New passwords do not match." });
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwMessage({ type: "err", text: data.error || "Failed to update password." });
      } else {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPwMessage({ type: "ok", text: "Password updated in local PostgreSQL." });
      }
    } catch {
      setPwMessage({ type: "err", text: "Unable to reach local server." });
    } finally {
      setPwLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const savedTheme = (localStorage.getItem("tw_theme_mode") as "light" | "dark" | "system") || "light";
      setThemeMode(savedTheme);

      const savedPrinterWidth = localStorage.getItem("tw_printer_width");
      if (savedPrinterWidth === "58mm" || savedPrinterWidth === "80mm") {
        setPrinterWidth(savedPrinterWidth);
      }

      const savedMorningStart = localStorage.getItem("tw_morning_start");
      const savedMorningEnd = localStorage.getItem("tw_morning_end");
      const savedEveningStart = localStorage.getItem("tw_evening_start");
      const savedEveningEnd = localStorage.getItem("tw_evening_end");
      if (savedMorningStart) setMorningShiftStart(savedMorningStart);
      if (savedMorningEnd) setMorningShiftEnd(savedMorningEnd);
      if (savedEveningStart) setEveningShiftStart(savedEveningStart);
      if (savedEveningEnd) setEveningShiftEnd(savedEveningEnd);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyTheme = (mode: "light" | "dark" | "system") => {
    setThemeMode(mode);
    localStorage.setItem("tw_theme_mode", mode);

    const root = document.documentElement;
    root.classList.remove("dark");

    if (mode === "dark") {
      root.classList.add("dark");
    } else if (mode === "system") {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (systemDark) root.classList.add("dark");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("tw_printer_width", printerWidth);
    localStorage.setItem("tw_morning_start", morningShiftStart);
    localStorage.setItem("tw_morning_end", morningShiftEnd);
    localStorage.setItem("tw_evening_start", eveningShiftStart);
    localStorage.setItem("tw_evening_end", eveningShiftEnd);

    try {
      const res = await fetch("/api/workspace/shift-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          morningStart: morningShiftStart,
          morningEnd: morningShiftEnd,
          eveningStart: eveningShiftStart,
          eveningEnd: eveningEndOrDefault(eveningShiftEnd),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        queryClient.setQueryData(["workspace", "shift-state"], updated);
      }
    } catch {
      // Keep local settings saved cleanly
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  function eveningEndOrDefault(val: string): string {
    return val || "00:00";
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <PageHeader
        eyebrow="TechnoWorld OS • System Configuration &amp; Preferences"
        title="System Settings"
        description="Configure shop operating timings, shift hours, thermal printers, currency preferences, and centralized theme appearance."
      />

      {saved && (
        <Card className="border-[var(--success)]/30 bg-[var(--success-soft)]">
          <CardContent className="p-4 flex items-center gap-3 text-[var(--success)]">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span className="text-xs font-bold">Settings, operating timings, and theme preferences saved successfully!</span>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-[var(--border)] pb-3">
              <Sun className="h-5 w-5 text-[var(--primary)]" />
              <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">Appearance &amp; Theme System</h3>
            </div>
            <div className="space-y-3 text-xs">
              <Label>Interface Theme Mode</Label>
              <p className="text-[11px] text-[var(--foreground-secondary)]">Choose between Light, Dark, or System Default appearance.</p>
              <div className="grid grid-cols-3 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => applyTheme("light")}
                  className={`card-3d-tile flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border font-bold cursor-pointer ${
                    themeMode === "light"
                      ? "border-[var(--primary)] bg-[var(--brand-soft)] text-[var(--primary)] shadow-[inset_0_1px_0_var(--glass-highlight),0_6px_16px_-4px_rgba(255,106,0,0.22)]"
                      : "border-[var(--border)] bg-[var(--warm)] text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Sun className="h-4 w-4" /> Light
                </button>
                <button
                  type="button"
                  onClick={() => applyTheme("dark")}
                  className={`card-3d-tile flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border font-bold cursor-pointer ${
                    themeMode === "dark"
                      ? "border-[var(--primary)] bg-[var(--brand-soft)] text-[var(--primary)] shadow-[inset_0_1px_0_var(--glass-highlight),0_6px_16px_-4px_rgba(255,106,0,0.22)]"
                      : "border-[var(--border)] bg-[var(--warm)] text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Moon className="h-4 w-4" /> Dark
                </button>
                <button
                  type="button"
                  onClick={() => applyTheme("system")}
                  className={`card-3d-tile flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border font-bold cursor-pointer ${
                    themeMode === "system"
                      ? "border-[var(--primary)] bg-[var(--brand-soft)] text-[var(--primary)] shadow-[inset_0_1px_0_var(--glass-highlight),0_6px_16px_-4px_rgba(255,106,0,0.22)]"
                      : "border-[var(--border)] bg-[var(--warm)] text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Monitor className="h-4 w-4" /> System
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-[var(--border)] pb-3">
              <Clock className="h-5 w-5 text-[var(--primary)]" />
              <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">Operating Timings &amp; Shifts</h3>
            </div>
            <div className="space-y-3.5 text-xs">
              <p className="text-[11px] text-[var(--foreground-secondary)]">Define shop operational hours and shift timings in Asia/Karachi (PKT).</p>
              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 p-3 rounded-xl bg-[var(--surface-secondary)]">
                <div>
                  <Label>Morning Shift Start</Label>
                  <input
                    type="time"
                    value={morningShiftStart}
                    onChange={(e) => setMorningShiftStart(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 font-mono font-bold text-[var(--foreground)]"
                  />
                </div>
                <div>
                  <Label>Morning Shift End</Label>
                  <input
                    type="time"
                    value={morningShiftEnd}
                    onChange={(e) => setMorningShiftEnd(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 font-mono font-bold text-[var(--foreground)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 p-3 rounded-xl bg-[var(--surface-secondary)]">
                <div>
                  <Label>Evening Shift Start</Label>
                  <input
                    type="time"
                    value={eveningShiftStart}
                    onChange={(e) => setEveningShiftStart(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 font-mono font-bold text-[var(--foreground)]"
                  />
                </div>
                <div>
                  <Label>Evening Shift End</Label>
                  <input
                    type="time"
                    value={eveningShiftEnd}
                    onChange={(e) => setEveningShiftEnd(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 font-mono font-bold text-[var(--foreground)]"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-[var(--border)] pb-3">
              <Store className="h-5 w-5 text-[var(--primary)]" />
              <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">Shop &amp; Terminal Details</h3>
            </div>
            <div className="space-y-3.5 text-xs">
              <div>
                <Label>Business / Store Name</Label>
                <Input value={shopName} onChange={(e) => setShopName(e.target.value)} className="mt-1 h-10 font-semibold bg-[var(--surface-secondary)] text-[var(--foreground)]" required />
              </div>
              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
                <div>
                  <Label>Operating Currency</Label>
                  <Input disabled value="PKR (Rs.)" className="mt-1 h-10 font-mono bg-[var(--surface-secondary)] text-[var(--foreground)]" />
                </div>
                <div>
                  <Label>Timezone</Label>
                  <Input disabled value="Asia/Karachi" className="mt-1 h-10 font-mono bg-[var(--surface-secondary)] text-[var(--foreground)]" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-[var(--border)] pb-3">
              <Printer className="h-5 w-5 text-[var(--primary)]" />
              <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">Receipt Printer Setup</h3>
            </div>
            <div className="space-y-3.5 text-xs">
              <div>
                <Label>Thermal Paper Width</Label>
                <select value={printerWidth} onChange={(e) => setPrinterWidth(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 font-semibold text-[var(--foreground)]">
                  <option value="80mm">80mm Standard POS Printer</option>
                  <option value="58mm">58mm Compact Receipt Printer</option>
                </select>
              </div>
              <div>
                <Label>Receipt Footer Message</Label>
                <Input defaultValue="Thank you for shopping at TechnoWorld! Visit again." className="mt-1 h-10 bg-[var(--surface-secondary)] text-[var(--foreground)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 flex justify-end pt-2">
          <Button type="submit" size="lg" className="w-full sm:w-auto px-8 font-extrabold shadow-sm bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white cursor-pointer">
            Save All Configurations
          </Button>
        </div>
      </form>

      <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[var(--border)] pb-3">
            <KeyRound className="h-5 w-5 text-[var(--primary)]" />
            <div>
              <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">Local Account Password</h3>
              <p className="text-[11px] font-medium text-[var(--muted)]">Update your local PostgreSQL login credentials</p>
            </div>
          </div>

          {pwMessage && (
            <div className={`rounded-xl px-3.5 py-2.5 text-xs font-bold border ${pwMessage.type === "ok" ? "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20" : "bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/20"}`}>
              {pwMessage.text}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <Label>Current Password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="mt-1 h-10 bg-[var(--surface-secondary)] text-[var(--foreground)]"
              />
            </div>
            <div>
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="mt-1 h-10 bg-[var(--surface-secondary)] text-[var(--foreground)]"
              />
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="mt-1 h-10 bg-[var(--surface-secondary)] text-[var(--foreground)]"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              disabled={pwLoading}
              onClick={handleChangePassword}
              className="w-full sm:w-auto px-6 font-bold bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white cursor-pointer"
            >
              {pwLoading ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
