"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Lock, Store } from "lucide-react";
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
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabaseReady = isSupabaseConfigured();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseReady) {
      setFeedback(
        "Supabase credentials are not added to .env.local yet. Complete Supabase setup to enable live staff and owner sign-in."
      );
      return;
    }
    setFeedback(
      "Authentication foundation is ready. Live Supabase session sign-in activates once the Phase 2/3 user tables and policies are applied."
    );
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-warm px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-md">
            <Store className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">
            TechnoWorld OS
          </h1>
          <p className="mt-1 text-sm text-muted">
            Staff & Owner Access • Rawalpindi, Pakistan
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in to your account</CardTitle>
            <CardDescription>
              Use your individual owner or employee credentials.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!supabaseReady && (
              <div className="mb-5">
                <StatusAlert
                  type="error"
                  title="Database Connection Pending"
                  message="Supabase URL and Anon Key are not configured in .env.local yet."
                />
              </div>
            )}

            {feedback && (
              <div className="mb-5">
                <StatusAlert
                  type="error"
                  title="Sign-In Not Active Yet"
                  message={feedback}
                />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="name@technoworld.pk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" size="lg">
                <Lock className="h-4 w-4" />
                Sign In
              </Button>
            </form>

            <div className="mt-5 border-t border-border pt-4 text-center">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-dark hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Return to System Foundation Dashboard
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
