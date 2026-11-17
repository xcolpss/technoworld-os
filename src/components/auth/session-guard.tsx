"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { clearUserSessionCaches } from "@/components/auth/sign-out-dialog";

interface SessionGuardProps {
  expectedUserId: string;
}

export function SessionGuard({ expectedUserId }: SessionGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [redirecting, setRedirecting] = React.useState(false);
  const inFlightCheckRef = React.useRef<Promise<void> | null>(null);

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
    if (!isSupabaseConfigured()) return;
    if (inFlightCheckRef.current) {
      return inFlightCheckRef.current;
    }

    const promise = (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user || user.id !== expectedUserId) {
          handleSessionLost("expired");
        }
      } catch {
        // Ignore transient offline errors; server middleware guards protected fetches
      } finally {
        inFlightCheckRef.current = null;
      }
    })();

    inFlightCheckRef.current = promise;
    return promise;
  }, [expectedUserId, handleSessionLost]);

  React.useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createSupabaseBrowserClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        handleSessionLost("signed_out");
      } else if (
        (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") &&
        session?.user &&
        session.user.id !== expectedUserId
      ) {
        router.refresh();
      }
    });

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void verifySessionOnce();
      }
    };

    window.addEventListener("focus", onVisibilityOrFocus);
    document.addEventListener("visibilitychange", onVisibilityOrFocus);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("focus", onVisibilityOrFocus);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
    };
  }, [expectedUserId, handleSessionLost, router, verifySessionOnce]);

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
