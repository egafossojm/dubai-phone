import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type ProductListFilters = {
  q?: string;
  brandId?: string;
  categoryId?: string;
  status?: "DRAFT" | "ACTIVE" | "INACTIVE";
  serialized?: boolean;
};

const productInclude = {
  brand: true,
  category: true,
  variants: {
    where: { deletedAt: null },
    orderBy: { sku: "asc" as const },
    include: {
      serials: {
        orderBy: { createdAt: "desc" as const },
        take: 200,
      },
    },
  },
} satisfies Prisma.ProductInclude;

export async function findBrandById(id: string) {
  return prisma.brand.findFirst({ where: { id, deletedAt: null } });
}

export async function findBrandByName(name: string) {
  return prisma.brand.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, deletedAt: null },
  });
}

export async function listBrands() {
  return prisma.brand.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function createBrand(name: string) {
  return prisma.brand.create({ data: { name } });
}

export async function findCategoryById(id: string) {
  return prisma.category.findFirst({ where: { id, deletedAt: null } });
}

export async function findCategoryByName(name: string) {
  return prisma.category.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, deletedAt: null },
  });
}

export async function listCategories() {
  return prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function createCategory(name: string) {
  return prisma.category.create({ data: { name } });
}

export async function findProductById(id: string) {
  return prisma.product.findFirst({
    where: { id, deletedAt: null },
    include: productInclude,
  });
}

export async function findVariantById(id: string) {
  return prisma.productVariant.findFirst({
    where: { id, deletedAt: null },
    include: { product: true },
  });
}

export async function getLowStockThreshold(): Promise<number> {
  const setting = await prisma.storeSetting.findUnique({
    where: { key: "stock.lowStockThreshold" },
  });
  const parsed = Number(setting?.value ?? 3);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 3;
}

export async function listProducts(filters: ProductListFilters) {
  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
  };

  if (filters.brandId) {
    where.brandId = filters.brandId;
  }
  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (typeof filters.serialized === "boolean") {
    where.isSerialized = filters.serialized;
  }
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { variants: { some: { sku: { contains: filters.q, mode: "insensitive" } } } },
      { variants: { some: { barcode: { contains: filters.q, mode: "insensitive" } } } },
      {
        variants: {
          some: {
            serials: {
              some: {
                OR: [
                  { imei1: { contains: filters.q, mode: "insensitive" } },
                  { imei2: { contains: filters.q, mode: "insensitive" } },
                  { serialNumber: { contains: filters.q, mode: "insensitive" } },
                ],
              },
            },
          },
        },
      },
    ];
  }

  return prisma.product.findMany({
    where,
    include: productInclude,
    orderBy: { name: "asc" },
  });
}

export async function createProductWithVariant(input: {
  name: string;
  brandId: string;
  categoryId: string;
  isSerialized: boolean;
  status: "DRAFT" | "ACTIVE" | "INACTIVE";
  variant: {
    sku: string;
    barcode: string | null;
    name: string;
    sellingPriceXaf: bigint;
    costPriceXaf: bigint;
    warrantyMonths: number;
  };
}) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name: input.name,
        brandId: input.brandId,
        categoryId: input.categoryId,
        isSerialized: input.isSerialized,
        status: input.status,
        variants: {
          create: {
            sku: input.variant.sku,
            barcode: input.variant.barcode,
            name: input.variant.name,
            sellingPriceXaf: input.variant.sellingPriceXaf,
            costPriceXaf: input.variant.costPriceXaf,
            warrantyMonths: input.variant.warrantyMonths,
            status: "ACTIVE",
          },
        },
      },
      include: productInclude,
    });
    return product;
  });
}

export async function updateProduct(
  id: string,
  data: Prisma.ProductUpdateInput,
) {
  return prisma.product.update({
    where: { id },
    data,
    include: productInclude,
  });
}

export async function createVariant(input: {
  productId: string;
  sku: string;
  barcode: string | null;
  name: string;
  sellingPriceXaf: bigint;
  costPriceXaf: bigint;
  warrantyMonths: number;
}) {
  return prisma.productVariant.create({
    data: {
      productId: input.productId,
      sku: input.sku,
      barcode: input.barcode,
      name: input.name,
      sellingPriceXaf: input.sellingPriceXaf,
      costPriceXaf: input.costPriceXaf,
      warrantyMonths: input.warrantyMonths,
      status: "ACTIVE",
    },
  });
}

export async function updateVariant(
  id: string,
  data: Prisma.ProductVariantUpdateInput,
) {
  return prisma.productVariant.update({
    where: { id },
    data,
  });
}
