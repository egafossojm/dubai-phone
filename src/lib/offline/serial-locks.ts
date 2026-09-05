import {
  idbDelete,
  idbGet,
  idbGetAll,
  idbTryAcquireSerialLock,
  OFFLINE_STORES,
} from "@/lib/offline/idb";

const LOCK_TTL_MS = 30 * 60 * 1000;
const OWNER_KEY = "dp-offline-lock-owner";

export type SerialLockRecord = {
  productSerialId: string;
  ownerId: string;
  lockedAt: string;
  expiresAt: string;
};

export function getLockOwnerId(): string {
  if (typeof sessionStorage === "undefined") {
    return "server";
  }
  let owner = sessionStorage.getItem(OWNER_KEY);
  if (!owner) {
    owner = crypto.randomUUID();
    sessionStorage.setItem(OWNER_KEY, owner);
  }
  return owner;
}

function isExpired(row: SerialLockRecord, now = Date.now()): boolean {
  return Date.parse(row.expiresAt) <= now;
}

export async function pruneExpiredSerialLocks(): Promise<void> {
  const rows = await idbGetAll<SerialLockRecord>(OFFLINE_STORES.serialLocks);
  const now = Date.now();
  await Promise.all(
    rows
      .filter((row) => isExpired(row, now))
      .map((row) => idbDelete(OFFLINE_STORES.serialLocks, row.productSerialId)),
  );
}

export async function lockSerial(productSerialId: string): Promise<void> {
  const ownerId = getLockOwnerId();
  const now = Date.now();
  await pruneExpiredSerialLocks();
  const result = await idbTryAcquireSerialLock({
    productSerialId,
    ownerId,
    lockedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + LOCK_TTL_MS).toISOString(),
  });
  if (result === "held_by_other") {
    throw new Error("Cet appareil est réservé sur un autre poste / onglet.");
  }
}

export async function releaseSerial(productSerialId: string): Promise<void> {
  const ownerId = getLockOwnerId();
  const existing = await idbGet<SerialLockRecord>(
    OFFLINE_STORES.serialLocks,
    productSerialId,
  );
  if (existing?.ownerId === ownerId) {
    await idbDelete(OFFLINE_STORES.serialLocks, productSerialId);
  }
}

export async function releaseOwnerLocksExcept(
  keepSerialIds: Set<string>,
): Promise<void> {
  const ownerId = getLockOwnerId();
  const rows = await idbGetAll<SerialLockRecord>(OFFLINE_STORES.serialLocks);
  await Promise.all(
    rows
      .filter(
        (row) =>
          row.ownerId === ownerId && !keepSerialIds.has(row.productSerialId),
      )
      .map((row) => idbDelete(OFFLINE_STORES.serialLocks, row.productSerialId)),
  );
}

export async function releaseAllOwnerLocks(): Promise<void> {
  await releaseOwnerLocksExcept(new Set());
}

/** True if any non-expired lock exists (including same owner). */
export async function isSerialLocked(
  productSerialId: string,
): Promise<boolean> {
  await pruneExpiredSerialLocks();
  const existing = await idbGet<SerialLockRecord>(
    OFFLINE_STORES.serialLocks,
    productSerialId,
  );
  if (!existing) {
    return false;
  }
  return !isExpired(existing);
}

export async function isSerialLockedByOther(
  productSerialId: string,
): Promise<boolean> {
  await pruneExpiredSerialLocks();
  const existing = await idbGet<SerialLockRecord>(
    OFFLINE_STORES.serialLocks,
    productSerialId,
  );
  if (!existing || isExpired(existing)) {
    return false;
  }
  return existing.ownerId !== getLockOwnerId();
}
