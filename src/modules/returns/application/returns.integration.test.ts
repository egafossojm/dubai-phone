/**
 * @vitest-environment node
 */
import { randomBytes, randomUUID } from "node:crypto";
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
import { POST as createSale } from "@/app/api/sales/route";
import { POST as createReturn, GET as listReturns } from "@/app/api/returns/route";
import { GET as getReturn } from "@/app/api/returns/[id]/route";
import { POST as inspectReturn } from "@/app/api/returns/[id]/inspect/route";
import { POST as acceptReturn } from "@/app/api/returns/[id]/accept/route";
import { POST as refundReturn } from "@/app/api/returns/[id]/refund/route";
import { POST as exchangeReturn } from "@/app/api/returns/[id]/exchange/route";
import { GET as lookupWarranty } from "@/app/api/warranties/lookup/route";

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
  return user;
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function sellCable(quantity = 2) {
  const cable = await findSellableVariant();
  if (!cable) {
    return null;
  }
  await ensureVariantStock(cable.id, quantity + 2);
  const unit = Number(cable.sellingPriceXaf);
  const total = String(unit * quantity);
  const clientTxnId = randomUUID();
  const response = await createSale(
    jsonRequest("http://localhost/api/sales", "POST", {
      clientTxnId,
      kind: "IMMEDIATE",
      items: [{ variantId: cable.id, quantity }],
      payments: [
        {
          method: "CASH",
          amountXaf: total,
          idempotencyKey: `ret-sale-${clientTxnId}`,
        },
      ],
    }),
  );
  expect(response.status).toBe(201);
  const payload = (await response.json()) as {
    data: {
      sale: {
        id: string;
        items: Array<{ id: string; quantity: number; lineTotalXaf: string }>;
        totalXaf: string;
      };
    };
  };
  return { sale: payload.data.sale, cable, unit };
}

async function sellSerialized() {
  const serial = await allocateTestSerial();
  if (!serial) {
    return null;
  }
  const price = serial.variant.sellingPriceXaf.toString();
  const clientTxnId = randomUUID();
  const response = await createSale(
    jsonRequest("http://localhost/api/sales", "POST", {
      clientTxnId,
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
          idempotencyKey: `ret-ser-${clientTxnId}`,
        },
      ],
    }),
  );
  expect(response.status).toBe(201);
  const payload = (await response.json()) as {
    data: {
      sale: {
        id: string;
        reference: string;
        items: Array<{ id: string; serial: { id: string } | null }>;
        totalXaf: string;
      };
    };
  };
  return { sale: payload.data.sale, serial, price };
}

async function openAcceptedReturn(options: {
  saleId: string;
  saleItemId: string;
  quantity: number;
  productSerialId?: string;
  resolution: "REFUND" | "EXCHANGE";
  reason?: string;
}) {
  await attachSession("caisse@dubai-phone.local");
  const created = await createReturn(
    jsonRequest("http://localhost/api/returns", "POST", {
      saleId: options.saleId,
      reason: options.reason ?? "Produit défectueux — test",
      items: [
        {
          saleItemId: options.saleItemId,
          quantity: options.quantity,
          productSerialId: options.productSerialId,
          restock: true,
        },
      ],
    }),
  );
  expect(created.status).toBe(201);
  const createdPayload = (await created.json()) as { data: { id: string } };
  const returnId = createdPayload.data.id;

  await attachSession("manager@dubai-phone.local");
  const inspected = await inspectReturn(
    jsonRequest(`http://localhost/api/returns/${returnId}/inspect`, "POST"),
    params(returnId),
  );
  expect(inspected.status).toBe(200);

  const accepted = await acceptReturn(
    jsonRequest(`http://localhost/api/returns/${returnId}/accept`, "POST", {
      resolution: options.resolution,
    }),
    params(returnId),
  );
  expect(accepted.status).toBe(200);
  return returnId;
}

const databaseAvailable = await requireDatabaseForIntegration();

