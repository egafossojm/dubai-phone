/**
 * @vitest-environment node
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createSessionToken, hashSessionToken } from "@/lib/auth/session-token";
import { requireDatabaseForIntegration } from "@/lib/test/database-available";
import { POST as createPurchase } from "@/app/api/purchases/route";
import { POST as receivePurchase } from "@/app/api/purchases/receive/route";
import { GET as getPurchase, DELETE as cancelPurchase } from "@/app/api/purchases/[id]/route";
import { POST as closePurchase } from "@/app/api/purchases/[id]/close/route";
import { POST as createSupplier } from "@/app/api/suppliers/route";
import { sumMovementsForVariant } from "@/modules/inventory/application/apply-movement";

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

describe.skipIf(!databaseAvailable)("purchases receiving", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    cookieJar.token = undefined;
    await prisma.$disconnect();
  });

  it("forbids a salesperson from receiving purchases", async () => {
    await attachSession("caisse@dubai-phone.local");
    const response = await receivePurchase(
      jsonRequest("http://localhost/api/purchases/receive", "POST", {
        purchaseOrderId: "00000000-0000-4000-8000-000000000001",
        idempotencyKey: "forbid-cashier-recv",
        lines: [
          {
            purchaseOrderItemId: "00000000-0000-4000-8000-000000000002",
            quantityReceived: 1,
          },
        ],
      }),
    );
    expect(response.status).toBe(403);
  });

  it("supports partial then complete receiving for non-serialized stock", async () => {
    await attachSession("stock@dubai-phone.local");
    const suffix = randomBytes(3).toString("hex").toUpperCase();
    const brand = await prisma.brand.findFirstOrThrow();
    const category = await prisma.category.findFirstOrThrow();
    const supplier = await prisma.supplier.findFirstOrThrow({
      where: { deletedAt: null },
    });

    const product = await prisma.product.create({
      data: {
        name: `Achat Test ${suffix}`,
        brandId: brand.id,
        categoryId: category.id,
        isSerialized: false,
        status: "ACTIVE",
        variants: {
          create: {
            sku: `PO-TEST-${suffix}`,
            name: "Std",
            sellingPriceXaf: 8000,
            costPriceXaf: 4000,
            quantityOnHand: 0,
          },
        },
      },
      include: { variants: true },
    });
    const variantId = product.variants[0]!.id;

    const created = await createPurchase(
      jsonRequest("http://localhost/api/purchases", "POST", {
        supplierId: supplier.id,
        submit: true,
        items: [
          {
            variantId,
            quantityOrdered: 5,
            unitCostXaf: 4000,
          },
        ],
      }),
    );
    expect(created.status).toBe(201);
    const createdPayload = (await created.json()) as {
      data: { id: string; items: Array<{ id: string }> };
    };
    const orderId = createdPayload.data.id;
    const itemId = createdPayload.data.items[0]!.id;

    const partial = await receivePurchase(
      jsonRequest("http://localhost/api/purchases/receive", "POST", {
        purchaseOrderId: orderId,
        idempotencyKey: `partial-${suffix}`,
        lines: [{ purchaseOrderItemId: itemId, quantityReceived: 2 }],
      }),
    );
    expect(partial.status).toBe(201);
    const afterPartial = await getPurchase(
      jsonRequest(`http://localhost/api/purchases/${orderId}`, "GET"),
      { params: Promise.resolve({ id: orderId }) },
    );
    const partialPayload = (await afterPartial.json()) as {
      data: { status: string; items: Array<{ quantityReceived: number }> };
    };
    expect(partialPayload.data.status).toBe("PARTIALLY_RECEIVED");
    expect(partialPayload.data.items[0]!.quantityReceived).toBe(2);

    let variant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(variant.quantityOnHand).toBe(2);

    const complete = await receivePurchase(
      jsonRequest("http://localhost/api/purchases/receive", "POST", {
        purchaseOrderId: orderId,
        idempotencyKey: `complete-${suffix}`,
        lines: [{ purchaseOrderItemId: itemId, quantityReceived: 3 }],
      }),
    );
    expect(complete.status).toBe(201);

    const afterComplete = await getPurchase(
      jsonRequest(`http://localhost/api/purchases/${orderId}`, "GET"),
      { params: Promise.resolve({ id: orderId }) },
    );
    const completePayload = (await afterComplete.json()) as {
      data: { status: string; items: Array<{ quantityReceived: number }> };
    };
    expect(completePayload.data.status).toBe("RECEIVED");
    expect(completePayload.data.items[0]!.quantityReceived).toBe(5);

    variant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(variant.quantityOnHand).toBe(5);
    const sum = await prisma.$transaction((tx) =>
      sumMovementsForVariant(tx, variantId),
    );
    expect(sum).toBe(5);

    const over = await receivePurchase(
      jsonRequest("http://localhost/api/purchases/receive", "POST", {
        purchaseOrderId: orderId,
        idempotencyKey: `over-${suffix}`,
        lines: [{ purchaseOrderItemId: itemId, quantityReceived: 1 }],
      }),
    );
    expect(over.status).toBe(422);
  });

  it("receives serialized units with IMEI and rejects duplicates", async () => {
    await attachSession("stock@dubai-phone.local");
    const suffix = randomBytes(3).toString("hex").toUpperCase();
    const brand = await prisma.brand.findFirstOrThrow();
    const category = await prisma.category.findFirstOrThrow();
    const supplier = await prisma.supplier.findFirstOrThrow({
      where: { deletedAt: null },
    });
    const digits = String(Date.now()).slice(-11);
    const imei = `359${digits}`; // 14 digits

    const product = await prisma.product.create({
      data: {
        name: `Phone Rec ${suffix}`,
        brandId: brand.id,
        categoryId: category.id,
        isSerialized: true,
        status: "ACTIVE",
        variants: {
          create: {
            sku: `PH-REC-${suffix}`,
            name: "Noir",
            sellingPriceXaf: 150000,
            costPriceXaf: 110000,
            warrantyMonths: 12,
            quantityOnHand: 0,
          },
        },
      },
      include: { variants: true },
    });
    const variantId = product.variants[0]!.id;

    const created = await createPurchase(
      jsonRequest("http://localhost/api/purchases", "POST", {
        supplierId: supplier.id,
        submit: true,
        items: [{ variantId, quantityOrdered: 1, unitCostXaf: 110000 }],
      }),
    );
    const createdPayload = (await created.json()) as {
      data: { id: string; items: Array<{ id: string }> };
    };
    const orderId = createdPayload.data.id;
    const itemId = createdPayload.data.items[0]!.id;

    const received = await receivePurchase(
      jsonRequest("http://localhost/api/purchases/receive", "POST", {
        purchaseOrderId: orderId,
        idempotencyKey: `serial-recv-${suffix}`,
        lines: [
          {
            purchaseOrderItemId: itemId,
            quantityReceived: 1,
            serials: [{ imei1: imei, serialNumber: `SN-${suffix}` }],
          },
        ],
      }),
    );
    expect(received.status).toBe(201);

    const serial = await prisma.productSerial.findUnique({ where: { imei1: imei } });
    expect(serial?.status).toBe("IN_STOCK");

    const secondOrder = await createPurchase(
      jsonRequest("http://localhost/api/purchases", "POST", {
        supplierId: supplier.id,
        submit: true,
        items: [{ variantId, quantityOrdered: 1, unitCostXaf: 110000 }],
      }),
    );
    const secondPayload = (await secondOrder.json()) as {
      data: { id: string; items: Array<{ id: string }> };
    };
    const dup = await receivePurchase(
      jsonRequest("http://localhost/api/purchases/receive", "POST", {
        purchaseOrderId: secondPayload.data.id,
        idempotencyKey: `serial-dup-${suffix}`,
        lines: [
          {
            purchaseOrderItemId: secondPayload.data.items[0]!.id,
            quantityReceived: 1,
            serials: [{ imei1: imei, serialNumber: `SN-DUP-${suffix}` }],
          },
        ],
      }),
    );
    expect(dup.status).toBe(409);
  });

  it("marks damaged serials as DAMAGED and not sellable", async () => {
    await attachSession("stock@dubai-phone.local");
    const suffix = randomBytes(3).toString("hex").toUpperCase();
    const brand = await prisma.brand.findFirstOrThrow();
    const category = await prisma.category.findFirstOrThrow();
    const supplier = await prisma.supplier.findFirstOrThrow({
      where: { deletedAt: null },
    });
    const imei = `358${String(Date.now()).slice(-11)}`;

    const product = await prisma.product.create({
      data: {
        name: `Phone Dmg ${suffix}`,
        brandId: brand.id,
        categoryId: category.id,
        isSerialized: true,
        status: "ACTIVE",
        variants: {
          create: {
            sku: `PH-DMG-${suffix}`,
            name: "Noir",
            sellingPriceXaf: 150000,
            costPriceXaf: 110000,
            quantityOnHand: 0,
          },
        },
      },
      include: { variants: true },
    });
    const variantId = product.variants[0]!.id;

    const created = await createPurchase(
      jsonRequest("http://localhost/api/purchases", "POST", {
        supplierId: supplier.id,
        submit: true,
        items: [{ variantId, quantityOrdered: 1, unitCostXaf: 110000 }],
      }),
    );
    const createdPayload = (await created.json()) as {
      data: { id: string; items: Array<{ id: string }> };
    };

    const received = await receivePurchase(
      jsonRequest("http://localhost/api/purchases/receive", "POST", {
        purchaseOrderId: createdPayload.data.id,
        idempotencyKey: `dmg-recv-${suffix}`,
        lines: [
          {
            purchaseOrderItemId: createdPayload.data.items[0]!.id,
            quantityReceived: 1,
            serials: [
              {
                imei1: imei,
                serialNumber: `SN-DMG-${suffix}`,
                condition: "DAMAGED",
              },
            ],
          },
        ],
      }),
    );
    expect(received.status).toBe(201);

    const serial = await prisma.productSerial.findUnique({ where: { imei1: imei } });
    expect(serial?.status).toBe("DAMAGED");
    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(variant.quantityOnHand).toBe(0);
    const movements = await prisma.stockMovement.findMany({
      where: { variantId },
      orderBy: { createdAt: "asc" },
    });
    expect(movements.map((row) => [row.type, row.quantity])).toEqual([
      ["PURCHASE_RECEIPT", 1],
      ["DAMAGED", -1],
    ]);
  });

  it("creates a supplier", async () => {
    await attachSession("stock@dubai-phone.local");
    const suffix = randomBytes(2).toString("hex");
    const response = await createSupplier(
      jsonRequest("http://localhost/api/suppliers", "POST", {
        name: `Fournisseur ${suffix}`,
        phone: `67${suffix}001`,
      }),
    );
    expect(response.status).toBe(201);

    const payload = (await response.json()) as {
      data: { id: string; name: string };
    };
    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "supplier.create",
        entityId: payload.data.id,
      },
    });
    expect(audit).not.toBeNull();
  });

  it("forbids a salesperson from creating a supplier", async () => {
    await attachSession("caisse@dubai-phone.local");
    const response = await createSupplier(
      jsonRequest("http://localhost/api/suppliers", "POST", {
        name: "Interdit Caisse",
      }),
    );
    expect(response.status).toBe(403);
  });

  it("replays the same receive idempotency key without double stock", async () => {
    await attachSession("stock@dubai-phone.local");
    const suffix = randomBytes(3).toString("hex").toUpperCase();
    const brand = await prisma.brand.findFirstOrThrow();
    const category = await prisma.category.findFirstOrThrow();
    const supplier = await prisma.supplier.findFirstOrThrow({
      where: { deletedAt: null },
    });
    const product = await prisma.product.create({
      data: {
        name: `Idem Rec ${suffix}`,
        brandId: brand.id,
        categoryId: category.id,
        isSerialized: false,
        status: "ACTIVE",
        variants: {
          create: {
            sku: `IDEM-${suffix}`,
            name: "Std",
            sellingPriceXaf: 5000,
            costPriceXaf: 2000,
            quantityOnHand: 0,
          },
        },
      },
      include: { variants: true },
    });
    const variantId = product.variants[0]!.id;
    const created = await createPurchase(
      jsonRequest("http://localhost/api/purchases", "POST", {
        supplierId: supplier.id,
        submit: true,
        items: [{ variantId, quantityOrdered: 4, unitCostXaf: 2000 }],
      }),
    );
    const createdPayload = (await created.json()) as {
      data: { id: string; items: Array<{ id: string }> };
    };
    const body = {
      purchaseOrderId: createdPayload.data.id,
      idempotencyKey: `idem-recv-${suffix}`,
      lines: [
        {
          purchaseOrderItemId: createdPayload.data.items[0]!.id,
          quantityReceived: 2,
        },
      ],
    };

    const first = await receivePurchase(
      jsonRequest("http://localhost/api/purchases/receive", "POST", body),
    );
    expect(first.status).toBe(201);
    const firstPayload = (await first.json()) as {
      data: { receiptId: string; replayed: boolean };
    };
    expect(firstPayload.data.replayed).toBe(false);

    const second = await receivePurchase(
      jsonRequest("http://localhost/api/purchases/receive", "POST", body),
    );
    expect(second.status).toBe(201);
    const secondPayload = (await second.json()) as {
      data: { receiptId: string; replayed: boolean };
    };
    expect(secondPayload.data.replayed).toBe(true);
    expect(secondPayload.data.receiptId).toBe(firstPayload.data.receiptId);

    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(variant.quantityOnHand).toBe(2);
  });

  it("forbids cancel after partial receive and allows closing remainder", async () => {
    await attachSession("stock@dubai-phone.local");
    const suffix = randomBytes(3).toString("hex").toUpperCase();
    const brand = await prisma.brand.findFirstOrThrow();
    const category = await prisma.category.findFirstOrThrow();
    const supplier = await prisma.supplier.findFirstOrThrow({
      where: { deletedAt: null },
    });
    const product = await prisma.product.create({
      data: {
        name: `Close Rem ${suffix}`,
        brandId: brand.id,
        categoryId: category.id,
        isSerialized: false,
        status: "ACTIVE",
        variants: {
          create: {
            sku: `CLOSE-${suffix}`,
            name: "Std",
            sellingPriceXaf: 4000,
            costPriceXaf: 1500,
            quantityOnHand: 0,
          },
        },
      },
      include: { variants: true },
    });
    const variantId = product.variants[0]!.id;
    const created = await createPurchase(
      jsonRequest("http://localhost/api/purchases", "POST", {
        supplierId: supplier.id,
        submit: true,
        items: [{ variantId, quantityOrdered: 5, unitCostXaf: 1500 }],
      }),
    );
    const createdPayload = (await created.json()) as {
      data: { id: string; items: Array<{ id: string }> };
    };
    const orderId = createdPayload.data.id;

    const partial = await receivePurchase(
      jsonRequest("http://localhost/api/purchases/receive", "POST", {
        purchaseOrderId: orderId,
        idempotencyKey: `close-partial-${suffix}`,
        lines: [
          {
            purchaseOrderItemId: createdPayload.data.items[0]!.id,
            quantityReceived: 2,
          },
        ],
      }),
    );
    expect(partial.status).toBe(201);

    const cancel = await cancelPurchase(
      jsonRequest(`http://localhost/api/purchases/${orderId}`, "DELETE"),
      { params: Promise.resolve({ id: orderId }) },
    );
    expect(cancel.status).toBe(422);

    const closed = await closePurchase(
      jsonRequest(`http://localhost/api/purchases/${orderId}/close`, "POST"),
      { params: Promise.resolve({ id: orderId }) },
    );
    expect(closed.status).toBe(200);
    const closedPayload = (await closed.json()) as { data: { status: string } };
    expect(closedPayload.data.status).toBe("CLOSED");
  });

  it("does not cancel a purchase order that received in parallel", async () => {
    await attachSession("stock@dubai-phone.local");
    const suffix = randomBytes(3).toString("hex").toUpperCase();
    const brand = await prisma.brand.findFirstOrThrow();
    const category = await prisma.category.findFirstOrThrow();
    const supplier = await prisma.supplier.findFirstOrThrow({
      where: { deletedAt: null },
    });
    const product = await prisma.product.create({
      data: {
        name: `Race Cancel ${suffix}`,
        brandId: brand.id,
        categoryId: category.id,
        isSerialized: false,
        status: "ACTIVE",
        variants: {
          create: {
            sku: `RACE-${suffix}`,
            name: "Std",
            sellingPriceXaf: 4000,
            costPriceXaf: 1500,
            quantityOnHand: 0,
          },
        },
      },
      include: { variants: true },
    });
    const variantId = product.variants[0]!.id;
    const created = await createPurchase(
      jsonRequest("http://localhost/api/purchases", "POST", {
        supplierId: supplier.id,
        submit: true,
        items: [{ variantId, quantityOrdered: 4, unitCostXaf: 1500 }],
      }),
    );
    const createdPayload = (await created.json()) as {
      data: { id: string; items: Array<{ id: string }> };
    };
    const orderId = createdPayload.data.id;

    const [received, cancelled] = await Promise.all([
      receivePurchase(
        jsonRequest("http://localhost/api/purchases/receive", "POST", {
          purchaseOrderId: orderId,
          idempotencyKey: `race-recv-${suffix}`,
          lines: [
            {
              purchaseOrderItemId: createdPayload.data.items[0]!.id,
              quantityReceived: 2,
            },
          ],
        }),
      ),
      cancelPurchase(
        jsonRequest(`http://localhost/api/purchases/${orderId}`, "DELETE"),
        { params: Promise.resolve({ id: orderId }) },
      ),
    ]);

    const order = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    const postedReceipts = await prisma.goodsReceipt.count({
      where: { purchaseOrderId: orderId, status: "POSTED" },
    });

    if (order.status === "CANCELLED") {
      expect(postedReceipts).toBe(0);
      expect(cancelled.status).toBe(200);
      expect(received.status).not.toBe(201);
    } else {
      expect(["PARTIALLY_RECEIVED", "RECEIVED"]).toContain(order.status);
      expect(postedReceipts).toBeGreaterThan(0);
      expect(received.status).toBe(201);
      expect(cancelled.status).toBe(422);
    }
  });

  it("rejects receive without an idempotency key", async () => {
    await attachSession("stock@dubai-phone.local");
    const response = await receivePurchase(
      jsonRequest("http://localhost/api/purchases/receive", "POST", {
        purchaseOrderId: "00000000-0000-4000-8000-000000000001",
        lines: [
          {
            purchaseOrderItemId: "00000000-0000-4000-8000-000000000002",
            quantityReceived: 1,
          },
        ],
      }),
    );
    expect(response.status).toBe(400);
  });

  it("does not submit a purchase order cancelled in parallel", async () => {
    await attachSession("stock@dubai-phone.local");
    const suffix = randomBytes(3).toString("hex").toUpperCase();
    const brand = await prisma.brand.findFirstOrThrow();
    const category = await prisma.category.findFirstOrThrow();
    const supplier = await prisma.supplier.findFirstOrThrow({
      where: { deletedAt: null },
    });
    const product = await prisma.product.create({
      data: {
        name: `Race Submit ${suffix}`,
        brandId: brand.id,
        categoryId: category.id,
        isSerialized: false,
        status: "ACTIVE",
        variants: {
          create: {
            sku: `RSUB-${suffix}`,
            name: "Std",
            sellingPriceXaf: 4000,
            costPriceXaf: 1500,
            quantityOnHand: 0,
          },
        },
      },
      include: { variants: true },
    });
    const created = await createPurchase(
      jsonRequest("http://localhost/api/purchases", "POST", {
        supplierId: supplier.id,
        submit: false,
        items: [
          {
            variantId: product.variants[0]!.id,
            quantityOrdered: 2,
            unitCostXaf: 1500,
          },
        ],
      }),
    );
    const createdPayload = (await created.json()) as { data: { id: string } };
    const orderId = createdPayload.data.id;

    const { POST: submitPurchase } = await import(
      "@/app/api/purchases/[id]/submit/route"
    );

    const [submitted, cancelled] = await Promise.all([
      submitPurchase(
        jsonRequest(`http://localhost/api/purchases/${orderId}/submit`, "POST"),
        { params: Promise.resolve({ id: orderId }) },
      ),
      cancelPurchase(
        jsonRequest(`http://localhost/api/purchases/${orderId}`, "DELETE"),
        { params: Promise.resolve({ id: orderId }) },
      ),
    ]);

    const order = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: orderId },
    });

    expect(["ORDERED", "CANCELLED"]).toContain(order.status);
    if (order.status === "ORDERED") {
      expect(submitted.status).toBe(200);
      expect(cancelled.status).toBe(422);
    } else {
      expect(cancelled.status).toBe(200);
    }
  });
});
