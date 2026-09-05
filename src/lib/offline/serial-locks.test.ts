/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const locks = vi.hoisted(() => ({
  rows: new Map<
    string,
    { productSerialId: string; ownerId: string; expiresAt: string; lockedAt: string }
  >(),
}));

vi.mock("@/lib/offline/idb", () => ({
  OFFLINE_STORES: { serialLocks: "serialLocks" },
  idbGet: async (_store: string, key: string) => locks.rows.get(key),
  idbGetAll: async () => [...locks.rows.values()],
  idbDelete: async (_store: string, key: string) => {
    locks.rows.delete(key);
  },
  idbTryAcquireSerialLock: async (options: {
    productSerialId: string;
    ownerId: string;
    lockedAt: string;
    expiresAt: string;
  }) => {
    const existing = locks.rows.get(options.productSerialId);
    const now = Date.now();
    if (
      existing &&
      Date.parse(existing.expiresAt) > now &&
      existing.ownerId !== options.ownerId
    ) {
      return "held_by_other" as const;
    }
    locks.rows.set(options.productSerialId, {
      productSerialId: options.productSerialId,
      ownerId: options.ownerId,
      lockedAt: options.lockedAt,
      expiresAt: options.expiresAt,
    });
    return existing?.ownerId === options.ownerId
      ? ("refreshed" as const)
      : ("acquired" as const);
  },
}));

import {
  isSerialLocked,
  isSerialLockedByOther,
  lockSerial,
  releaseSerial,
} from "@/lib/offline/serial-locks";

describe("serial-locks", () => {
  beforeEach(() => {
    locks.rows.clear();
    sessionStorage.clear();
  });

  it("acquires and reports lock for same owner", async () => {
    await lockSerial("serial-1");
    expect(await isSerialLocked("serial-1")).toBe(true);
    expect(await isSerialLockedByOther("serial-1")).toBe(false);
  });

  it("blocks other owner", async () => {
    await lockSerial("serial-2");
    const ownerA = sessionStorage.getItem("dp-offline-lock-owner");
    sessionStorage.setItem("dp-offline-lock-owner", "other-owner");
    await expect(lockSerial("serial-2")).rejects.toThrow(/réservé/);
    expect(await isSerialLockedByOther("serial-2")).toBe(true);
    sessionStorage.setItem("dp-offline-lock-owner", ownerA!);
  });

  it("releases own lock", async () => {
    await lockSerial("serial-3");
    await releaseSerial("serial-3");
    expect(await isSerialLocked("serial-3")).toBe(false);
  });
});
