import {
  idbGet,
  idbGetAll,
  idbPut,
  OFFLINE_STORES,
} from "@/lib/offline/idb";
import type {
  OfflineCatalogItem,
  OfflineSalePayload,
  OfflineSerial,
  OutboxSaleRecord,
} from "@/lib/offline/types";

export async function getCachedSerials(): Promise<OfflineSerial[]> {
  return idbGetAll<OfflineSerial>(OFFLINE_STORES.serials);
}

export async function listPendingOutboxSerialIds(
  exceptClientTxnId?: string,
): Promise<Set<string>> {
  const rows = await idbGetAll<OutboxSaleRecord>(OFFLINE_STORES.outbox);
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.status === "SYNCED") {
      continue;
    }
    if (exceptClientTxnId && row.clientTxnId === exceptClientTxnId) {
      continue;
    }
    for (const item of row.payload.items) {
      if (item.productSerialId) {
        ids.add(item.productSerialId);
      }
    }
  }
  return ids;
}

/**
 * Reserve local stock / serials after a successful offline enqueue.
 */
export async function reserveOfflineSaleStock(
  payload: OfflineSalePayload,
): Promise<void> {
  for (const item of payload.items) {
    if (item.productSerialId) {
      const serial = await idbGet<OfflineSerial>(
        OFFLINE_STORES.serials,
        item.productSerialId,
      );
      if (serial) {
        await idbPut(OFFLINE_STORES.serials, {
          ...serial,
          status: "PENDING_SYNC",
        });
      }
      continue;
    }
    const catalog = await idbGet<OfflineCatalogItem>(
      OFFLINE_STORES.catalog,
      item.variantId,
    );
    if (!catalog || catalog.isSerialized) {
      continue;
    }
    await idbPut(OFFLINE_STORES.catalog, {
      ...catalog,
      quantityAvailable: Math.max(0, catalog.quantityAvailable - item.quantity),
    });
  }
}

/**
 * Restore local stock / serials after abandon (or failed enqueue rollback).
 */
export async function releaseOfflineSaleStock(
  payload: OfflineSalePayload,
): Promise<void> {
  for (const item of payload.items) {
    if (item.productSerialId) {
      const serial = await idbGet<OfflineSerial>(
        OFFLINE_STORES.serials,
        item.productSerialId,
      );
      if (serial && serial.status === "PENDING_SYNC") {
        await idbPut(OFFLINE_STORES.serials, {
          ...serial,
          status: "IN_STOCK",
        });
      }
      continue;
    }
    const catalog = await idbGet<OfflineCatalogItem>(
      OFFLINE_STORES.catalog,
      item.variantId,
    );
    if (!catalog || catalog.isSerialized) {
      continue;
    }
    await idbPut(OFFLINE_STORES.catalog, {
      ...catalog,
      quantityAvailable: catalog.quantityAvailable + item.quantity,
    });
  }
}
