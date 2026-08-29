import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getLowStockThreshold } from "@/modules/products/infrastructure/product-repository";
import { stockStatusFromQuantity } from "@/modules/inventory/domain/policies";

export type InventoryListFilters = {
  q?: string;
  stock?: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  serialized?: boolean;
  brandId?: string;
  categoryId?: string;
  page: number;
  pageSize: number;
};

const variantInclude = {
  product: {
    select: {
      id: true,
      name: true,
      isSerialized: true,
      status: true,
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ProductVariantInclude;

export async function listInventoryVariants(filters: InventoryListFilters) {
  const lowThreshold = await getLowStockThreshold();
  const where: Prisma.ProductVariantWhereInput = {
    deletedAt: null,
    product: {
      deletedAt: null,
      ...(filters.brandId ? { brandId: filters.brandId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(typeof filters.serialized === "boolean"
        ? { isSerialized: filters.serialized }
        : {}),
    },
  };

  if (filters.q) {
    where.OR = [
      { sku: { contains: filters.q, mode: "insensitive" } },
      { name: { contains: filters.q, mode: "insensitive" } },
      { barcode: { contains: filters.q, mode: "insensitive" } },
      { product: { name: { contains: filters.q, mode: "insensitive" } } },
    ];
  }

  if (filters.stock === "OUT_OF_STOCK") {
    where.quantityOnHand = { lte: 0 };
  } else if (filters.stock === "LOW_STOCK") {
    where.quantityOnHand = { gt: 0, lte: lowThreshold };
  } else if (filters.stock === "IN_STOCK") {
    where.quantityOnHand = { gt: lowThreshold };
  }

  const [total, items] = await Promise.all([
    prisma.productVariant.count({ where }),
    prisma.productVariant.findMany({
      where,
      include: variantInclude,
      orderBy: [{ quantityOnHand: "asc" }, { sku: "asc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);

  return { total, items, lowThreshold };
}

export async function findVariantInventory(variantId: string) {
  const lowThreshold = await getLowStockThreshold();
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, deletedAt: null },
    include: {
      ...variantInclude,
      serials: {
        orderBy: { createdAt: "desc" },
        take: 100,
      },
    },
  });
  return { variant, lowThreshold };
}

export async function listStockMovements(filters: {
  variantId?: string;
  productSerialId?: string;
  type?: Prisma.EnumStockMovementTypeFilter["equals"];
  page: number;
  pageSize: number;
}) {
  const where: Prisma.StockMovementWhereInput = {};
  if (filters.variantId) {
    where.variantId = filters.variantId;
  }
  if (filters.productSerialId) {
    where.productSerialId = filters.productSerialId;
  }
  if (filters.type) {
    where.type = filters.type;
  }

  const [total, items] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: {
        variant: {
          select: {
            id: true,
            sku: true,
            name: true,
            product: { select: { id: true, name: true } },
          },
        },
        productSerial: {
          select: {
            id: true,
            imei1: true,
            imei2: true,
            serialNumber: true,
            status: true,
          },
        },
        recordedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);

  return { total, items };
}

export async function listSerializedDevices(filters: {
  q?: string;
  status?: Prisma.EnumDeviceStatusFilter["equals"];
  variantId?: string;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.ProductSerialWhereInput = {};
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.variantId) {
    where.variantId = filters.variantId;
  }
  if (filters.q) {
    where.OR = [
      { imei1: { contains: filters.q, mode: "insensitive" } },
      { imei2: { contains: filters.q, mode: "insensitive" } },
      { serialNumber: { contains: filters.q, mode: "insensitive" } },
      {
        variant: {
          OR: [
            { sku: { contains: filters.q, mode: "insensitive" } },
            { product: { name: { contains: filters.q, mode: "insensitive" } } },
          ],
        },
      },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.productSerial.count({ where }),
    prisma.productSerial.findMany({
      where,
      include: {
        variant: {
          select: {
            id: true,
            sku: true,
            name: true,
            product: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);

  return { total, items };
}

export async function findSerialByIdOrIdentifier(query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return null;
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const or: Array<Record<string, string>> = [
    { imei1: trimmed },
    { imei2: trimmed },
    { serialNumber: trimmed.toUpperCase() },
  ];
  if (uuidPattern.test(trimmed)) {
    or.unshift({ id: trimmed });
  }

  return prisma.productSerial.findFirst({
    where: { OR: or },
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          name: true,
          product: { select: { id: true, name: true, isSerialized: true } },
        },
      },
      stockMovements: {
        orderBy: { createdAt: "desc" },
        include: {
          recordedBy: { select: { id: true, fullName: true } },
        },
      },
    },
  });
}

export function deriveStockStatus(quantity: number, lowThreshold: number) {
  return stockStatusFromQuantity(quantity, lowThreshold);
}
