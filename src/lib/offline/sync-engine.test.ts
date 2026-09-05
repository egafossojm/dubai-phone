/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OfflineCatalogItem, OutboxSaleRecord } from "@/lib/offline/types";

const store = vi.hoisted(() => ({
  outbox: new Map<string, OutboxSaleRecord>(),
  catalog: [] as OfflineCatalogItem[],
  reservedCalls: 0,
  releasedCalls: 0,
}));

vi.mock("@/lib/offline/repository", () => ({
  getCachedCatalog: async () => store.catalog,
  getSnapshotMeta: async () => ({
    fetchedAt: new Date().toISOString(),
    catalogCount: 1,
    customerCount: 0,
    serialCount: 0,
    catalogTruncated: false,
    customersTruncated: false,
    serialsTruncated: false,
    minDownPaymentBps: 1000,
  }),
  getOutbox: async (id: string) => store.outbox.get(id),
  listOutbox: async () => [...store.outbox.values()],
  putOutbox: async (record: OutboxSaleRecord) => {
    store.outbox.set(record.clientTxnId, record);
  },
  removeOutbox: async (id: string) => {
    store.outbox.delete(id);
  },
  saveSnapshot: async () => undefined,
}));

vi.mock("@/lib/offline/serial-locks", () => ({
  releaseSerial: async () => undefined,
}));

vi.mock("@/lib/offline/stock-reservation", () => ({
  getCachedSerials: async () => [],
  listPendingOutboxSerialIds: async () => new Set<string>(),
  reserveOfflineSaleStock: async () => {
    store.reservedCalls += 1;
  },
  releaseOfflineSaleStock: async () => {
    store.releasedCalls += 1;
  },
}));

import {
  abandonOutboxItem,
  enqueueOfflineSale,
  flushOutbox,
  repairOutboxPayment,
  retryOutboxItem,
} from "@/lib/offline/sync-engine";

function makePayload(clientTxnId: string, amount = "3500") {
  return {
    clientTxnId,
    kind: "IMMEDIATE" as const,
    items: [
      {
        variantId: "22222222-2222-4222-8222-222222222222",
        quantity: 1,
      },
    ],
    payments: [
      {
        method: "CASH" as const,
        amountXaf: amount,
        idempotencyKey: `pay-${clientTxnId}`,
      },
    ],
  };
}

describe("sync-engine", () => {
  beforeEach(() => {
    store.outbox.clear();
    store.reservedCalls = 0;
    store.releasedCalls = 0;
    store.catalog = [
      {
        variantId: "22222222-2222-4222-8222-222222222222",
        sku: "CABLE",
        name: "Câble",
        sellingPriceXaf: "3500",
        sellingPriceLabel: "3 500 FCFA",
        isSerialized: false,
        quantityAvailable: 5,
      },
    ];
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("enqueues offline sale once (refresh-safe)", async () => {
    const txn = "11111111-1111-4111-8111-111111111111";
    const first = await enqueueOfflineSale(makePayload(txn));
    const second = await enqueueOfflineSale(makePayload(txn));
    expect(first.clientTxnId).toBe(txn);
    expect(second.clientTxnId).toBe(txn);
    expect(store.outbox.size).toBe(1);
    expect(store.reservedCalls).toBe(1);
  });

  it("flushes pending sale successfully", async () => {
    const txn = "22222222-2222-4222-8222-222222222222";
    await enqueueOfflineSale(makePayload(txn));
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { sale: { id: "sale-1", reference: "V-001" } },
        }),
        { status: 201 },
      ),
    );
    const result = await flushOutbox();
    expect(result.synced).toBe(1);
    expect(store.outbox.get(txn)?.status).toBe("SYNCED");
  });

  it("does not auto-retry CONFLICT rows on flush", async () => {
    const txn = "33333333-3333-4333-8333-333333333333";
    store.outbox.set(txn, {
      clientTxnId: txn,
      status: "CONFLICT",
      payload: makePayload(txn),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attempts: 2,
      lastError: "IMEI déjà vendu",
    });
    const result = await flushOutbox();
    expect(result.processed).toBe(0);
    expect(store.outbox.get(txn)?.status).toBe("CONFLICT");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("handles partial flush (ok + network fail + conflict left)", async () => {
    const ok = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const net = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const conflict = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await enqueueOfflineSale(makePayload(ok));
    await enqueueOfflineSale(makePayload(net));
    store.outbox.set(conflict, {
      clientTxnId: conflict,
      status: "CONFLICT",
      payload: makePayload(conflict),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attempts: 1,
      lastError: "IMEI",
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { sale: { id: "s1", reference: "V-1" } },
          }),
          { status: 201 },
        ),
      )
      .mockRejectedValueOnce(new Error("timeout"));

    const result = await flushOutbox();
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.conflicted).toBe(0);
    expect(result.processed).toBe(2);
    expect(store.outbox.get(ok)?.status).toBe("SYNCED");
    expect(store.outbox.get(net)?.status).toBe("FAILED");
    expect(store.outbox.get(conflict)?.status).toBe("CONFLICT");
  });

  it("classifies payment mismatch as FAILED and allows repair", async () => {
    const txn = "44444444-4444-4444-8444-444444444444";
    store.outbox.set(txn, {
      clientTxnId: txn,
      status: "FAILED",
      payload: makePayload(txn, "2"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attempts: 1,
      lastError: "Paiement incomplet",
      lastErrorDetails: {
        kind: "PAYMENT_MISMATCH",
        expectedTotalXaf: "3500",
        receivedPaidXaf: "2",
      },
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { sale: { id: "sale-2", reference: "V-002" } },
        }),
        { status: 201 },
      ),
    );
    const repaired = await repairOutboxPayment(txn, "3500");
    expect(repaired.status).toBe("SYNCED");
    expect(store.outbox.get(txn)?.payload.payments[0]?.amountXaf).toBe("3500");
  });

  it("marks network errors as FAILED without throwing", async () => {
    const txn = "55555555-5555-4555-8555-555555555555";
    await enqueueOfflineSale(makePayload(txn));
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network down"));
    const result = await flushOutbox();
    expect(result.failed).toBe(1);
    expect(store.outbox.get(txn)?.status).toBe("FAILED");
    expect(store.outbox.get(txn)?.lastError).toContain("Network down");
  });

  it("rejects retry on CONFLICT", async () => {
    const txn = "66666666-6666-4666-8666-666666666666";
    store.outbox.set(txn, {
      clientTxnId: txn,
      status: "CONFLICT",
      payload: makePayload(txn),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attempts: 3,
      lastError: "Conflit",
    });
    await expect(retryOutboxItem(txn)).rejects.toThrow(/Conflit irrécupérable/);
  });

  it("abandons and releases reserved stock", async () => {
    const txn = "77777777-7777-4777-8777-777777777777";
    await enqueueOfflineSale(makePayload(txn));
    await abandonOutboxItem(txn);
    expect(store.outbox.has(txn)).toBe(false);
    expect(store.releasedCalls).toBe(1);
  });
});
