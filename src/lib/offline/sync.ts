"use client";

import * as React from "react";
import { localDb, type LocalCatalogItem, type LocalQueuedTransaction } from "./db";

export function useNetworkSyncStatus() {
  const [isOnline, setIsOnline] = React.useState<boolean>(true);
  const [pendingCount, setPendingCount] = React.useState<number>(0);

  const refreshPendingCount = React.useCallback(async () => {
    try {
      const count = await localDb.syncQueue
        .where("status")
        .anyOf(["PENDING", "FAILED"])
        .count();
      setPendingCount(count);
    } catch {
      setPendingCount(0);
    }
  }, []);

  React.useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    void refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      void refreshPendingCount();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const interval = window.setInterval(() => {
      void refreshPendingCount();
    }, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(interval);
    };
  }, [refreshPendingCount]);

  return { isOnline, pendingCount, refreshPendingCount };
}

export async function cacheCatalogItemsLocally(items: LocalCatalogItem[]) {
  if (!items.length) return;
  await localDb.catalog.bulkPut(items);
}

export async function enqueueOfflineTransaction(
  tx: Omit<LocalQueuedTransaction, "local_id" | "status" | "retry_count" | "created_at">
) {
  const existing = await localDb.syncQueue
    .where("idempotency_key")
    .equals(tx.idempotency_key)
    .first();

  if (existing) {
    return existing.local_id;
  }

  return await localDb.syncQueue.add({
    ...tx,
    status: "PENDING",
    retry_count: 0,
    created_at: new Date().toISOString(),
  });
}