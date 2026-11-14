"use client";

import { Bell, Cloud } from "lucide-react";

export function Topbar() {
  return (
    <header className="h-16 border-b border-[var(--border)] bg-[var(--surface)] px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)]">
          <span className="text-[var(--foreground-secondary)]">Shifts:</span>
          <span className="font-semibold">08:00–16:00</span>
          <span className="text-[var(--border)]">|</span>
          <span className="font-semibold">16:00–00:00 (PKT)</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--success)]/10 text-[var(--success)] text-xs font-bold">
          <Cloud className="h-3.5 w-3.5" />
          <span>Cloud Connected</span>
        </div>

        <button className="h-9 w-9 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] flex items-center justify-center text-[var(--foreground)] hover:bg-[var(--border)] transition">
          <Bell className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 pl-3 border-l border-[var(--border)]">
          <div className="h-9 w-9 rounded-xl bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center font-extrabold text-sm">
            SS
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-bold text-[var(--foreground)] leading-tight">Subhan Shahid</p>
            <p className="text-[10px] font-mono text-[var(--foreground-secondary)] uppercase">Owner</p>
          </div>
        </div>
      </div>
    </header>
  );
}