/**
 * @vitest-environment node
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createSessionToken, hashSessionToken } from "@/lib/auth/session-token";
import { requireDatabaseForIntegration } from "@/lib/test/database-available";
import {
  allocateTestSerial,
  ensureVariantStock,
  findSellableVariant,
} from "@/lib/test/sales-fixtures";
import { POST as syncSale } from "@/app/api/sync/sales/route";
import { GET as getSnapshot } from "@/app/api/sync/snapshot/route";

const cookieJar = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "dp_session" && cookieJar.token
        ? { name, value: cookieJar.token }
        : undefined,
    set: () => undefined,
    delete: () => {
      cookieJar.token = undefined;
    },
  }),
}));

async function attachSession(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const token = createSessionToken();
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  cookieJar.token = token;
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });
}

const databaseAvailable = await requireDatabaseForIntegration();

describe.skipIf(!databaseAvailable)("offline sync APIs", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    cookieJar.token = undefined;
    await prisma.$disconnect();
  });

  it("returns a snapshot for cashier", async () => {
    await attachSession("caisse@dubai-phone.local");
    const response = await getSnapshot(
      jsonRequest("http://localhost/api/sync/snapshot", "GET"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: {
        catalog: unknown[];
        customers: unknown[];
        serials: unknown[];
      };
    };
    expect(payload.data.catalog.length).toBeGreaterThan(0);
    expect(payload.data.customers.length).toBeGreaterThan(0);
  });

  it("syncs a sale idempotently via clientTxnId", async () => {
    await attachSession("caisse@dubai-phone.local");
    const cable = await findSellableVariant();
    if (!cable) {
      return;
    }
    await ensureVariantStock(cable.id, 1);
    const clientTxnId = randomUUID();
    const body = {
      clientTxnId,
      kind: "IMMEDIATE",
      items: [{ variantId: cable.id, quantity: 1 }],
      payments: [
        {
          method: "CASH",
          amountXaf: cable.sellingPriceXaf.toString(),
          idempotencyKey: `sync-pay-${clientTxnId}`,
        },
      ],
    };

    const first = await syncSale(
      jsonRequest("http://localhost/api/sync/sales", "POST", body),
    );
    expect(first.status).toBe(201);
    const firstPayload = (await first.json()) as {
      data: { sale: { id: string }; syncStatus: string; replayed: boolean };
    };
    expect(firstPayload.data.syncStatus).toBe("SYNCED");
    expect(firstPayload.data.replayed).toBe(false);

    const second = await syncSale(
      jsonRequest("http://localhost/api/sync/sales", "POST", body),
    );
    expect(second.status).toBe(200);
    const secondPayload = (await second.json()) as {
      data: { sale: { id: string }; replayed: boolean; syncStatus: string };
    };
    expect(secondPayload.data.replayed).toBe(true);
    expect(secondPayload.data.sale.id).toBe(firstPayload.data.sale.id);

    const syncRow = await prisma.syncTransaction.findUniqueOrThrow({
      where: { clientTxnId },
    });
    expect(syncRow.status).toBe("SYNCED");
    expect(syncRow.saleId).toBe(firstPayload.data.sale.id);
  });

  it("marks conflict when serial already sold", async () => {
    await attachSession("caisse@dubai-phone.local");
    const serial = await allocateTestSerial();
    if (!serial) {
      return;
    }
    const price = serial.variant.sellingPriceXaf.toString();
    const firstTxn = randomUUID();
    const first = await syncSale(
      jsonRequest("http://localhost/api/sync/sales", "POST", {
        clientTxnId: firstTxn,
        kind: "IMMEDIATE",
        items: [
          {
            variantId: serial.variantId,
            quantity: 1,
            productSerialId: serial.id,
          },
        ],
        payments: [
          {
            method: "CASH",
            amountXaf: price,
            idempotencyKey: `sync-ser-${firstTxn}`,
          },
        ],
      }),
    );
    expect(first.status).toBe(201);

    const secondTxn = randomUUID();
    const second = await syncSale(
      jsonRequest("http://localhost/api/sync/sales", "POST", {
        clientTxnId: secondTxn,
        kind: "IMMEDIATE",
        items: [
          {
            variantId: serial.variantId,
            quantity: 1,
            productSerialId: serial.id,
          },
        ],
        payments: [
          {
            method: "CASH",
            amountXaf: price,
            idempotencyKey: `sync-ser2-${secondTxn}`,
          },
        ],
      }),
    );
    expect(second.status).toBe(422);
    const syncRow = await prisma.syncTransaction.findUniqueOrThrow({
      where: { clientTxnId: secondTxn },
    });
    expect(syncRow.status).toBe("CONFLICT");
  });

  it("marks payment mismatch as FAILED not CONFLICT", async () => {
    await attachSession("caisse@dubai-phone.local");
    const cable = await findSellableVariant();
    if (!cable) {
      return;
    }
    await ensureVariantStock(cable.id, 1);
    const clientTxnId = randomUUID();
    const response = await syncSale(
      jsonRequest("http://localhost/api/sync/sales", "POST", {
        clientTxnId,
        kind: "IMMEDIATE",
        items: [{ variantId: cable.id, quantity: 1 }],
        payments: [
          {
            method: "CASH",
            amountXaf: "1",
            idempotencyKey: `sync-pay-bad-${clientTxnId}`,
          },
        ],
      }),
    );
    expect(response.status).toBe(422);
    const body = (await response.json()) as {
      error: { details?: { kind?: string } };
    };
    expect(body.error.details?.kind).toBe("PAYMENT_MISMATCH");
    const syncRow = await prisma.syncTransaction.findUniqueOrThrow({
      where: { clientTxnId },
    });
    expect(syncRow.status).toBe("FAILED");
    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "sync.sale_failed",
        entityId: syncRow.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
  });

  it("rejects a mutated payload for the same clientTxnId", async () => {
    await attachSession("caisse@dubai-phone.local");
    const cable = await findSellableVariant();
    if (!cable) {
      return;
    }
    await ensureVariantStock(cable.id, 2);
    const clientTxnId = randomUUID();
    const first = await syncSale(
      jsonRequest("http://localhost/api/sync/sales", "POST", {
        clientTxnId,
        kind: "IMMEDIATE",
        items: [{ variantId: cable.id, quantity: 1 }],
        payments: [
          {
            method: "CASH",
            amountXaf: "1",
            idempotencyKey: `sync-mut-a-${clientTxnId}`,
          },
        ],
      }),
    );
    expect(first.status).toBe(422);

    const second = await syncSale(
      jsonRequest("http://localhost/api/sync/sales", "POST", {
        clientTxnId,
        kind: "IMMEDIATE",
        items: [{ variantId: cable.id, quantity: 1 }],
        payments: [
          {
            method: "CASH",
            amountXaf: cable.sellingPriceXaf.toString(),
            idempotencyKey: `sync-mut-b-${clientTxnId}`,
          },
        ],
      }),
    );
    expect(second.status).toBe(409);
    const body = (await second.json()) as {
      error: { details?: { kind?: string } };
    };
    expect(body.error.details?.kind).toBe("SYNC_PAYLOAD_MISMATCH");
  });
});
