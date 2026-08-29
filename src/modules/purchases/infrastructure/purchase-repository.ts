import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function listSuppliers(filters: {
  q?: string;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.SupplierWhereInput = { deletedAt: null };
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { phone: { contains: filters.q, mode: "insensitive" } },
      { email: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);

  return { total, items };
}

export async function findSupplierById(id: string) {
  return prisma.supplier.findFirst({
    where: { id, deletedAt: null },
    include: {
      purchaseOrders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          reference: true,
          status: true,
          createdAt: true,
          orderedAt: true,
        },
      },
    },
  });
}

export async function createSupplier(data: {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}) {
  return prisma.supplier.create({ data });
}

export async function updateSupplier(
  id: string,
  data: {
    name?: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  },
) {
  return prisma.supplier.update({ where: { id }, data });
}

export async function softDeleteSupplier(id: string) {
  return prisma.supplier.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

const poInclude = {
  supplier: { select: { id: true, name: true, phone: true } },
  createdBy: { select: { id: true, fullName: true } },
  items: {
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          name: true,
          costPriceXaf: true,
          product: {
            select: {
              id: true,
              name: true,
              isSerialized: true,
            },
          },
          warrantyMonths: true,
        },
      },
    },
  },
  receipts: {
    orderBy: { createdAt: "desc" as const },
    include: {
      postedBy: { select: { id: true, fullName: true } },
      items: {
        include: {
          variant: {
            select: {
              id: true,
              sku: true,
              name: true,
              product: { select: { id: true, name: true } },
            },
          },
          serials: {
            select: {
              id: true,
              imei1: true,
              imei2: true,
              serialNumber: true,
              status: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PurchaseOrderInclude;

export async function listPurchaseOrders(filters: {
  q?: string;
  status?: Prisma.EnumPurchaseOrderStatusFilter["equals"];
  supplierId?: string;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.PurchaseOrderWhereInput = {};
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.supplierId) {
    where.supplierId = filters.supplierId;
  }
  if (filters.q) {
    where.OR = [
      { reference: { contains: filters.q, mode: "insensitive" } },
      { supplier: { name: { contains: filters.q, mode: "insensitive" } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
        items: { select: { quantityOrdered: true, quantityReceived: true, unitCostXaf: true } },
        _count: { select: { receipts: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);

  return { total, items };
}

export async function findPurchaseOrderById(id: string) {
  return prisma.purchaseOrder.findUnique({
    where: { id },
    include: poInclude,
  });
}

export async function listPostedReceipts(filters: {
  q?: string;
  supplierId?: string;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.GoodsReceiptWhereInput = { status: "POSTED" };
  if (filters.supplierId) {
    where.purchaseOrder = { supplierId: filters.supplierId };
  }
  if (filters.q) {
    where.OR = [
      { reference: { contains: filters.q, mode: "insensitive" } },
      {
        purchaseOrder: {
          OR: [
            { reference: { contains: filters.q, mode: "insensitive" } },
            { supplier: { name: { contains: filters.q, mode: "insensitive" } } },
          ],
        },
      },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.goodsReceipt.count({ where }),
    prisma.goodsReceipt.findMany({
      where,
      include: {
        purchaseOrder: {
          select: {
            id: true,
            reference: true,
            supplier: { select: { id: true, name: true } },
          },
        },
        postedBy: { select: { id: true, fullName: true } },
        items: {
          include: {
            variant: {
              select: {
                sku: true,
                name: true,
                product: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { postedAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);

  return { total, items };
}

export async function findGoodsReceiptById(id: string) {
  return prisma.goodsReceipt.findUnique({
    where: { id },
    include: {
      purchaseOrder: {
        include: {
          supplier: true,
        },
      },
      postedBy: { select: { id: true, fullName: true } },
      items: {
        include: {
          variant: {
            select: {
              id: true,
              sku: true,
              name: true,
              product: { select: { id: true, name: true, isSerialized: true } },
            },
          },
          serials: true,
        },
      },
    },
  });
}

export async function listActiveVariantsForPurchase(limit = 200) {
  return prisma.productVariant.findMany({
    where: { deletedAt: null, product: { deletedAt: null, status: "ACTIVE" } },
    orderBy: { sku: "asc" },
    take: limit,
    select: {
      id: true,
      sku: true,
      name: true,
      costPriceXaf: true,
      product: { select: { name: true, isSerialized: true } },
    },
  });
}
