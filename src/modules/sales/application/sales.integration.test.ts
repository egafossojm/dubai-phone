/**
 * @vitest-environment node
 */
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { xaf } from "@/lib/money";
import { createSessionToken, hashSessionToken } from "@/lib/auth/session-token";
import { requireDatabaseForIntegration } from "@/lib/test/database-available";
import { POST as createSale, GET as listSales } from "@/app/api/sales/route";
import { GET as getSale } from "@/app/api/sales/[id]/route";
import { GET as searchCatalog } from "@/app/api/sales/catalog/route";

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

const databaseAvailable = await requireDatabaseForIntegration();

describe.skipIf(!databaseAvailable)("sales / POS APIs", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    cookieJar.token = undefined;
    await prisma.$disconnect();
  });

  it("forbids inventory from creating a sale", async () => {
    await attachSession("stock@dubai-phone.local");
    const response = await createSale(
      jsonRequest("http://localhost/api/sales", "POST", {
        clientTxnId: randomUUID(),
        kind: "IMMEDIATE",
        items: [
          {
            variantId: "00000000-0000-4000-8000-000000000001",
            quantity: 1,
          },
        ],
        payments: [
          {
            method: "CASH",
            amountXaf: 1000,
            idempotencyKey: `forbid-${randomBytes(3).toString("hex")}`,
          },
        ],
      }),
    );
    expect(response.status).toBe(403);
  });

  it("completes an immediate non-serialized sale and replays clientTxnId", async () => {
    await attachSession("caisse@dubai-phone.local");
    const cable = await prisma.productVariant.findFirstOrThrow({
      where: {
        deletedAt: null,
        quantityOnHand: { gt: 0 },
        product: { isSerialized: false, status: "ACTIVE" },
      },
    });
    const beforeQty = cable.quantityOnHand;
    const clientTxnId = randomUUID();
    const unitPrice = Number(cable.sellingPriceXaf);
    const body = {
      clientTxnId,
      kind: "IMMEDIATE" as const,
      items: [{ variantId: cable.id, quantity: 1 }],
      payments: [
        {
          method: "CASH" as const,
          amountXaf: unitPrice,
          idempotencyKey: `sale-pay-${clientTxnId}`,
        },
      ],
    };

    const first = await createSale(
      jsonRequest("http://localhost/api/sales", "POST", body),
    );
    expect(first.status).toBe(201);
    const firstPayload = (await first.json()) as {
      data: {
        replayed: boolean;
        sale: { id: string; reference: string; totalXaf: string };
      };
    };
    expect(firstPayload.data.replayed).toBe(false);
    expect(firstPayload.data.sale.totalXaf).toBe(String(unitPrice));

    const after = await prisma.productVariant.findUniqueOrThrow({
      where: { id: cable.id },
    });
    expect(after.quantityOnHand).toBe(beforeQty - 1);

    const second = await createSale(
      jsonRequest("http://localhost/api/sales", "POST", body),
    );
    expect(second.status).toBe(200);
    const secondPayload = (await second.json()) as {
      data: { replayed: boolean; sale: { id: string } };
    };
    expect(secondPayload.data.replayed).toBe(true);
    expect(secondPayload.data.sale.id).toBe(firstPayload.data.sale.id);

    const mismatch = await createSale(
      jsonRequest("http://localhost/api/sales", "POST", {
        ...body,
        payments: [
          {
            method: "CASH",
            amountXaf: unitPrice,
            idempotencyKey: `other-${clientTxnId}`,
          },
        ],
      }),
    );
    expect(mismatch.status).toBe(409);

    const detail = await getSale(
      jsonRequest(
        `http://localhost/api/sales/${firstPayload.data.sale.id}`,
        "GET",
      ),
      { params: Promise.resolve({ id: firstPayload.data.sale.id }) },
    );
    expect(detail.status).toBe(200);
    const detailPayload = (await detail.json()) as {
      data: { clientTxnId?: string };
    };
    expect(detailPayload.data.clientTxnId).toBeUndefined();

    const list = await listSales(
      jsonRequest("http://localhost/api/sales", "GET"),
    );
    expect(list.status).toBe(200);
  });

  it("rejects underpayment and discount above cashier cap", async () => {
    await attachSession("caisse@dubai-phone.local");
    const cable = await prisma.productVariant.findFirstOrThrow({
      where: {
        deletedAt: null,
        quantityOnHand: { gt: 0 },
        product: { isSerialized: false, status: "ACTIVE" },
      },
    });
    const unitPrice = Number(cable.sellingPriceXaf);

    const under = await createSale(
      jsonRequest("http://localhost/api/sales", "POST", {
        clientTxnId: randomUUID(),
        kind: "IMMEDIATE",
        items: [{ variantId: cable.id, quantity: 1 }],
        payments: [
          {
            method: "CASH",
            amountXaf: Math.max(1, unitPrice - 1),
            idempotencyKey: `under-${randomBytes(3).toString("hex")}`,
          },
        ],
      }),
    );
    expect(under.status).toBe(422);

    const tooMuchDiscount = await createSale(
      jsonRequest("http://localhost/api/sales", "POST", {
        clientTxnId: randomUUID(),
        kind: "IMMEDIATE",
        items: [{ variantId: cable.id, quantity: 1 }],
        discountTotalXaf: Math.floor(unitPrice * 0.2),
        payments: [
          {
            method: "CASH",
            amountXaf: unitPrice - Math.floor(unitPrice * 0.2),
            idempotencyKey: `disc-${randomBytes(3).toString("hex")}`,
          },
        ],
      }),
    );
    expect(tooMuchDiscount.status).toBe(403);
  });

  it("completes an installment sale with customer and credit schedule", async () => {
    await attachSession("caisse@dubai-phone.local");
    const cable = await prisma.productVariant.findFirstOrThrow({
      where: {
        deletedAt: null,
        quantityOnHand: { gt: 0 },
        product: { isSerialized: false, status: "ACTIVE" },
      },
    });
    const customer = await prisma.customer.findFirstOrThrow({
      where: { deletedAt: null },
    });
    const clientTxnId = randomUUID();
    const total = Number(cable.sellingPriceXaf);
    const down = Math.max(1, Math.floor(total * 0.2));

    const response = await createSale(
      jsonRequest("http://localhost/api/sales", "POST", {
        clientTxnId,
        kind: "INSTALLMENT",
        customerId: customer.id,
        items: [{ variantId: cable.id, quantity: 1 }],
        payments: [
          {
            method: "ORANGE_MONEY",
            amountXaf: down,
            idempotencyKey: `down-${clientTxnId}`,
            operatorReference: "OM-TEST-001",
          },
        ],
        installmentPlan: {
          installmentCount: 2,
          intervalDays: 30,
        },
      }),
    );
    expect(response.status).toBe(201);
    const payload = (await response.json()) as {
      data: {
        sale: {
          id: string;
          kind: string;
          creditReference: string | null;
        };
      };
    };
    expect(payload.data.sale.kind).toBe("INSTALLMENT");
    expect(payload.data.sale.creditReference).toBeTruthy();

    const credit = await prisma.customerCredit.findUniqueOrThrow({
      where: { saleId: payload.data.sale.id },
      include: { installments: true },
    });
    expect(credit.remainingXaf).toBe(xaf(total - down));
    expect(credit.status).toBe("PARTIALLY_PAID");
    expect(credit.installments).toHaveLength(2);
  });

  it("sells a serialized device once and rejects the second sale", async () => {
    await attachSession("caisse@dubai-phone.local");
    const serial = await prisma.productSerial.findFirstOrThrow({
      where: { status: "IN_STOCK" },
      include: { variant: true },
    });
    const price = Number(serial.variant.sellingPriceXaf);
    const firstTxn = randomUUID();
    const first = await createSale(
      jsonRequest("http://localhost/api/sales", "POST", {
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
            idempotencyKey: `ser-${firstTxn}`,
          },
        ],
      }),
    );
    expect(first.status).toBe(201);

    const second = await createSale(
      jsonRequest("http://localhost/api/sales", "POST", {
        clientTxnId: randomUUID(),
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
            idempotencyKey: `ser2-${randomBytes(3).toString("hex")}`,
          },
        ],
      }),
    );
    expect(second.status).toBe(422);

    const updated = await prisma.productSerial.findUniqueOrThrow({
      where: { id: serial.id },
    });
    expect(updated.status).toBe("SOLD");
  });

  it("rejects concurrent double-sell of the same IMEI", async () => {
    await attachSession("caisse@dubai-phone.local");
    const serial = await prisma.productSerial.findFirstOrThrow({
      where: { status: "IN_STOCK" },
      include: { variant: true },
    });
    const price = Number(serial.variant.sellingPriceXaf);
    const bodyA = {
      clientTxnId: randomUUID(),
      kind: "IMMEDIATE" as const,
      items: [
        {
          variantId: serial.variantId,
          quantity: 1,
          productSerialId: serial.id,
        },
      ],
      payments: [
        {
          method: "CASH" as const,
          amountXaf: price,
          idempotencyKey: `race-a-${randomBytes(4).toString("hex")}`,
        },
      ],
    };
    const bodyB = {
      clientTxnId: randomUUID(),
      kind: "IMMEDIATE" as const,
      items: [
        {
          variantId: serial.variantId,
          quantity: 1,
          productSerialId: serial.id,
        },
      ],
      payments: [
        {
          method: "CASH" as const,
          amountXaf: price,
          idempotencyKey: `race-b-${randomBytes(4).toString("hex")}`,
        },
      ],
    };

    const [a, b] = await Promise.all([
      createSale(jsonRequest("http://localhost/api/sales", "POST", bodyA)),
      createSale(jsonRequest("http://localhost/api/sales", "POST", bodyB)),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 422]);

    const saleMoves = await prisma.stockMovement.count({
      where: { productSerialId: serial.id, type: "SALE" },
    });
    expect(saleMoves).toBe(1);
  });

  it("searches catalog for cashier", async () => {
    await attachSession("caisse@dubai-phone.local");
    const variant = await prisma.productVariant.findFirstOrThrow({
      where: { deletedAt: null, status: "ACTIVE" },
    });
    const response = await searchCatalog(
      jsonRequest(
        `http://localhost/api/sales/catalog?q=${encodeURIComponent(variant.sku.slice(0, 4))}`,
        "GET",
      ),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: { items: Array<{ sku: string }> };
    };
    expect(payload.data.items.length).toBeGreaterThan(0);
  });

  it("rejects installment without customer and MoMo without operator ref", async () => {
    await attachSession("caisse@dubai-phone.local");
    const cable = await prisma.productVariant.findFirstOrThrow({
      where: {
        deletedAt: null,
        quantityOnHand: { gt: 0 },
        product: { isSerialized: false, status: "ACTIVE" },
      },
    });
    const response = await createSale(
      jsonRequest("http://localhost/api/sales", "POST", {
        clientTxnId: randomUUID(),
        kind: "INSTALLMENT",
        items: [{ variantId: cable.id, quantity: 1 }],
        payments: [
          {
            method: "CASH",
            amountXaf: Math.floor(Number(cable.sellingPriceXaf) / 2),
            idempotencyKey: `nocust-${randomBytes(3).toString("hex")}`,
          },
        ],
        installmentPlan: { installmentCount: 2 },
      }),
    );
    expect(response.status).toBe(422);

    const momo = await createSale(
      jsonRequest("http://localhost/api/sales", "POST", {
        clientTxnId: randomUUID(),
        kind: "IMMEDIATE",
        items: [{ variantId: cable.id, quantity: 1 }],
        payments: [
          {
            method: "MTN_MOBILE_MONEY",
            amountXaf: Number(cable.sellingPriceXaf),
            idempotencyKey: `momo-${randomBytes(3).toString("hex")}`,
          },
        ],
      }),
    );
    expect(momo.status).toBe(400);
  });
});
