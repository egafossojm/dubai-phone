import type { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { formatXaf } from "@/lib/money";
import type { posCatalogQuerySchema } from "@/modules/sales/api/schemas";

type Query = z.infer<typeof posCatalogQuerySchema>;

type CatalogHit = {
  kind: "serial" | "variant";
  variantId: string;
  productSerialId: string | null;
  sku: string;
  name: string;
  sellingPriceXaf: string;
  sellingPriceLabel: string;
  isSerialized: boolean;
  quantityAvailable: number;
  imei1: string | null;
  serialNumber: string | null;
};

/**
 * POS search: product name, SKU, barcode, IMEI, serial number.
 * Serialized variants also return up to a few IN_STOCK units for quick pick.
 */
export async function searchPosCatalogUseCase(query: Query) {
  const q = query.q.trim();
  const limit = query.limit;

  const serialMatches = await prisma.productSerial.findMany({
    where: {
      status: "IN_STOCK",
      OR: [
        { imei1: { equals: q, mode: "insensitive" } },
        { imei2: { equals: q, mode: "insensitive" } },
        { serialNumber: { equals: q, mode: "insensitive" } },
        { imei1: { contains: q, mode: "insensitive" } },
        { serialNumber: { contains: q, mode: "insensitive" } },
      ],
    },
    take: limit,
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              isSerialized: true,
              status: true,
              deletedAt: true,
            },
          },
        },
      },
    },
  });

  const serialHits: CatalogHit[] = serialMatches
    .filter(
      (row) =>
        row.variant.deletedAt === null &&
        row.variant.status === "ACTIVE" &&
        row.variant.product.deletedAt === null &&
        row.variant.product.status === "ACTIVE",
    )
    .map((row) => ({
      kind: "serial" as const,
      variantId: row.variantId,
      productSerialId: row.id,
      sku: row.variant.sku,
      name: `${row.variant.product.name} — ${row.variant.name}`,
      sellingPriceXaf: row.variant.sellingPriceXaf.toString(),
      sellingPriceLabel: formatXaf(row.variant.sellingPriceXaf),
      isSerialized: true,
      quantityAvailable: 1,
      imei1: row.imei1,
      serialNumber: row.serialNumber,
    }));

  const variants = await prisma.productVariant.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      product: { deletedAt: null, status: "ACTIVE" },
      OR: [
        { sku: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { product: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
    take: limit,
    include: {
      product: { select: { name: true, isSerialized: true } },
    },
    orderBy: { sku: "asc" },
  });

  const variantHits: CatalogHit[] = [];
  for (const row of variants) {
    if (row.product.isSerialized) {
      const stockUnits = await prisma.productSerial.findMany({
        where: { variantId: row.id, status: "IN_STOCK" },
        take: 5,
        orderBy: { createdAt: "asc" },
      });
      for (const unit of stockUnits) {
        variantHits.push({
          kind: "serial",
          variantId: row.id,
          productSerialId: unit.id,
          sku: row.sku,
          name: `${row.product.name} — ${row.name}`,
          sellingPriceXaf: row.sellingPriceXaf.toString(),
          sellingPriceLabel: formatXaf(row.sellingPriceXaf),
          isSerialized: true,
          quantityAvailable: 1,
          imei1: unit.imei1,
          serialNumber: unit.serialNumber,
        });
      }
      if (stockUnits.length === 0) {
        variantHits.push({
          kind: "variant",
          variantId: row.id,
          productSerialId: null,
          sku: row.sku,
          name: `${row.product.name} — ${row.name}`,
          sellingPriceXaf: row.sellingPriceXaf.toString(),
          sellingPriceLabel: formatXaf(row.sellingPriceXaf),
          isSerialized: true,
          quantityAvailable: 0,
          imei1: null,
          serialNumber: null,
        });
      }
    } else {
      variantHits.push({
        kind: "variant",
        variantId: row.id,
        productSerialId: null,
        sku: row.sku,
        name: `${row.product.name} — ${row.name}`,
        sellingPriceXaf: row.sellingPriceXaf.toString(),
        sellingPriceLabel: formatXaf(row.sellingPriceXaf),
        isSerialized: false,
        quantityAvailable: row.quantityOnHand,
        imei1: null,
        serialNumber: null,
      });
    }
  }

  const seenSerials = new Set(
    serialHits.map((row) => row.productSerialId).filter(Boolean),
  );
  const merged = [
    ...serialHits,
    ...variantHits.filter(
      (row) =>
        !row.productSerialId || !seenSerials.has(row.productSerialId),
    ),
  ].slice(0, limit);

  return { items: merged };
}
