import { describe, expect, it } from "vitest";
import {
  releaseOfflineSaleStock,
  reserveOfflineSaleStock,
} from "@/lib/offline/stock-reservation";
import type {
  OfflineCatalogItem,
  OfflineSalePayload,
  OfflineSerial,
} from "@/lib/offline/types";
import { beforeEach, vi } from "vitest";

const mem = vi.hoisted(() => ({
  catalog: new Map<string, OfflineCatalogItem>(),
  serials: new Map<string, OfflineSerial>(),
}));

vi.mock("@/lib/offline/idb", () => ({
  OFFLINE_STORES: {
    catalog: "catalog",
    serials: "serials",
    outbox: "outbox",
  },
  idbGet: async (store: string, key: string) => {
    if (store === "catalog") {
      return mem.catalog.get(key);
    }
    if (store === "serials") {
      return mem.serials.get(key);
    }
    return undefined;
  },
  idbPut: async (store: string, value: { variantId?: string; id?: string }) => {
    if (store === "catalog" && value.variantId) {
      mem.catalog.set(value.variantId, value as OfflineCatalogItem);
    }
    if (store === "serials" && value.id) {
      mem.serials.set(value.id, value as OfflineSerial);
    }
  },
  idbGetAll: async () => [],
}));

describe("stock-reservation", () => {
  beforeEach(() => {
    mem.catalog.clear();
    mem.serials.clear();
    mem.catalog.set("v1", {
      variantId: "v1",
      sku: "CABLE",
      name: "Cable",
      sellingPriceXaf: "3500",
      sellingPriceLabel: "3500",
      isSerialized: false,
      quantityAvailable: 5,
    });
    mem.serials.set("s1", {
      id: "s1",
      variantId: "v2",
      imei1: "1",
      serialNumber: null,
      status: "IN_STOCK",
    });
  });

  it("decrements qty and restores on release", async () => {
    const payload: OfflineSalePayload = {
      clientTxnId: "11111111-1111-4111-8111-111111111111",
      kind: "IMMEDIATE",
      items: [{ variantId: "v1", quantity: 2 }],
      payments: [
        { method: "CASH", amountXaf: "7000", idempotencyKey: "pay-1xxxxxx" },
      ],
    };
    await reserveOfflineSaleStock(payload);
    expect(mem.catalog.get("v1")?.quantityAvailable).toBe(3);
    await releaseOfflineSaleStock(payload);
    expect(mem.catalog.get("v1")?.quantityAvailable).toBe(5);
  });

  it("marks serial PENDING_SYNC then restores IN_STOCK", async () => {
    const payload: OfflineSalePayload = {
      clientTxnId: "11111111-1111-4111-8111-111111111112",
      kind: "IMMEDIATE",
      items: [{ variantId: "v2", quantity: 1, productSerialId: "s1" }],
      payments: [
        { method: "CASH", amountXaf: "1", idempotencyKey: "pay-2xxxxxx" },
      ],
    };
    await reserveOfflineSaleStock(payload);
    expect(mem.serials.get("s1")?.status).toBe("PENDING_SYNC");
    await releaseOfflineSaleStock(payload);
    expect(mem.serials.get("s1")?.status).toBe("IN_STOCK");
  });
});
