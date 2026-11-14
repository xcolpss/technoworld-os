import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";

export default function ModulePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Business Reports
            </h1>
            <Badge variant="neutral">Module Shell Ready</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">Daily snapshots, shift summaries, and exportable financial statements.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business Reports — Foundation Ready</CardTitle>
          <CardDescription>
            Navigation, layout, and role access route are verified. Business
            logic and database tables will be connected in upcoming milestones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Awaiting Database & Module Activation"
            description="No placeholder data is displayed here. Once the PostgreSQL schema and module rules are implemented, live records will appear automatically."
          />
        </CardContent>
      </Card>
    </div>
  );
}
