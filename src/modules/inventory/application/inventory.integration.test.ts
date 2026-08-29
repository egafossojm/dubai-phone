/**
 * @vitest-environment node
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createSessionToken, hashSessionToken } from "@/lib/auth/session-token";
import { requireDatabaseForIntegration } from "@/lib/test/database-available";
import { GET as getInventory } from "@/app/api/inventory/route";
import { GET as getInventoryDetail } from "@/app/api/inventory/[variantId]/route";
import { POST as adjustInventory } from "@/app/api/inventory/adjust/route";
import { GET as getMovements } from "@/app/api/inventory/movements/route";
import { GET as getSerials } from "@/app/api/inventory/serials/route";
import { GET as lookupSerial } from "@/app/api/inventory/serials/lookup/route";
import {
  recordSaleDeduction,
  reserveSerializedDevice,
  releaseSerializedReservation,
  recordManualAdjustment,
} from "@/modules/inventory/application/operations";
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

describe.skipIf(!databaseAvailable)("inventory domain", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    cookieJar.token = undefined;
    await prisma.$disconnect();
  });

  it("lists inventory for a salesperson", async () => {
    await attachSession("caisse@dubai-phone.local");
    const response = await getInventory(
      jsonRequest("http://localhost/api/inventory", "GET"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: { items: Array<{ sku: string; quantityOnHand: number }> };
    };
    expect(payload.data.items.length).toBeGreaterThan(0);
  });

  it("forbids a salesperson from adjusting stock", async () => {
    await attachSession("caisse@dubai-phone.local");
    const cable = await prisma.productVariant.findUniqueOrThrow({
      where: { sku: "CBL-USBC-1M" },
    });
    const response = await adjustInventory(
      jsonRequest("http://localhost/api/inventory/adjust", "POST", {
        variantId: cable.id,
        quantity: -1,
        reason: "test interdit",
      }),
    );
    expect(response.status).toBe(403);
  });

  it("adjusts non-serialized stock with reason and audit", async () => {
    const stockUser = await attachSession("stock@dubai-phone.local");
    const cable = await prisma.productVariant.findUniqueOrThrow({
      where: { sku: "CBL-USBC-1M" },
    });
    const beforeQty = cable.quantityOnHand;
    const movementsBefore = await prisma.stockMovement.count({
      where: { variantId: cable.id },
    });

    const response = await adjustInventory(
      jsonRequest("http://localhost/api/inventory/adjust", "POST", {
        variantId: cable.id,
        quantity: 1,
        type: "STOCK_ADJUSTMENT",
        reason: "Inventaire physique — écart câbles",
      }),
    );
    expect(response.status).toBe(201);

    const updated = await prisma.productVariant.findUniqueOrThrow({
      where: { id: cable.id },
    });
    expect(updated.quantityOnHand).toBe(beforeQty + 1);

    const movementsAfter = await prisma.stockMovement.count({
      where: { variantId: cable.id },
    });
    expect(movementsAfter).toBe(movementsBefore + 1);

    const sum = await prisma.$transaction((tx) =>
      sumMovementsForVariant(tx, cable.id),
    );
    expect(sum).toBe(updated.quantityOnHand);

    const audit = await prisma.auditLog.findFirst({
      where: {
        actorId: stockUser.id,
        action: "inventory.adjust",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
  });

  it("rejects adjustment without reason", async () => {
    await attachSession("stock@dubai-phone.local");
    const cable = await prisma.productVariant.findUniqueOrThrow({
      where: { sku: "CBL-USBC-1M" },
    });
    const response = await adjustInventory(
      jsonRequest("http://localhost/api/inventory/adjust", "POST", {
        variantId: cable.id,
        quantity: -1,
        reason: "x",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("prevents negative stock", async () => {
    await attachSession("stock@dubai-phone.local");
    const cable = await prisma.productVariant.findUniqueOrThrow({
      where: { sku: "CBL-USBC-1M" },
    });
    const response = await adjustInventory(
      jsonRequest("http://localhost/api/inventory/adjust", "POST", {
        variantId: cable.id,
        quantity: -(cable.quantityOnHand + 50),
        reason: "Tentative stock négatif",
      }),
    );
    expect(response.status).toBe(422);
  });

  it("keeps cache consistent after inbound and sale movements", async () => {
    const stockUser = await prisma.user.findUniqueOrThrow({
      where: { email: "stock@dubai-phone.local" },
    });
    const suffix = randomBytes(3).toString("hex").toUpperCase();
    const brand = await prisma.brand.findFirstOrThrow();
    const category = await prisma.category.findFirstOrThrow();

    const product = await prisma.product.create({
      data: {
        name: `Test Inv ${suffix}`,
        brandId: brand.id,
        categoryId: category.id,
        isSerialized: false,
        status: "ACTIVE",
        variants: {
          create: {
            sku: `TST-INV-${suffix}`,
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

    await prisma.$transaction(async (tx) => {
      const { applyStockMovement } = await import(
        "@/modules/inventory/application/apply-movement"
      );
      await applyStockMovement(tx, {
        type: "PURCHASE_RECEIPT",
        variantId,
        quantity: 5,
        recordedById: stockUser.id,
        reason: "test inbound",
      });
      await applyStockMovement(tx, {
        type: "SALE",
        variantId,
        quantity: -2,
        recordedById: stockUser.id,
        reason: "test sale",
      });
    });

    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    expect(variant.quantityOnHand).toBe(3);

    const sum = await prisma.$transaction((tx) =>
      sumMovementsForVariant(tx, variantId),
    );
    expect(sum).toBe(3);
  });

  it("rejects a second stock movement for the same sale line", async () => {
    const stockUser = await prisma.user.findUniqueOrThrow({
      where: { email: "stock@dubai-phone.local" },
    });
    const suffix = randomBytes(3).toString("hex").toUpperCase();
    const brand = await prisma.brand.findFirstOrThrow();
    const category = await prisma.category.findFirstOrThrow();
    const product = await prisma.product.create({
      data: {
        name: `Dup Sale ${suffix}`,
        brandId: brand.id,
        categoryId: category.id,
        isSerialized: false,
        status: "ACTIVE",
        variants: {
          create: {
            sku: `DUP-SALE-${suffix}`,
            name: "Std",
            sellingPriceXaf: 3500,
            costPriceXaf: 1000,
            quantityOnHand: 0,
          },
        },
      },
      include: { variants: true },
    });
    const variantId = product.variants[0]!.id;

    await prisma.$transaction(async (tx) => {
      const { applyStockMovement } = await import(
        "@/modules/inventory/application/apply-movement"
      );
      await applyStockMovement(tx, {
        type: "PURCHASE_RECEIPT",
        variantId,
        quantity: 2,
        recordedById: stockUser.id,
        reason: "stock for duplicate sale-line test",
      });
    });

    const sale = await prisma.sale.create({
      data: {
        reference: `SALE-TEST-${suffix}`,
        clientTxnId: `client-txn-${suffix}`,
        kind: "IMMEDIATE",
        status: "COMPLETED",
        soldById: stockUser.id,
        subtotalXaf: 3500,
        totalXaf: 3500,
        completedAt: new Date(),
        items: {
          create: {
            variantId,
            quantity: 1,
            unitPriceXaf: 3500,
            lineTotalXaf: 3500,
          },
        },
      },
      include: { items: true },
    });
    const saleItemId = sale.items[0]!.id;

    await recordSaleDeduction(stockUser.id, [
      {
        variantId,
        quantity: 1,
        saleId: sale.id,
        saleItemId,
      },
    ]);

    await expect(
      recordSaleDeduction(stockUser.id, [
        {
          variantId,
          quantity: 1,
          saleId: sale.id,
          saleItemId,
        },
      ]),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects a second non-serialized purchase receipt on the same GR line", async () => {
    const stockUser = await prisma.user.findUniqueOrThrow({
      where: { email: "stock@dubai-phone.local" },
    });
    const existing = await prisma.stockMovement.findFirstOrThrow({
      where: {
        type: "PURCHASE_RECEIPT",
        productSerialId: null,
        goodsReceiptItemId: { not: null },
      },
    });

    const { applyStockMovement } = await import(
      "@/modules/inventory/application/apply-movement"
    );

    await expect(
      prisma.$transaction((tx) =>
        applyStockMovement(tx, {
          type: "PURCHASE_RECEIPT",
          variantId: existing.variantId,
          quantity: 1,
          goodsReceiptItemId: existing.goodsReceiptItemId,
          recordedById: stockUser.id,
        }),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects duplicate serialized devices on receipt", async () => {
    const phone = await prisma.productVariant.findUniqueOrThrow({
      where: { sku: "SAM-A16-128-BLK" },
    });

    await expect(
      prisma.productSerial.create({
        data: {
          variantId: phone.id,
          imei1: "350000000000001",
          serialNumber: `SN-DUP-${randomBytes(2).toString("hex")}`,
          status: "IN_STOCK",
        },
      }),
    ).rejects.toThrow();
  });

  it("reserves and releases a serialized device without changing quantity", async () => {
    const stockUser = await prisma.user.findUniqueOrThrow({
      where: { email: "stock@dubai-phone.local" },
    });
    const serial = await prisma.productSerial.findFirstOrThrow({
      where: { status: "IN_STOCK", imei1: { not: null } },
    });
    const before = await prisma.productVariant.findUniqueOrThrow({
      where: { id: serial.variantId },
    });

    await reserveSerializedDevice(stockUser.id, serial.id);
    const reserved = await prisma.productSerial.findUniqueOrThrow({
      where: { id: serial.id },
    });
    expect(reserved.status).toBe("RESERVED");

    const mid = await prisma.productVariant.findUniqueOrThrow({
      where: { id: serial.variantId },
    });
    expect(mid.quantityOnHand).toBe(before.quantityOnHand);

    await releaseSerializedReservation(stockUser.id, serial.id);
    const released = await prisma.productSerial.findUniqueOrThrow({
      where: { id: serial.id },
    });
    expect(released.status).toBe("IN_STOCK");
  });

  it("exposes movement history and IMEI lookup", async () => {
    await attachSession("stock@dubai-phone.local");
    const movements = await getMovements(
      jsonRequest("http://localhost/api/inventory/movements", "GET"),
    );
    expect(movements.status).toBe(200);

    const serials = await getSerials(
      jsonRequest("http://localhost/api/inventory/serials", "GET"),
    );
    expect(serials.status).toBe(200);

    const lookup = await lookupSerial(
      jsonRequest(
        "http://localhost/api/inventory/serials/lookup?q=350000000000001",
        "GET",
      ),
    );
    expect(lookup.status).toBe(200);
    const payload = (await lookup.json()) as {
      data: { imei1: string; movements: unknown[] };
    };
    expect(payload.data.imei1).toBe("350000000000001");
    expect(payload.data.movements.length).toBeGreaterThan(0);

    const phone = await prisma.productVariant.findUniqueOrThrow({
      where: { sku: "SAM-A16-128-BLK" },
    });
    const detail = await getInventoryDetail(
      jsonRequest(`http://localhost/api/inventory/${phone.id}`, "GET"),
      { params: Promise.resolve({ variantId: phone.id }) },
    );
    expect(detail.status).toBe(200);
  });

  it("requires a serial for serialized adjustments", async () => {
    const stockUser = await prisma.user.findUniqueOrThrow({
      where: { email: "stock@dubai-phone.local" },
    });
    const phone = await prisma.productVariant.findUniqueOrThrow({
      where: { sku: "SAM-A16-128-BLK" },
    });
    await expect(
      recordManualAdjustment(stockUser.id, {
        variantId: phone.id,
        quantity: -1,
        reason: "Manque IMEI",
      }),
    ).rejects.toMatchObject({ code: "BUSINESS_RULE_ERROR" });
  });
});
