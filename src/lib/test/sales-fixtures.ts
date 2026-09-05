import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { applyStockMovement } from "@/modules/inventory/application/apply-movement";

export async function findInStockSerial() {
  return prisma.productSerial.findFirst({
    where: { status: "IN_STOCK" },
    include: { variant: true },
  });
}

export async function findSellableVariant() {
  return prisma.productVariant.findFirst({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      quantityOnHand: { gt: 0 },
      product: { isSerialized: false, status: "ACTIVE", deletedAt: null },
    },
  });
}

export async function ensureVariantStock(variantId: string, minimum: number) {
  const row = await prisma.productVariant.findUniqueOrThrow({
    where: { id: variantId },
    select: { quantityOnHand: true },
  });
  if (row.quantityOnHand >= minimum) {
    return;
  }
  const delta = minimum - row.quantityOnHand;
  const actor = await prisma.user.findFirstOrThrow({
    where: { email: "caisse@dubai-phone.local" },
    select: { id: true },
  });
  await prisma.$transaction(async (tx) => {
    await applyStockMovement(tx, {
      type: "STOCK_ADJUSTMENT",
      variantId,
      quantity: delta,
      reason: "TEST_ENSURE_STOCK",
      recordedById: actor.id,
      allowNegative: true,
    });
  });
}

/**
 * Allocate a dedicated IN_STOCK serial for integration tests (avoids seed pool exhaustion).
 */
export async function allocateTestSerial() {
  const variant = await prisma.productVariant.findFirst({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      product: { isSerialized: true, status: "ACTIVE", deletedAt: null },
    },
    select: { id: true, quantityOnHand: true },
  });
  if (!variant) {
    return null;
  }
  const actor = await prisma.user.findFirstOrThrow({
    where: { email: "caisse@dubai-phone.local" },
    select: { id: true },
  });
  const suffix = randomBytes(4).toString("hex");
  const imei = `3599${suffix}000001`.slice(0, 15);

  return prisma.$transaction(async (tx) => {
    // Heal polluted negative caches so +1 stock-in can succeed.
    if (variant.quantityOnHand < 0) {
      await applyStockMovement(tx, {
        type: "STOCK_ADJUSTMENT",
        variantId: variant.id,
        quantity: -variant.quantityOnHand,
        reason: "TEST_HEAL_NEGATIVE_STOCK",
        recordedById: actor.id,
        allowNegative: true,
      });
    }

    const serial = await tx.productSerial.create({
      data: {
        variantId: variant.id,
        imei1: imei,
        serialNumber: `TST-${suffix}`,
        status: "LOST",
      },
    });

    await applyStockMovement(tx, {
      type: "STOCK_ADJUSTMENT",
      variantId: variant.id,
      quantity: 1,
      productSerialId: serial.id,
      reason: "TEST_ALLOCATE_SERIAL",
      recordedById: actor.id,
      serialStatusAfter: "IN_STOCK",
    });

    return tx.productSerial.findUniqueOrThrow({
      where: { id: serial.id },
      include: { variant: true },
    });
  });
}

export function uniqueTestPhone() {
  const suffix = randomBytes(4).readUInt32BE(0) % 100_000_000;
  return `6${String(suffix).padStart(8, "0")}`;
}
