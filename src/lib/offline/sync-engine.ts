"use client";

import { classifySyncFailure } from "@/lib/offline/sync-classify";
import {
  getCachedCatalog,
  getOutbox,
  getSnapshotMeta,
  listOutbox,
  putOutbox,
  removeOutbox,
  saveSnapshot,
  type SnapshotPayload,
} from "@/lib/offline/repository";
import { releaseSerial } from "@/lib/offline/serial-locks";
import {
  getCachedSerials,
  listPendingOutboxSerialIds,
  releaseOfflineSaleStock,
  reserveOfflineSaleStock,
} from "@/lib/offline/stock-reservation";
import type {
  OfflineSalePayload,
  OutboxSaleRecord,
} from "@/lib/offline/types";
import { validateOfflineSalePayload } from "@/lib/offline/validate-sale";

let flushInFlight: Promise<{
  synced: number;
  failed: number;
  conflicted: number;
  processed: number;
}> | null = null;

export async function pullOfflineSnapshot(): Promise<SnapshotPayload | null> {
  const response = await fetch("/api/sync/snapshot");
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: SnapshotPayload;
    error?: { message?: string };
  } | null;
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error?.message ?? "Impossible de synchroniser le cache.");
  }
  await saveSnapshot(payload.data);
  return payload.data;
}

export async function enqueueOfflineSale(
  payload: OfflineSalePayload,
): Promise<OutboxSaleRecord> {
  const existing = await getOutbox(payload.clientTxnId);
  if (existing) {
    return existing;
  }

  const [catalog, serials, meta, reservedSerialIds] = await Promise.all([
    getCachedCatalog(),
    getCachedSerials(),
    getSnapshotMeta(),
    listPendingOutboxSerialIds(),
  ]);
  const validationError = validateOfflineSalePayload(payload, {
    catalog,
    serials,
    minDownPaymentBps: meta?.minDownPaymentBps ?? 1000,
    reservedSerialIds,
  });
  if (validationError) {
    throw new Error(validationError);
  }

  const now = new Date().toISOString();
  const record: OutboxSaleRecord = {
    clientTxnId: payload.clientTxnId,
    status: "PENDING_SYNC",
    payload,
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    lastError: null,
    lastErrorDetails: null,
  };
  await putOutbox(record);
  try {
    await reserveOfflineSaleStock(payload);
  } catch (error) {
    await removeOutbox(payload.clientTxnId);
    throw error;
  }
  return record;
}

async function syncOne(record: OutboxSaleRecord): Promise<OutboxSaleRecord> {
  const syncing: OutboxSaleRecord = {
    ...record,
    status: "SYNCING",
    attempts: record.attempts + 1,
    updatedAt: new Date().toISOString(),
  };
  await putOutbox(syncing);

  try {
    const response = await fetch("/api/sync/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record.payload),
    });
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: {
        code?: string;
        message?: string;
        details?: unknown;
      };
      data?: {
        replayed?: boolean;
        sale?: { id: string; reference: string };
        syncStatus?: string;
      };
    } | null;

    if (response.ok && payload?.success && payload.data?.sale) {
      for (const item of record.payload.items) {
        if (item.productSerialId) {
          await releaseSerial(item.productSerialId);
        }
      }
      const synced: OutboxSaleRecord = {
        ...syncing,
        status: "SYNCED",
        saleId: payload.data.sale.id,
        saleReference: payload.data.sale.reference,
        lastError: null,
        lastErrorDetails: null,
        updatedAt: new Date().toISOString(),
      };
      await putOutbox(synced);
      return synced;
    }

    const message = payload?.error?.message ?? "Échec de synchronisation.";
    const code = payload?.error?.code ?? "";
    const details = payload?.error?.details;
    const status = classifySyncFailure({
      httpStatus: response.status,
      code,
      message,
      details,
    });

    const failed: OutboxSaleRecord = {
      ...syncing,
      status,
      lastError: message,
      lastErrorDetails: details ?? null,
      updatedAt: new Date().toISOString(),
    };
    await putOutbox(failed);
    return failed;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Réseau indisponible lors de la synchronisation.";
    const failed: OutboxSaleRecord = {
      ...syncing,
      status: "FAILED",
      lastError: message,
      lastErrorDetails: null,
      updatedAt: new Date().toISOString(),
    };
    await putOutbox(failed);
    return failed;
  }
}

