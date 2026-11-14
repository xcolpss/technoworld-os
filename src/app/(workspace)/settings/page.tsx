"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, Shield, Moon, Sun, Monitor, CheckCircle2, Store } from "lucide-react";

export default function SettingsPage() {
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("light");
  const [shopName, setShopName] = useState("TechnoWorld OS • Rawalpindi");
  const [printerWidth, setPrinterWidth] = useState("80mm");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedTheme = (localStorage.getItem("tw_theme_mode") as "light" | "dark" | "system") || "light";
    setThemeMode(savedTheme);
    applyTheme(savedTheme);
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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <PageHeader
        eyebrow="TechnoWorld OS • System Configuration &amp; Preferences"
        title="System Settings"
        description="Configure shop terminals, thermal receipt printers, currency preferences, and centralized theme appearance."
      />

      {saved && (
        <Card className="border-[var(--success)]/30 bg-[var(--success)]/10 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3 text-[var(--success)]">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span className="text-xs font-bold">Settings and theme preferences saved successfully! Applied instantly.</span>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-6 space-y-4">
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
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border font-bold transition ${themeMode === "light" ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] shadow-xs" : "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"}`}
                >
                  <Sun className="h-4 w-4" /> Light
                </button>
                <button
                  type="button"
                  onClick={() => applyTheme("dark")}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border font-bold transition ${themeMode === "dark" ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] shadow-xs" : "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"}`}
                >
                  <Moon className="h-4 w-4" /> Dark
                </button>
                <button
                  type="button"
                  onClick={() => applyTheme("system")}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border font-bold transition ${themeMode === "system" ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] shadow-xs" : "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"}`}
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
              <Store className="h-5 w-5 text-[var(--primary)]" />
              <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">Shop &amp; Terminal Details</h3>
            </div>
            <div className="space-y-3.5 text-xs">
              <div>
                <Label>Business / Store Name</Label>
                <Input value={shopName} onChange={(e) => setShopName(e.target.value)} className="mt-1 h-10 font-semibold bg-[var(--surface-secondary)] text-[var(--foreground)]" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
          <CardContent className="p-6 space-y-4">
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

        <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-[var(--border)] pb-3">
              <Shield className="h-5 w-5 text-[var(--primary)]" />
              <h3 className="font-display text-base font-extrabold text-[var(--foreground)]">Security &amp; Permissions</h3>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--surface-secondary)]">
                <div>
                  <p className="font-bold text-[var(--foreground)]">Owner Financial Lockdown</p>
                  <p className="text-[10px] text-[var(--foreground-secondary)]">Restrict P&amp;L and owner accounts to authorized admins.</p>
                </div>
                <Badge variant="success" className="px-3 py-1">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--surface-secondary)]">
                <div>
                  <p className="font-bold text-[var(--foreground)]">Cloud Supabase Sync</p>
                  <p className="text-[10px] text-[var(--foreground-secondary)]">Real-time database replication active.</p>
                </div>
                <Badge variant="success" className="px-3 py-1">Connected</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 flex justify-end pt-2">
          <Button type="submit" size="lg" className="px-8 font-extrabold shadow-sm bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white">Save Configuration</Button>
        </div>
      </form>
    </div>
  );
}