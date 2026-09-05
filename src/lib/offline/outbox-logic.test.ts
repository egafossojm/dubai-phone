import { describe, expect, it } from "vitest";
import {
  outboxStatusLabel,
  type OutboxSaleRecord,
  type OfflineSalePayload,
} from "@/lib/offline/types";

function makePayload(clientTxnId: string): OfflineSalePayload {
  return {
    clientTxnId,
    kind: "IMMEDIATE",
    items: [{ variantId: "00000000-0000-4000-8000-000000000001", quantity: 1 }],
    payments: [
      {
        method: "CASH",
        amountXaf: 1000,
        idempotencyKey: `pay-${clientTxnId}`,
      },
    ],
  };
}

/**
 * In-memory outbox simulating refresh-safe enqueue (same clientTxnId).
 */
function createMemoryOutbox() {
  const rows = new Map<string, OutboxSaleRecord>();
  return {
    enqueue(payload: OfflineSalePayload) {
      const existing = rows.get(payload.clientTxnId);
      if (existing) {
        return { record: existing, created: false };
      }
      const now = new Date().toISOString();
      const record: OutboxSaleRecord = {
        clientTxnId: payload.clientTxnId,
        status: "PENDING_SYNC",
        payload,
        createdAt: now,
        updatedAt: now,
        attempts: 0,
      };
      rows.set(payload.clientTxnId, record);
      return { record, created: true };
    },
    markSynced(clientTxnId: string, saleId: string) {
      const row = rows.get(clientTxnId);
      if (!row) {
        throw new Error("missing");
      }
      const next = {
        ...row,
        status: "SYNCED" as const,
        saleId,
        updatedAt: new Date().toISOString(),
      };
      rows.set(clientTxnId, next);
      return next;
    },
    markConflict(clientTxnId: string, message: string) {
      const row = rows.get(clientTxnId)!;
      const next = {
        ...row,
        status: "CONFLICT" as const,
        lastError: message,
        attempts: row.attempts + 1,
        updatedAt: new Date().toISOString(),
      };
      rows.set(clientTxnId, next);
      return next;
    },
    list() {
      return [...rows.values()];
    },
  };
}

describe("offline outbox behavior", () => {
  it("labels statuses for the sync center", () => {
    expect(outboxStatusLabel("PENDING_SYNC")).toBe("En attente");
    expect(outboxStatusLabel("CONFLICT")).toBe("Conflit");
    expect(outboxStatusLabel("SYNCED")).toBe("Synchronisé");
  });

  it("does not duplicate on refresh / double enqueue", () => {
    const box = createMemoryOutbox();
    const txn = "11111111-1111-4111-8111-111111111111";
    const first = box.enqueue(makePayload(txn));
    const second = box.enqueue(makePayload(txn));
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(box.list()).toHaveLength(1);
  });

  it("keeps failed/conflict rows visible after partial sync", () => {
    const box = createMemoryOutbox();
    const ok = "22222222-2222-4222-8222-222222222222";
    const bad = "33333333-3333-4333-8333-333333333333";
    box.enqueue(makePayload(ok));
    box.enqueue(makePayload(bad));
    box.markSynced(ok, "sale-1");
    box.markConflict(bad, "IMEI déjà vendu");
    const rows = box.list();
    expect(rows.find((row) => row.clientTxnId === ok)?.status).toBe("SYNCED");
    expect(rows.find((row) => row.clientTxnId === bad)?.status).toBe("CONFLICT");
    expect(rows.find((row) => row.clientTxnId === bad)?.lastError).toContain(
      "IMEI",
    );
  });
});
