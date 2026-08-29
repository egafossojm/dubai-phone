/**
 * @vitest-environment node
 */
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { xaf } from "@/lib/money";
import { requireDatabaseForIntegration } from "@/lib/test/database-available";

const databaseAvailable = await requireDatabaseForIntegration();

describe.skipIf(!databaseAvailable)("database constraints", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects a duplicate SKU", async () => {
    await expect(
      prisma.productVariant.create({
        data: {
          productId: "44444444-4444-4444-8444-444444444444",
          sku: "SAM-A16-128-BLK",
          name: "Duplicate",
          sellingPriceXaf: xaf(1),
        },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it("rejects a duplicate IMEI", async () => {
    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { sku: "SAM-A16-128-BLK" },
    });

    await expect(
      prisma.productSerial.create({
        data: {
          variantId: variant.id,
          imei1: "350000000000001",
          serialNumber: "SN-DUP-SHOULD-FAIL",
        },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it("rejects a duplicate sale clientTxnId (idempotency)", async () => {
    const cashier = await prisma.user.findUniqueOrThrow({
      where: { email: "caisse@dubai-phone.local" },
    });
    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { sku: "CBL-USBC-1M" },
    });

    await expect(
      prisma.sale.create({
        data: {
          reference: "V-SHOULD-FAIL-DUP",
          clientTxnId: "seed-sale-cash-000001",
          soldById: cashier.id,
          totalXaf: xaf(1),
          items: {
            create: {
              variantId: variant.id,
              quantity: 1,
              unitPriceXaf: xaf(1),
              lineTotalXaf: xaf(1),
            },
          },
        },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it("rejects a second PURCHASE_RECEIPT for the same non-serialized GR line", async () => {
    const existing = await prisma.stockMovement.findFirstOrThrow({
      where: {
        type: "PURCHASE_RECEIPT",
        productSerialId: null,
        goodsReceiptItemId: { not: null },
      },
    });

    await expect(
      prisma.stockMovement.create({
        data: {
          type: "PURCHASE_RECEIPT",
          variantId: existing.variantId,
          quantity: 1,
          goodsReceiptItemId: existing.goodsReceiptItemId,
          recordedById: existing.recordedById,
        },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it("keeps stock cache aligned with movement balance for seeded cable", async () => {
    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { sku: "CBL-USBC-1M" },
    });
    const aggregate = await prisma.stockMovement.aggregate({
      where: { variantId: variant.id },
      _sum: { quantity: true },
    });
    expect(aggregate._sum.quantity).toBe(variant.quantityOnHand);
  });

  it("does not expose updatedAt on audit logs", async () => {
    const log = await prisma.auditLog.findFirstOrThrow({
      where: { action: "sale.complete" },
    });
    expect(log.createdAt).toBeInstanceOf(Date);
    expect("updatedAt" in log).toBe(false);
  });
});
