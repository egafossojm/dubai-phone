import {
  idbDelete,
  idbGet,
  idbGetAll,
  idbPut,
  idbReplaceSnapshot,
  OFFLINE_STORES,
} from "@/lib/offline/idb";
import { isSerialLocked } from "@/lib/offline/serial-locks";
import type {
  OfflineCatalogItem,
  OfflineCustomer,
  OfflineSerial,
  OutboxSaleRecord,
  SnapshotMeta,
} from "@/lib/offline/types";
import { SNAPSHOT_LIMITS } from "@/lib/offline/constants";

export type SnapshotPayload = {
  fetchedAt: string;
  catalog: OfflineCatalogItem[];
  customers: OfflineCustomer[];
  serials: OfflineSerial[];
  minDownPaymentBps: number;
  catalogTruncated?: boolean;
  customersTruncated?: boolean;
  serialsTruncated?: boolean;
};

export async function saveSnapshot(snapshot: SnapshotPayload): Promise<void> {
  const meta: SnapshotMeta & { key: string } = {
    key: "snapshot",
    fetchedAt: snapshot.fetchedAt,
    catalogCount: snapshot.catalog.length,
    customerCount: snapshot.customers.length,
    serialCount: snapshot.serials.length,
    catalogTruncated: snapshot.catalogTruncated ?? false,
    customersTruncated: snapshot.customersTruncated ?? false,
    serialsTruncated: snapshot.serialsTruncated ?? false,
    minDownPaymentBps: snapshot.minDownPaymentBps,
  };
  await idbReplaceSnapshot({
    catalog: snapshot.catalog,
    customers: snapshot.customers,
    serials: snapshot.serials,
    meta,
  });
}

export async function getSnapshotMeta(): Promise<SnapshotMeta | null> {
  const meta = await idbGet<SnapshotMeta & { key: string }>(
    OFFLINE_STORES.meta,
    "snapshot",
  );
  if (!meta) {
    return null;
  }
  const { key: _ignoredKey, ...rest } = meta;
  void _ignoredKey;
  return rest;
}

export async function getCachedCatalog(): Promise<OfflineCatalogItem[]> {
  return idbGetAll<OfflineCatalogItem>(OFFLINE_STORES.catalog);
}

export type LocalCatalogHit = {
  kind: string;
  variantId: string;
  productSerialId: string | null;
  sku: string;
  name: string;
  sellingPriceXaf: string;
  sellingPriceLabel: string;
  isSerialized: boolean;
  quantityAvailable: number;
  imei1: string | null;
  serialNumber: string | null;
};

