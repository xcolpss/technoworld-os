"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Monitor,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { StatusAlert } from "@/components/ui/states";
import {
  applyPersistenceToExistingAuthCookies,
  createSupabaseBrowserClient,
  getBrowserPersistenceMode,
  isSupabaseConfigured,
  setBrowserPersistenceMode,
} from "@/lib/supabase/client";
import type { PersistenceMode } from "@/lib/supabase/cookie-persistence";

const TERMINAL_STORAGE_KEY = "technoworld_terminal_code";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeNextPath(rawNext: string | null): string {
  if (!rawNext) return "/dashboard";
  if (!rawNext.startsWith("/") || rawNext.startsWith("//") || rawNext.startsWith("/login")) {
    return "/dashboard";
  }
  return rawNext;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabaseReady = isSupabaseConfigured();

  const [checkingSession, setCheckingSession] = React.useState(true);
  const [mode, setMode] = React.useState<"SIGN_IN" | "SIGN_UP">("SIGN_IN");
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [rememberDevice, setRememberDevice] = React.useState(true);
  const [terminalCode, setTerminalCode] = React.useState("PC-01");
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const nextPath = React.useMemo(
    () => sanitizeNextPath(searchParams.get("next")),
    [searchParams]
  );

  React.useEffect(() => {
    let active = true;

    async function checkExistingSession() {
      if (!active) return;
      const savedTerminal = window.localStorage.getItem(TERMINAL_STORAGE_KEY);
      if (savedTerminal) {
        setTerminalCode(savedTerminal);
      }
      setRememberDevice(getBrowserPersistenceMode() === "persistent");

      const reason = searchParams.get("reason");
      if (reason === "expired") {
        setErrorMsg("Your session expired or was signed out. Please sign in again.");
      } else if (reason === "signed_out") {
        setSuccessMsg("You have been signed out securely.");
      }

      if (!supabaseReady) {
        if (active) setCheckingSession(false);
        return;
      }
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && active) {
          router.replace(nextPath);
          router.refresh();
          return;
        }
      } catch {
        // Not signed in; proceed to login form
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    void checkExistingSession();

    return () => {
      active = false;
    };
  }, [nextPath, router, searchParams, supabaseReady]);

  const applyPersistenceStrategy = async (remember: boolean) => {
    const persistenceMode: PersistenceMode = remember ? "persistent" : "session";
    window.localStorage.setItem(TERMINAL_STORAGE_KEY, terminalCode);
    setBrowserPersistenceMode(persistenceMode);
    applyPersistenceToExistingAuthCookies(persistenceMode);

    try {
      await fetch("/api/auth/persistence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rememberDevice: remember }),
        credentials: "same-origin",
      });
    } catch {
      // Browser cookie fallback already applied above
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!supabaseReady) {
      setErrorMsg(
        "Supabase credentials are missing in .env.local. Configure them first."
      );
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    if (mode === "SIGN_UP" && fullName.trim().length < 2) {
      setErrorMsg("Please enter your full name (at least 2 characters).");
      return;
    }

    setLoading(true);
    try {
      // Set persistence cookie BEFORE sign-in so Supabase SSR cookie writes follow it immediately
      await applyPersistenceStrategy(rememberDevice);

      const supabase = createSupabaseBrowserClient();

      if (mode === "SIGN_IN") {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("email not confirmed")) {
            setErrorMsg(
              "Your email is not confirmed yet. Open Supabase -> Authentication -> Users and confirm your user (or click the link sent to your email)."
            );
          } else if (msg.includes("invalid login credentials")) {
            setErrorMsg("Invalid email or password. Please check your credentials and try again.");
          } else {
            setErrorMsg(error.message);
          }
          return;
        }

        // Re-apply cookie lifetimes synchronously after sign-in completes
        await applyPersistenceStrategy(rememberDevice);
        router.replace(nextPath);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim() || trimmedEmail.split("@")[0],
            },
          },
        });
        if (error) {
          setErrorMsg(error.message);
          return;
        }
        if (data.session) {
          await applyPersistenceStrategy(rememberDevice);
          router.replace("/setup");
          router.refresh();
        } else {
          setSuccessMsg(
            "Account created! Confirm your email in your inbox (or in Supabase -> Authentication -> Users), then sign in."
          );
          setMode("SIGN_IN");
        }
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Authentication request failed."
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="tw-ambient-canvas flex min-h-screen flex-col items-center justify-center px-4">
        <div className="tw-glass-surface rounded-2xl border border-[var(--border)] px-6 py-5 flex items-center gap-3 shadow-lg">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
          <span className="text-sm font-medium text-[var(--foreground)]">
            Verifying TechnoWorld OS session...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="tw-ambient-canvas flex min-h-screen flex-col items-center justify-center px-3.5 sm:px-4 py-8 sm:py-12 tw-page-in">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF8533] to-[#E05800] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_28px_-4px_rgba(255,106,0,0.45)] transition-transform duration-300 hover:scale-105">
            <Cpu className="h-7 w-7" />
          </div>
          <h1 className="font-display mt-4 text-2xl sm:text-3xl font-extrabold tracking-[-0.025em] text-[var(--foreground)]">
            TechnoWorld OS
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--foreground-secondary)]">
            Owner &amp; Staff Portal • Rawalpindi, Pakistan
          </p>
        </div>

        <Card className="border-[var(--border)]">
          <CardHeader>
            <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <CardTitle>
                {mode === "SIGN_IN"
                  ? "Sign in to your account"
                  : "Create Owner Account"}
              </CardTitle>
              <button
                type="button"
                onClick={() => {
                  setMode((m) => (m === "SIGN_IN" ? "SIGN_UP" : "SIGN_IN"));
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-xs font-semibold text-[var(--primary)] hover:underline cursor-pointer"
              >
                {mode === "SIGN_IN"
                  ? "First time? Create owner account"
                  : "Back to Sign In"}
              </button>
            </div>
            <CardDescription>
              {mode === "SIGN_IN"
                ? "Enter your registered email and password to access the workspace."
                : "Register the initial shop owner account to initialize TechnoWorld."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorMsg && (
              <div className="mb-5">
                <StatusAlert
                  type="error"
                  title="Authentication Notice"
                  message={errorMsg}
                />
              </div>
            )}

            {successMsg && (
              <div className="mb-5">
                <StatusAlert
                  type="success"
                  title="Session Notice"
                  message={successMsg}
                />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {mode === "SIGN_UP" && (
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    required
                    placeholder="Subhan Shahid"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="owner@technoworld.pk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      mode === "SIGN_IN" ? "current-password" : "new-password"
                    }
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    className="pr-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4.5 w-4.5" />
                    ) : (
                      <Eye className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Shop Terminal Assignment */}
              <div>
                <Label htmlFor="terminalCode">
                  <span className="inline-flex items-center gap-1.5">
                    <Monitor className="h-3.5 w-3.5 text-[var(--primary)]" />
                    This Device / Counter
                  </span>
                </Label>
                <select
                  id="terminalCode"
                  value={terminalCode}
                  onChange={(e) => setTerminalCode(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm font-medium text-[var(--foreground)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                >
                  <option value="PC-01">
                    PC-01 • Main Counter (80mm Printer &amp; Cash Drawer)
                  </option>
                  <option value="PC-02">
                    PC-02 • Service Desk (Printing &amp; Forms)
                  </option>
                  <option value="PC-03">
                    PC-03 • Media &amp; Repair Station
                  </option>
                  <option value="REMOTE">Owner Phone / Remote Access</option>
                </select>
              </div>

              {/* Remember This Device */}
              <label className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/70 px-3.5 py-2.5 text-xs text-[var(--foreground)] cursor-pointer select-none transition-colors hover:border-[var(--primary)]/40">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[var(--border)] accent-[#FF6A00] cursor-pointer"
                />
                <span className="space-y-0.5">
                  <span className="block font-semibold">Remember This Device</span>
                  <span className="block text-[11px] text-[var(--muted-foreground)]">
                    {rememberDevice
                      ? "Keep me signed in across browser restarts on this trusted device."
                      : "Session-only login: closes automatically when you close your browser."}
                  </span>
                </span>
              </label>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={loading}
              >
                {mode === "SIGN_IN" ? (
                  <>
                    <Lock className="h-4 w-4" />
                    Sign In
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Create Owner Account
                  </>
                )}
              </Button>
            </form>

            <div className="mt-4 flex items-center justify-between border-t border-[var(--border)]/70 pt-3 text-[11px] text-[var(--muted-foreground)]">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Encrypted Supabase Auth
              </span>
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--primary)]" />
                Role-Verified Access
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="tw-ambient-canvas flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <LoginContent />
    </React.Suspense>
  );
}