export async function flushOutbox(): Promise<{
  synced: number;
  failed: number;
  conflicted: number;
  processed: number;
}> {
  if (flushInFlight) {
    return flushInFlight;
  }
  flushInFlight = (async () => {
    const rows = await listOutbox();
    const pending = rows.filter(
      (row) =>
        row.status === "PENDING_SYNC" ||
        row.status === "FAILED" ||
        row.status === "SYNCING",
    );
    let synced = 0;
    let failed = 0;
    let conflicted = 0;
    for (const row of pending) {
      const reset: OutboxSaleRecord =
        row.status === "FAILED" || row.status === "SYNCING"
          ? {
              ...row,
              status: "PENDING_SYNC",
              lastError: null,
              lastErrorDetails: null,
              updatedAt: new Date().toISOString(),
            }
          : row;
      if (reset !== row) {
        await putOutbox(reset);
      }
      try {
        const result = await syncOne(reset);
        if (result.status === "SYNCED") {
          synced += 1;
        } else if (result.status === "CONFLICT") {
          conflicted += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }
    return {
      synced,
      failed,
      conflicted,
      processed: pending.length,
    };
  })();

  try {
    return await flushInFlight;
  } finally {
    flushInFlight = null;
  }
}

export async function retryOutboxItem(clientTxnId: string) {
  const row = await getOutbox(clientTxnId);
  if (!row) {
    throw new Error("Transaction introuvable dans la file locale.");
  }
  if (row.status === "SYNCED") {
    return row;
  }
  if (row.status === "CONFLICT") {
    throw new Error(
      "Conflit irrécupérable — abandonnez la vente ou contactez un manager.",
    );
  }
  const reset: OutboxSaleRecord = {
    ...row,
    status: "PENDING_SYNC",
    lastError: null,
    lastErrorDetails: null,
    updatedAt: new Date().toISOString(),
  };
  await putOutbox(reset);
  return syncOne(reset);
}

/**
 * Fix payment amount on a failed outbox row (merges into a single payment).
 */
export async function repairOutboxPayment(
  clientTxnId: string,
  amountXaf: string,
): Promise<OutboxSaleRecord> {
  const row = await getOutbox(clientTxnId);
  if (!row) {
    throw new Error("Transaction introuvable dans la file locale.");
  }
  if (row.status === "SYNCED") {
    return row;
  }
  if (row.status === "CONFLICT") {
    throw new Error("Conflit irrécupérable — abandon requis.");
  }
  const digits = amountXaf.replace(/\D/g, "");
  if (!digits || digits === "0") {
    throw new Error("Le montant du paiement doit être supérieur à 0.");
  }
  const firstPayment = row.payload.payments[0];
  const nextPayload: OfflineSalePayload = {
    ...row.payload,
    payments: [
      {
        method: firstPayment?.method ?? "CASH",
        amountXaf: digits,
        idempotencyKey: firstPayment?.idempotencyKey ?? `pay-fix-${clientTxnId}`,
        operatorReference: firstPayment?.operatorReference,
      },
    ],
  };
  const reset: OutboxSaleRecord = {
    ...row,
    payload: nextPayload,
    status: "PENDING_SYNC",
    lastError: null,
    lastErrorDetails: null,
    updatedAt: new Date().toISOString(),
  };
  await putOutbox(reset);
  return syncOne(reset);
}

export async function abandonOutboxItem(clientTxnId: string): Promise<void> {
  const row = await getOutbox(clientTxnId);
  if (!row) {
    return;
  }
  if (row.status === "SYNCED") {
    throw new Error("Impossible d'abandonner une vente déjà synchronisée.");
  }
  await releaseOfflineSaleStock(row.payload);
  for (const item of row.payload.items) {
    if (item.productSerialId) {
      await releaseSerial(item.productSerialId);
    }
  }
  await removeOutbox(clientTxnId);
}
