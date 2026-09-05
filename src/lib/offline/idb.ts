/**
 * Minimal IndexedDB helpers (no third-party dependency).
 */

const DB_NAME = "dubai-phone-offline";
const DB_VERSION = 2;

export const OFFLINE_STORES = {
  meta: "meta",
  catalog: "catalog",
  customers: "customers",
  serials: "serials",
  outbox: "outbox",
  serialLocks: "serialLocks",
} as const;

export type OfflineStoreName = (typeof OFFLINE_STORES)[keyof typeof OFFLINE_STORES];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORES.meta)) {
        db.createObjectStore(OFFLINE_STORES.meta, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(OFFLINE_STORES.catalog)) {
        const store = db.createObjectStore(OFFLINE_STORES.catalog, {
          keyPath: "variantId",
        });
        store.createIndex("sku", "sku", { unique: false });
        store.createIndex("name", "name", { unique: false });
      }
      if (!db.objectStoreNames.contains(OFFLINE_STORES.customers)) {
        const store = db.createObjectStore(OFFLINE_STORES.customers, {
          keyPath: "id",
        });
        store.createIndex("phone", "phone", { unique: false });
        store.createIndex("fullName", "fullName", { unique: false });
      }
      if (!db.objectStoreNames.contains(OFFLINE_STORES.serials)) {
        const store = db.createObjectStore(OFFLINE_STORES.serials, {
          keyPath: "id",
        });
        store.createIndex("variantId", "variantId", { unique: false });
        store.createIndex("imei1", "imei1", { unique: false });
      }
      if (!db.objectStoreNames.contains(OFFLINE_STORES.outbox)) {
        const store = db.createObjectStore(OFFLINE_STORES.outbox, {
          keyPath: "clientTxnId",
        });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(OFFLINE_STORES.serialLocks)) {
        db.createObjectStore(OFFLINE_STORES.serialLocks, {
          keyPath: "productSerialId",
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IDB open failed"));
  });
}

export async function idbPut<T extends object>(
  storeName: OfflineStoreName,
  value: T,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB put failed"));
  });
}

export async function idbPutAll<T extends object>(
  storeName: OfflineStoreName,
  values: T[],
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    for (const value of values) {
      store.put(value);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB putAll failed"));
  });
}

export async function idbClear(storeName: OfflineStoreName): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB clear failed"));
  });
}

export async function idbGet<T>(
  storeName: OfflineStoreName,
  key: IDBValidKey,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error ?? new Error("IDB get failed"));
  });
}

export async function idbGetAll<T>(storeName: OfflineStoreName): Promise<T[]> {
  const db = await openDb();
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve((request.result as T[]) ?? []);
    request.onerror = () =>
      reject(request.error ?? new Error("IDB getAll failed"));
  });
}

export async function idbDelete(
  storeName: OfflineStoreName,
  key: IDBValidKey,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB delete failed"));
  });
}

type SnapshotReplacePayload = {
  catalog: object[];
  customers: object[];
  serials: object[];
  meta: object;
};

/**
 * Atomically acquire a serial lock (single IDB transaction: get + put).
 */
export async function idbTryAcquireSerialLock(options: {
  productSerialId: string;
  ownerId: string;
  lockedAt: string;
  expiresAt: string;
}): Promise<"acquired" | "held_by_other" | "refreshed"> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORES.serialLocks, "readwrite");
    const store = tx.objectStore(OFFLINE_STORES.serialLocks);
    const getReq = store.get(options.productSerialId);
    getReq.onsuccess = () => {
      const existing = getReq.result as
        | {
            productSerialId: string;
            ownerId: string;
            expiresAt: string;
          }
        | undefined;
      const now = Date.now();
      if (
        existing &&
        Date.parse(existing.expiresAt) > now &&
        existing.ownerId !== options.ownerId
      ) {
        resolve("held_by_other");
        return;
      }
      store.put({
        productSerialId: options.productSerialId,
        ownerId: options.ownerId,
        lockedAt: options.lockedAt,
        expiresAt: options.expiresAt,
      });
      resolve(existing?.ownerId === options.ownerId ? "refreshed" : "acquired");
    };
    getReq.onerror = () =>
      reject(getReq.error ?? new Error("IDB lock get failed"));
    tx.onerror = () => reject(tx.error ?? new Error("IDB lock tx failed"));
  });
}

/**
 * Atomically replace catalog/customers/serials + meta in a single IDB transaction.
 */
export async function idbReplaceSnapshot(
  snapshot: SnapshotReplacePayload,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      [
        OFFLINE_STORES.catalog,
        OFFLINE_STORES.customers,
        OFFLINE_STORES.serials,
        OFFLINE_STORES.meta,
      ],
      "readwrite",
    );
    const catalogStore = tx.objectStore(OFFLINE_STORES.catalog);
    const customersStore = tx.objectStore(OFFLINE_STORES.customers);
    const serialsStore = tx.objectStore(OFFLINE_STORES.serials);
    const metaStore = tx.objectStore(OFFLINE_STORES.meta);

    catalogStore.clear();
    customersStore.clear();
    serialsStore.clear();

    for (const row of snapshot.catalog) {
      catalogStore.put(row);
    }
    for (const row of snapshot.customers) {
      customersStore.put(row);
    }
    for (const row of snapshot.serials) {
      serialsStore.put(row);
    }
    metaStore.put(snapshot.meta);

    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("IDB snapshot replace failed"));
  });
}
