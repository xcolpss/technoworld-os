"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { clearUserSessionCaches } from "@/components/auth/sign-out-dialog";

interface SessionGuardProps {
  expectedUserId: string;
}

export function SessionGuard({ expectedUserId }: SessionGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [redirecting, setRedirecting] = React.useState(false);
  const inFlightCheckRef = React.useRef<Promise<void> | null>(null);
  const lastVerifiedAtRef = React.useRef<number>(0);

  const handleSessionLost = React.useCallback(
    (reason: "expired" | "signed_out") => {
      if (redirecting) return;
      setRedirecting(true);
      clearUserSessionCaches();
      const target =
        reason === "signed_out"
          ? "/login?reason=signed_out"
          : `/login?reason=expired&next=${encodeURIComponent(pathname || "/dashboard")}`;
      router.replace(target);
      router.refresh();
    },
    [pathname, redirecting, router]
  );

  const verifySessionOnce = React.useCallback(async () => {
    const now = Date.now();
    // Throttle redundant focus/visibility checks within 10s
    if (now - lastVerifiedAtRef.current < 10000) return;
    if (inFlightCheckRef.current) return inFlightCheckRef.current;

    const promise = (async () => {
      try {
        lastVerifiedAtRef.current = Date.now();
        const res = await fetch("/api/auth/session", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!res.ok) {
          handleSessionLost("expired");
          return;
        }
        const data = (await res.json()) as {
          authenticated?: boolean;
          user?: { userId?: string };
        };
        if (!data.authenticated || data.user?.userId !== expectedUserId) {
          handleSessionLost("expired");
        }
      } catch {
        // Ignore transient errors
      } finally {
        inFlightCheckRef.current = null;
      }
    })();

    inFlightCheckRef.current = promise;
    return promise;
  }, [expectedUserId, handleSessionLost]);

  React.useEffect(() => {
    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel("tw_auth_channel");
      channel.onmessage = (ev) => {
        if (ev?.data?.type === "SIGNED_OUT") {
          handleSessionLost("signed_out");
        }
      };
    }

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void verifySessionOnce();
      }
    };

    window.addEventListener("focus", onVisibilityOrFocus);
    document.addEventListener("visibilitychange", onVisibilityOrFocus);

    return () => {
      if (channel) channel.close();
      window.removeEventListener("focus", onVisibilityOrFocus);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
    };
  }, [handleSessionLost, verifySessionOnce]);

  if (!redirecting) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--background)]/85 backdrop-blur-md">
      <div className="glass-card rounded-2xl px-6 py-4 flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        <span className="text-sm font-semibold text-[var(--foreground)]">
          Updating session security...
        </span>
      </div>
    </div>
  );
}
