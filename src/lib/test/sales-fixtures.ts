import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

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
  if (row.quantityOnHand < minimum) {
    await prisma.productVariant.update({
      where: { id: variantId },
      data: { quantityOnHand: minimum },
    });
  }
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
    select: { id: true },
  });
  if (!variant) {
    return null;
  }
  const suffix = randomBytes(4).toString("hex");
  const imei = `3599${suffix}000001`.slice(0, 15);
  const serial = await prisma.productSerial.create({
    data: {
      variantId: variant.id,
      imei1: imei,
      serialNumber: `TST-${suffix}`,
      status: "IN_STOCK",
    },
    include: { variant: true },
  });
  await prisma.productVariant.update({
    where: { id: variant.id },
    data: { quantityOnHand: { increment: 1 } },
  });
  return serial;
}

export function uniqueTestPhone() {
  const suffix = randomBytes(4).readUInt32BE(0) % 100_000_000;
  return `6${String(suffix).padStart(8, "0")}`;
}
