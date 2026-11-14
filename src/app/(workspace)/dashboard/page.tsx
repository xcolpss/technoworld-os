import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Database,
  Monitor,
  ShieldAlert,
  ShoppingCart,
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Operations Overview
            </h1>
            <Badge variant="brand">Phase 1 Foundation</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            TechnoWorld Retail & Computer Services • Currency: PKR • Timezone:
            Asia/Karachi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/pos">
            <Button size="md">
              <ShoppingCart className="h-4 w-4" />
              Open POS Counter
            </Button>
          </Link>
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
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Shop Terminals
              </span>
              <Monitor className="h-5 w-5 text-brand" />
            </div>
            <p className="mt-3 text-2xl font-bold text-ink">3 Computers</p>
            <p className="mt-1 text-xs text-muted">
              Simultaneous multi-counter architecture
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Daily Shift Windows
              </span>
              <Clock className="h-5 w-5 text-brand" />
            </div>
            <p className="mt-3 text-2xl font-bold text-ink">2 Shifts</p>
            <p className="mt-1 text-xs text-muted">
              Morning 08:00–16:00 • Evening 16:00–00:00
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Access Structure
              </span>
              <Users className="h-5 w-5 text-brand" />
            </div>
            <p className="mt-3 text-2xl font-bold text-ink">3 Owners + Staff</p>
            <p className="mt-1 text-xs text-muted">
              OWNER, MANAGER & EMPLOYEE roles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Ledger Precision
              </span>
              <Database className="h-5 w-5 text-brand" />
            </div>
            <p className="mt-3 text-2xl font-bold text-ink">Integer Paisa</p>
            <p className="mt-1 text-xs text-muted">
              1 PKR = 100 paisa (zero rounding drift)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Split */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live Activity Empty State */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Live Shift & Sales Activity</CardTitle>
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

        {/* Configured Business Service Domains */}
        <Card>
          <CardHeader>
            <CardTitle>Configured Shop Departments</CardTitle>
            <CardDescription>
              Core TechnoWorld retail & service lines defined in system scope
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {serviceCatalogCategories.map((category) => (
                <li
                  key={category}
                  className="flex items-center gap-2.5 text-sm text-ink"
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
          <CardTitle>Foundation & Security Readiness</CardTitle>
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
                <TableCell className="font-medium">
                  Application Shell & UI System
                </TableCell>
                <TableCell>
                  Next.js App Router, strict TypeScript, orange-and-white design
                  system
                </TableCell>
                <TableCell>
                  <Badge variant="success">Ready</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  PostgreSQL Schema & Migrations
                </TableCell>
                <TableCell>
                  Multi-domain schema in integer paisa with audit trail
                </TableCell>
                <TableCell>
                  <Badge variant="warning">Scheduled Next</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  Authentication & Row Level Security
                </TableCell>
                <TableCell>
                  Server-enforced OWNER, MANAGER, and EMPLOYEE access isolation
                </TableCell>
                <TableCell>
                  <Badge variant="warning">Pending Schema</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  Offline Queue & Hardware Integration
                </TableCell>
                <TableCell>
                  Dexie.js local queue + 80mm thermal printer & cash drawer
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
