import { redirect } from "next/navigation";
import { Building2, CheckCircle2, Cpu, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { initializeBusinessAction, signOutAction } from "@/app/setup/actions";

export default async function SetupPage() {
  const ctx = await getAuthenticatedShopContext();

  if (!ctx) {
    redirect("/login");
  }

  if (ctx.businessId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF7B1C] to-[#E65300] text-white shadow-md">
            <Cpu className="h-7 w-7" />
          </div>
          <h1 className="font-display mt-4 text-2xl sm:text-3xl font-extrabold text-ink">
            Initialize TechnoWorld OS
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Signed in as <span className="font-semibold text-ink">{ctx.email}</span> • One-time shop workspace setup
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Shop &amp; Primary Owner Details</CardTitle>
            <CardDescription>
              This configures your shop in PKR (Asia/Karachi), registers you as
              Primary Owner, and sets up PC-01, PC-02, and PC-03.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={initializeBusinessAction} className="space-y-4">
              <div>
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  name="businessName"
                  defaultValue="TechnoWorld"
                  required
                />
              </div>

              <div>
                <Label htmlFor="ownerFullName">Your Full Name (Primary Owner)</Label>
                <Input
                  id="ownerFullName"
                  name="ownerFullName"
                  defaultValue={ctx.fullName}
                  placeholder="Subhan Shahid"
                  required
                />
              </div>

              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  defaultValue="Rawalpindi"
                  required
                />
              </div>

              <div className="rounded-xl border border-brand/20 bg-warm p-4 space-y-2 text-xs text-ink">
                <p className="font-bold text-brand-dark flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  Automatically Configured on Setup:
                </p>
                <ul className="space-y-1 text-muted">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                    Roles: OWNER, MANAGER &amp; EMPLOYEE with database Row Level Security
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                    3 Shop Terminals: PC-01 (Main Counter + 80mm Printer), PC-02, PC-03
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                    Shift Schedule: Morning (08:00–16:00) &amp; Evening (16:00–00:00) PKT
                  </li>
                </ul>
              </div>

              <Button type="submit" size="lg" className="w-full">
                <Building2 className="h-4.5 w-4.5" />
                Complete Shop Setup &amp; Enter Dashboard
              </Button>
            </form>

            <form action={signOutAction} className="mt-4 text-center">
              <button
                type="submit"
                className="text-xs font-medium text-muted hover:text-ink underline cursor-pointer"
              >
                Sign out and switch account
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
