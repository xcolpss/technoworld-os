"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Cpu, Eye, EyeOff, Lock, Monitor, UserPlus } from "lucide-react";
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
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

const TERMINAL_STORAGE_KEY = "technoworld_terminal_code";
const REMEMBER_STORAGE_KEY = "technoworld_remember_device";

export default function LoginPage() {
  const router = useRouter();
  const supabaseReady = isSupabaseConfigured();

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

  React.useEffect(() => {
    const savedTerminal = window.localStorage.getItem(TERMINAL_STORAGE_KEY);
    if (savedTerminal) {
      setTerminalCode(savedTerminal);
    }
    const savedRemember = window.localStorage.getItem(REMEMBER_STORAGE_KEY);
    if (savedRemember === "false") {
      setRememberDevice(false);
    }
  }, []);

  const persistDevicePreferences = () => {
    window.localStorage.setItem(TERMINAL_STORAGE_KEY, terminalCode);
    window.localStorage.setItem(
      REMEMBER_STORAGE_KEY,
      rememberDevice ? "true" : "false"
    );
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

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      persistDevicePreferences();

      if (mode === "SIGN_IN") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          if (error.message.toLowerCase().includes("email not confirmed")) {
            setErrorMsg(
              "Your email is not confirmed yet. Open Supabase -> Authentication -> Users and confirm your user (or click the link sent to your email)."
            );
          } else {
            setErrorMsg(error.message);
          }
          return;
        }
        router.push("/dashboard");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim() || email.split("@")[0],
            },
          },
        });
        if (error) {
          setErrorMsg(error.message);
          return;
        }
        if (data.session) {
          router.push("/setup");
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF7B1C] to-[#E65300] text-white shadow-md">
            <Cpu className="h-7 w-7" />
          </div>
          <h1 className="font-display mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            TechnoWorld OS
          </h1>
          <p className="mt-1 text-sm text-muted">
            Owner &amp; Staff Portal • Rawalpindi, Pakistan
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
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
                className="text-xs font-semibold text-brand-dark hover:underline cursor-pointer"
              >
                {mode === "SIGN_IN"
                  ? "First time? Create owner account"
                  : "Back to Sign In"}
              </button>
            </div>
            <CardDescription>
              {mode === "SIGN_IN"
                ? "Enter your individual email and password."
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
                  title="Account Ready"
                  message={successMsg}
                />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted hover:text-ink cursor-pointer"
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
                    <Monitor className="h-3.5 w-3.5 text-brand" />
                    This Device / Counter
                  </span>
                </Label>
                <select
                  id="terminalCode"
                  value={terminalCode}
                  onChange={(e) => setTerminalCode(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm font-medium text-ink transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <option value="PC-01">PC-01 • Main Counter (80mm Printer &amp; Cash Drawer)</option>
                  <option value="PC-02">PC-02 • Service Desk (Printing &amp; Forms)</option>
                  <option value="PC-03">PC-03 • Media &amp; Repair Station</option>
                  <option value="REMOTE">Owner Phone / Remote Access</option>
                </select>
              </div>

              {/* Remember This Device */}
              <label className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-warm/70 px-3.5 py-2.5 text-xs font-medium text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-[#FF6A00] cursor-pointer"
                />
                <span>
                  Remember this device &amp; keep terminal selection saved
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
