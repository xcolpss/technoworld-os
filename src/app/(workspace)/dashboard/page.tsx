import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Database,
  Monitor,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState, StatusAlert } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function DashboardPage() {
  const supabaseReady = isSupabaseConfigured();

  const serviceCatalogCategories = [
    "Movies & TV Digital Media",
    "Printing & Photocopying",
    "Form Filling & Applications",
    "Photo & Video Editing",
    "Computer Repair & Software Services",
    "USB Drives, Cables, Chargers & Accessories",
    "Games & Gaming Services",
    "Interview Preparation & Document Services",
    "Custom Counter Services",
  ];

  return (
    <div className="space-y-7">
      {/* Hero Banner Card */}
      <div className="relative overflow-hidden rounded-3xl border border-brand/20 bg-gradient-to-br from-surface via-surface to-brand-soft/80 p-6 sm:p-8 shadow-[0_6px_24px_-4px_rgba(255,106,0,0.08)]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge variant="brand">
                <Sparkles className="h-3 w-3" />
                Phase 1 Foundation
              </Badge>
              <span className="font-mono text-xs font-medium text-muted">
                PKR • Asia/Karachi
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
              Operations Overview
            </h1>
            <p className="max-w-2xl text-sm text-muted leading-relaxed">
              Central command for TechnoWorld retail, digital media, printing,
              and computer services across all three shop counters.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link href="/pos">
              <Button size="lg">
                <ShoppingCart className="h-4.5 w-4.5" />
                Open POS Counter
                <ArrowUpRight className="h-4 w-4 opacity-80" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Honest System Connection Banner */}
      {!supabaseReady ? (
        <StatusAlert
          type="error"
          title="Database Not Connected Yet"
          message="No live sales, shift totals, or inventory figures are shown because Supabase environment keys (.env.local) and Phase 2 database migrations have not been applied yet."
        />
      ) : (
        <StatusAlert
          type="success"
          title="Supabase Environment Detected"
          message="Connection credentials are present. Complete Phase 2 database migrations to begin recording live shop transactions."
        />
      )}

      {/* Structural Configuration Summary (No Fake Business Metrics) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Shop Terminals
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Monitor className="h-4.5 w-4.5" />
              </div>
            </div>
            <p className="font-display mt-3 text-2xl font-extrabold text-ink">
              3 Computers
            </p>
            <p className="mt-1 text-xs text-muted">
              Simultaneous multi-counter sync
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Daily Shifts
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Clock className="h-4.5 w-4.5" />
              </div>
            </div>
            <p className="font-display mt-3 text-2xl font-extrabold text-ink">
              2 Windows
            </p>
            <p className="mt-1 font-mono text-xs text-muted">
              08:00–16:00 • 16:00–00:00
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Access Roles
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Users className="h-4.5 w-4.5" />
              </div>
            </div>
            <p className="font-display mt-3 text-2xl font-extrabold text-ink">
              3 Owners + Staff
            </p>
            <p className="mt-1 text-xs text-muted">
              OWNER, MANAGER &amp; EMPLOYEE
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Ledger Precision
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Database className="h-4.5 w-4.5" />
              </div>
            </div>
            <p className="font-display mt-3 text-2xl font-extrabold text-ink">
              Integer Paisa
            </p>
            <p className="mt-1 font-mono text-xs text-muted">
              1 PKR = 100 paisa exact
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Split */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Live Shift &amp; Sales Activity</CardTitle>
            <CardDescription>
              Real-time counter transactions and cash drawer sessions will
              populate here once connected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="No Posted Transactions Yet"
              description="TechnoWorld OS never displays placeholder revenue or sample profit figures. Once the database schema and POS module are enabled, every sale and shift handover will appear here."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shop Service Lines</CardTitle>
            <CardDescription>
              Core TechnoWorld departments defined in system scope
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {serviceCatalogCategories.map((category) => (
                <li
                  key={category}
                  className="flex items-center gap-2.5 rounded-xl bg-warm/70 px-3 py-2 text-xs sm:text-sm font-medium text-ink border border-border/50"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
                  <span>{category}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Implementation Milestones Table */}
      <Card>
        <CardHeader>
          <CardTitle>Foundation &amp; Security Readiness</CardTitle>
          <CardDescription>
            Current verification status across TechnoWorld OS architectural
            layers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Layer</TableHead>
                <TableHead>Specification</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-semibold">
                  Application Shell &amp; UI System
                </TableCell>
                <TableCell>
                  Next.js App Router, Plus Jakarta Sans &amp; Inter typography,
                  orange-and-white theme
                </TableCell>
                <TableCell>
                  <Badge variant="success">Ready</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold">
                  PostgreSQL Schema &amp; Migrations
                </TableCell>
                <TableCell>
                  Multi-domain schema in integer paisa with audit trail
                </TableCell>
                <TableCell>
                  <Badge variant="warning">Scheduled Next</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold">
                  Authentication &amp; Row Level Security
                </TableCell>
                <TableCell>
                  Server-enforced OWNER, MANAGER, and EMPLOYEE access isolation
                </TableCell>
                <TableCell>
                  <Badge variant="warning">Pending Schema</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold">
                  Offline Queue &amp; Hardware Integration
                </TableCell>
                <TableCell>
                  Dexie.js local queue + 80mm thermal printer &amp; cash drawer
                </TableCell>
                <TableCell>
                  <Badge variant="neutral">Future Milestone</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center gap-2 text-xs text-muted">
            <ShieldAlert className="h-4 w-4 text-brand shrink-0" />
            <span>
              Financial integrity rule: Posted transactions can never be
              silently deleted; adjustments require auditable reversals.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