describe.skipIf(!databaseAvailable)("returns / refunds / warranties APIs", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    cookieJar.token = undefined;
    await prisma.$disconnect();
  });

  it("creates a valid return request", async () => {
    await attachSession("caisse@dubai-phone.local");
    const sold = await sellCable(1);
    if (!sold) {
      return;
    }
    const response = await createReturn(
      jsonRequest("http://localhost/api/returns", "POST", {
        saleId: sold.sale.id,
        reason: "Erreur de modèle",
        items: [
          {
            saleItemId: sold.sale.items[0]!.id,
            quantity: 1,
            restock: true,
          },
        ],
      }),
    );
    expect(response.status).toBe(201);
    const payload = (await response.json()) as {
      data: { id: string; status: string; saleId: string };
    };
    expect(payload.data.status).toBe("REQUESTED");
    expect(payload.data.saleId).toBe(sold.sale.id);

    const listed = await listReturns(
      new NextRequest("http://localhost/api/returns?status=REQUESTED"),
    );
    expect(listed.status).toBe(200);
  });

  it("exposes valid and expired warranty status on lookup", async () => {
    await attachSession("caisse@dubai-phone.local");
    const sold = await sellSerialized();
    if (!sold) {
      return;
    }

    const warranty = await prisma.warranty.findFirstOrThrow({
      where: { saleId: sold.sale.id },
    });
    expect(warranty.status).toBe("ACTIVE");

    await attachSession("manager@dubai-phone.local");
    const valid = await lookupWarranty(
      new NextRequest(
        `http://localhost/api/warranties/lookup?q=${encodeURIComponent(sold.serial.imei1!)}`,
      ),
    );
    expect(valid.status).toBe(200);
    const validPayload = (await valid.json()) as {
      data: { items: Array<{ status: string; startsAt: string; endsAt: string }> };
    };
    expect(validPayload.data.items.length).toBeGreaterThan(0);
    expect(validPayload.data.items[0]!.status).toBe("ACTIVE");
    expect(validPayload.data.items[0]!.startsAt).toBeTruthy();
    expect(validPayload.data.items[0]!.endsAt).toBeTruthy();

    await prisma.warranty.update({
      where: { id: warranty.id },
      data: { endsAt: new Date("2020-01-01T00:00:00.000Z") },
    });

    const expired = await lookupWarranty(
      new NextRequest(
        `http://localhost/api/warranties/lookup?q=${encodeURIComponent(warranty.reference)}`,
      ),
    );
    expect(expired.status).toBe(200);
    const expiredPayload = (await expired.json()) as {
      data: { items: Array<{ status: string }> };
    };
    expect(expiredPayload.data.items[0]!.status).toBe("EXPIRED");

    const persisted = await prisma.warranty.findUniqueOrThrow({
      where: { id: warranty.id },
    });
    expect(persisted.status).toBe("EXPIRED");
  });

  it("forbids unauthorized refunds", async () => {
    await attachSession("caisse@dubai-phone.local");
    const sold = await sellCable(1);
    if (!sold) {
      return;
    }
    const returnId = await openAcceptedReturn({
      saleId: sold.sale.id,
      saleItemId: sold.sale.items[0]!.id,
      quantity: 1,
      resolution: "REFUND",
    });

    await attachSession("caisse@dubai-phone.local");
    const forbidden = await refundReturn(
      jsonRequest(`http://localhost/api/returns/${returnId}/refund`, "POST", {
        amountXaf: sold.sale.totalXaf,
        method: "CASH",
        idempotencyKey: `forbid-${randomBytes(4).toString("hex")}`,
      }),
      params(returnId),
    );
    expect(forbidden.status).toBe(403);
  });

  it("records a partial refund without closing the return early", async () => {
    await attachSession("caisse@dubai-phone.local");
    const sold = await sellCable(2);
    if (!sold) {
      return;
    }
    const returnId = await openAcceptedReturn({
      saleId: sold.sale.id,
      saleItemId: sold.sale.items[0]!.id,
      quantity: 1,
      resolution: "REFUND",
    });

    const detailBefore = await getReturn(
      new NextRequest(`http://localhost/api/returns/${returnId}`),
      params(returnId),
    );
    const beforePayload = (await detailBefore.json()) as {
      data: { refundableXaf: string };
    };
    const refundable = BigInt(beforePayload.data.refundableXaf);
    expect(refundable).toBe(BigInt(sold.unit));

    await attachSession("manager@dubai-phone.local");
    const partialAmount = String(sold.unit - 1000);
    const response = await refundReturn(
      jsonRequest(`http://localhost/api/returns/${returnId}/refund`, "POST", {
        amountXaf: partialAmount,
        method: "CASH",
        idempotencyKey: `partial-${randomBytes(4).toString("hex")}`,
      }),
      params(returnId),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: { status: string; refunds: Array<{ amountXaf: string }>; refundableXaf: string };
    };
    expect(payload.data.status).toBe("ACCEPTED");
    expect(payload.data.refunds[0]!.amountXaf).toBe(partialAmount);
    expect(BigInt(payload.data.refundableXaf)).toBe(BigInt(1000));

    const saleMid = await prisma.sale.findUniqueOrThrow({
      where: { id: sold.sale.id },
    });
    expect(saleMid.status).toBe("COMPLETED");

    const finish = await refundReturn(
      jsonRequest(`http://localhost/api/returns/${returnId}/refund`, "POST", {
        amountXaf: "1000",
        method: "CASH",
        idempotencyKey: `partial-finish-${randomBytes(4).toString("hex")}`,
      }),
      params(returnId),
    );
    expect(finish.status).toBe(200);
    const finishPayload = (await finish.json()) as { data: { status: string } };
    expect(finishPayload.data.status).toBe("COMPLETED");

    const sale = await prisma.sale.findUniqueOrThrow({
      where: { id: sold.sale.id },
    });
    expect(sale.status).toBe("PARTIALLY_RETURNED");
  });

  it("records a full refund and restocks", async () => {
    await attachSession("caisse@dubai-phone.local");
    const sold = await sellCable(1);
    if (!sold) {
      return;
    }
    const stockBefore = (
      await prisma.productVariant.findUniqueOrThrow({
        where: { id: sold.cable.id },
      })
    ).quantityOnHand;

    const returnId = await openAcceptedReturn({
      saleId: sold.sale.id,
      saleItemId: sold.sale.items[0]!.id,
      quantity: 1,
      resolution: "REFUND",
    });

    await attachSession("manager@dubai-phone.local");
    const response = await refundReturn(
      jsonRequest(`http://localhost/api/returns/${returnId}/refund`, "POST", {
        amountXaf: sold.sale.totalXaf,
        method: "CASH",
        idempotencyKey: `full-${randomBytes(4).toString("hex")}`,
      }),
      params(returnId),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: { status: string; refunds: Array<{ amountXaf: string }> };
    };
    expect(payload.data.status).toBe("COMPLETED");
    expect(payload.data.refunds[0]!.amountXaf).toBe(sold.sale.totalXaf);

    const stockAfter = (
      await prisma.productVariant.findUniqueOrThrow({
        where: { id: sold.cable.id },
      })
    ).quantityOnHand;
    expect(stockAfter).toBe(stockBefore + 1);

    const sale = await prisma.sale.findUniqueOrThrow({
      where: { id: sold.sale.id },
    });
    expect(sale.status).toBe("RETURNED");

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: returnId, action: "return.refund" },
    });
    expect(audit).toBeTruthy();
  });

  it("completes an exchange for a non-serialized product", async () => {
    await attachSession("caisse@dubai-phone.local");
    const sold = await sellCable(1);
    if (!sold) {
      return;
    }
    const stockBefore = (
      await prisma.productVariant.findUniqueOrThrow({
        where: { id: sold.cable.id },
      })
    ).quantityOnHand;

    const returnId = await openAcceptedReturn({
      saleId: sold.sale.id,
      saleItemId: sold.sale.items[0]!.id,
      quantity: 1,
      resolution: "EXCHANGE",
    });

    const detail = await getReturn(
      new NextRequest(`http://localhost/api/returns/${returnId}`),
      params(returnId),
    );
    const detailPayload = (await detail.json()) as {
      data: { items: Array<{ id: string }> };
    };

    await attachSession("manager@dubai-phone.local");
    const response = await exchangeReturn(
      jsonRequest(`http://localhost/api/returns/${returnId}/exchange`, "POST", {
        items: [{ returnItemId: detailPayload.data.items[0]!.id }],
        idempotencyKey: `exch-${randomBytes(4).toString("hex")}`,
      }),
      params(returnId),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: { status: string } };
    expect(payload.data.status).toBe("COMPLETED");

    const stockAfter = (
      await prisma.productVariant.findUniqueOrThrow({
        where: { id: sold.cable.id },
      })
    ).quantityOnHand;
    // Restock + re-deduct → net zero vs stock at accept time (sale already deducted).
    expect(stockAfter).toBe(stockBefore);
  });

  it("rejects exchange payloads with duplicate return lines", async () => {
    await attachSession("caisse@dubai-phone.local");
    const sold = await sellCable(2);
    if (!sold) {
      return;
    }
    await attachSession("caisse@dubai-phone.local");
    const created = await createReturn(
      jsonRequest("http://localhost/api/returns", "POST", {
        saleId: sold.sale.id,
        reason: "Échange multi-lignes test",
        items: [
          {
            saleItemId: sold.sale.items[0]!.id,
            quantity: 2,
          },
        ],
      }),
    );
    expect(created.status).toBe(201);
    const createdPayload = (await created.json()) as { data: { id: string } };
    const returnId = createdPayload.data.id;

    await attachSession("manager@dubai-phone.local");
    await inspectReturn(
      jsonRequest(`http://localhost/api/returns/${returnId}/inspect`, "POST"),
      params(returnId),
    );
    await acceptReturn(
      jsonRequest(`http://localhost/api/returns/${returnId}/accept`, "POST", {
        resolution: "EXCHANGE",
      }),
      params(returnId),
    );
    const detail = await getReturn(
      new NextRequest(`http://localhost/api/returns/${returnId}`),
      params(returnId),
    );
    const detailPayload = (await detail.json()) as {
      data: { items: Array<{ id: string }> };
    };
    const lineId = detailPayload.data.items[0]!.id;

    const bad = await exchangeReturn(
      jsonRequest(`http://localhost/api/returns/${returnId}/exchange`, "POST", {
        items: [
          { returnItemId: lineId },
          { returnItemId: lineId },
        ],
        idempotencyKey: `exch-dup-${randomBytes(4).toString("hex")}`,
      }),
      params(returnId),
    );
    expect(bad.status).toBe(400);
  });

  it("expires warranty on serialized refund", async () => {
    await attachSession("caisse@dubai-phone.local");
    const sold = await sellSerialized();
    if (!sold) {
      return;
    }
    const saleItemId = sold.sale.items[0]!.id;
    const serialId = sold.sale.items[0]!.serial?.id ?? sold.serial.id;
    const returnId = await openAcceptedReturn({
      saleId: sold.sale.id,
      saleItemId,
      quantity: 1,
      productSerialId: serialId,
      resolution: "REFUND",
    });

    await attachSession("manager@dubai-phone.local");
    const response = await refundReturn(
      jsonRequest(`http://localhost/api/returns/${returnId}/refund`, "POST", {
        amountXaf: sold.sale.totalXaf,
        method: "CASH",
        idempotencyKey: `ser-ref-${randomBytes(4).toString("hex")}`,
      }),
      params(returnId),
    );
    expect(response.status).toBe(200);

    const warranty = await prisma.warranty.findFirstOrThrow({
      where: { saleId: sold.sale.id },
    });
    expect(warranty.status).toBe("EXPIRED");
  });
});
