"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LogOut, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clearBrowserAuthArtifacts,
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

interface SignOutDialogProps {
  open: boolean;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
}

export function clearUserSessionCaches(): void {
  if (typeof window === "undefined") return;
  try {
    clearBrowserAuthArtifacts();
    window.sessionStorage.clear();
    // Preserve terminal counter choice, clear any auth/session cached keys
    window.localStorage.removeItem("technoworld_remember_device");
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (
        key &&
        (key.startsWith("sb-") ||
          key.startsWith("supabase.") ||
          key.startsWith("tw_user_"))
      ) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage cleanup restrictions
  }
}

export async function performVerifiedSignOut(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    if (isSupabaseConfigured()) {
      const supabase = createSupabaseBrowserClient();
      const { error: clientError } = await supabase.auth.signOut({
        scope: "local",
      });
      if (clientError) {
        return {
          ok: false,
          error: clientError.message || "Failed to sign out from Supabase.",
        };
      }
    }

    const res = await fetch("/api/auth/signout", {
      method: "POST",
      credentials: "same-origin",
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      return {
        ok: false,
        error:
          payload.error ||
          "Server could not confirm session termination. Please retry.",
      };
    }

    clearUserSessionCaches();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Network error while signing out. Please try again.",
    };
  }
}

export function SignOutDialog({
  open,
  onClose,
  userName,
  userEmail,
}: SignOutDialogProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleClose = React.useCallback(() => {
    if (signingOut) return;
    setErrorMsg(null);
    setSigningOut(false);
    onClose();
  }, [onClose, signingOut]);

  React.useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, handleClose]);

  if (!open) return null;

  const handleConfirmSignOut = async () => {
    setErrorMsg(null);
    setSigningOut(true);

    const result = await performVerifiedSignOut();
    if (!result.ok) {
      setErrorMsg(result.error ?? "Unable to sign out right now.");
      setSigningOut(false);
      return;
    }

    setSigningOut(false);
    onClose();
    router.replace("/login?reason=signed_out");
    router.refresh();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 tw-backdrop-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signout-dialog-title"
    >
      <div
        className="fixed inset-0 bg-black/55 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="glass-modal relative z-10 w-full max-w-md rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-500 shrink-0">
              <LogOut className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="signout-dialog-title"
                className="font-display text-base font-extrabold text-[var(--foreground)]"
              >
                Sign out of TechnoWorld OS?
              </h2>
              <p className="text-xs text-[var(--foreground-secondary)]">
                Confirm ending your active session on this device
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={signingOut}
            onClick={handleClose}
            aria-label="Close sign out confirmation"
            className="h-8 w-8 rounded-lg border border-[var(--border)] bg-[var(--warm)] flex items-center justify-center text-[var(--foreground-secondary)] hover:text-[var(--foreground)] transition cursor-pointer disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--warm)]/75 p-3.5 text-xs space-y-2">
          <div className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
            <Shield className="h-3.5 w-3.5 text-[var(--primary)] shrink-0" />
            <span>
              {userName || "Authenticated User"}
              {userEmail ? ` (${userEmail})` : ""}
            </span>
          </div>
          <p className="text-[var(--foreground-secondary)] leading-relaxed">
            Signing out ends your authenticated session on this browser, clears session cookies and temporary cached data, and requires your password before accessing protected shop routes again. Any unsaved form changes on screen will not be submitted.
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-1">
          <Button
            type="button"
            variant="secondary"
            disabled={signingOut}
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={signingOut}
            onClick={handleConfirmSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
