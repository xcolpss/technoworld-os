import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { UserRole } from "@/types/system";

interface AccessRestrictedProps {
  currentRole: UserRole;
  requiredRoles: UserRole[];
  sectionName: string;
}

export function AccessRestricted({
  currentRole,
  requiredRoles,
  sectionName,
}: AccessRestrictedProps) {
  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <Card className="border-rose-500/30">
        <CardContent className="p-6 sm:p-8 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-lg font-extrabold text-[var(--foreground)]">
              Access Restricted: {sectionName}
            </h1>
            <p className="text-xs text-[var(--foreground-secondary)] leading-relaxed">
              Your current role (<span className="font-mono font-bold">{currentRole}</span>) does not have permission to view or modify this area. Required role:{" "}
              <span className="font-mono font-bold">
                {requiredRoles.join(" or ")}
              </span>
              .
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-90 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