export async function searchLocalCatalog(
  q: string,
  limit = 15,
  options?: { allowSerialIds?: string[] },
): Promise<LocalCatalogHit[]> {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) {
    return [];
  }

  const allow = new Set(options?.allowSerialIds ?? []);
  const [catalog, serials] = await Promise.all([
    idbGetAll<OfflineCatalogItem>(OFFLINE_STORES.catalog),
    idbGetAll<OfflineSerial>(OFFLINE_STORES.serials),
  ]);

  async function serialVisible(serial: OfflineSerial): Promise<boolean> {
    if (allow.has(serial.id)) {
      return true;
    }
    if (serial.status !== "IN_STOCK") {
      return false;
    }
    if (await isSerialLocked(serial.id)) {
      return false;
    }
    return true;
  }

  const serialHits: LocalCatalogHit[] = [];
  for (const row of serials) {
    const imei = (row.imei1 ?? "").toLowerCase();
    const sn = (row.serialNumber ?? "").toLowerCase();
    if (!imei.includes(needle) && !sn.includes(needle) && imei !== needle) {
      continue;
    }
    if (!(await serialVisible(row))) {
      continue;
    }
    const variant = catalog.find((item) => item.variantId === row.variantId);
    serialHits.push({
      kind: "serial",
      variantId: row.variantId,
      productSerialId: row.id,
      sku: variant?.sku ?? "",
      name: variant?.name ?? "Appareil",
      sellingPriceXaf: variant?.sellingPriceXaf ?? "0",
      sellingPriceLabel: variant?.sellingPriceLabel ?? "0 FCFA",
      isSerialized: true,
      quantityAvailable: 1,
      imei1: row.imei1,
      serialNumber: row.serialNumber,
    });
    if (serialHits.length >= limit) {
      break;
    }
  }

  const variantHits: LocalCatalogHit[] = [];
  for (const row of catalog) {
    if (
      !row.sku.toLowerCase().includes(needle) &&
      !row.name.toLowerCase().includes(needle)
    ) {
      continue;
    }
    if (row.isSerialized) {
      const units = serials.filter(
        (serial) => serial.variantId === row.variantId,
      );
      for (const serial of units) {
        if (!(await serialVisible(serial))) {
          continue;
        }
        variantHits.push({
          kind: "serial",
          variantId: row.variantId,
          productSerialId: serial.id,
          sku: row.sku,
          name: row.name,
          sellingPriceXaf: row.sellingPriceXaf,
          sellingPriceLabel: row.sellingPriceLabel,
          isSerialized: true,
          quantityAvailable: 1,
          imei1: serial.imei1,
          serialNumber: serial.serialNumber,
        });
        if (variantHits.length >= limit) {
          break;
        }
      }
    } else if (row.quantityAvailable > 0) {
      variantHits.push({
        kind: "variant",
        variantId: row.variantId,
        productSerialId: null,
        sku: row.sku,
        name: row.name,
        sellingPriceXaf: row.sellingPriceXaf,
        sellingPriceLabel: row.sellingPriceLabel,
        isSerialized: false,
        quantityAvailable: row.quantityAvailable,
        imei1: null,
        serialNumber: null,
      });
    }
    if (variantHits.length >= limit) {
      break;
    }
  }

  const seen = new Set(
    serialHits
      .map((row) => row.productSerialId)
      .filter((id): id is string => Boolean(id)),
  );
  return [
    ...serialHits,
    ...variantHits.filter(
      (row) => !row.productSerialId || !seen.has(row.productSerialId),
    ),
  ].slice(0, limit);
}

export async function searchLocalCustomers(q: string, limit = 15) {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) {
    return [] as OfflineCustomer[];
  }
  const customers = await idbGetAll<OfflineCustomer>(OFFLINE_STORES.customers);
  return customers
    .filter(
      (row) =>
        row.fullName.toLowerCase().includes(needle) ||
        row.phone.toLowerCase().includes(needle),
    )
    .slice(0, limit);
}

export async function listOutbox(): Promise<OutboxSaleRecord[]> {
  const rows = await idbGetAll<OutboxSaleRecord>(OFFLINE_STORES.outbox);
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function putOutbox(record: OutboxSaleRecord): Promise<void> {
  await idbPut(OFFLINE_STORES.outbox, record);
}

export async function getOutbox(
  clientTxnId: string,
): Promise<OutboxSaleRecord | undefined> {
  return idbGet<OutboxSaleRecord>(OFFLINE_STORES.outbox, clientTxnId);
}

export async function removeOutbox(clientTxnId: string): Promise<void> {
  await idbDelete(OFFLINE_STORES.outbox, clientTxnId);
}

export function describeSnapshotFreshness(meta: SnapshotMeta): string | null {
  const ageMs = Date.now() - Date.parse(meta.fetchedAt);
  const stale = ageMs > 24 * 60 * 60 * 1000;
  const truncated =
    meta.catalogTruncated || meta.customersTruncated || meta.serialsTruncated;
  const parts: string[] = [];
  if (stale) {
    parts.push("cache de plus de 24 h");
  }
  if (truncated) {
    parts.push("catalogue partiel (limites serveur)");
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export { SNAPSHOT_LIMITS };
