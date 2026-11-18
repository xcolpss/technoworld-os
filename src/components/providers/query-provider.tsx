"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Cached data renders instantaneously (0ms) for 60s; stale data shows immediately while background-updating.
        staleTime: 60 * 1000,
        // Keep previously visited sections in memory for 30 minutes across navigation.
        gcTime: 30 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: true,
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => createAppQueryClient());
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
