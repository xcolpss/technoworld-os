"use client";

import * as React from "react";
import type { UserRole } from "@/types/system";

export interface WorkspaceClientContextValue {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  businessId: string;
  businessName: string;
}

const WorkspaceContext = React.createContext<WorkspaceClientContextValue | null>(
  null
);

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceClientContextValue;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceUser(): WorkspaceClientContextValue {
  const ctx = React.useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspaceUser must be used inside WorkspaceProvider.");
  }
  return ctx;
}
