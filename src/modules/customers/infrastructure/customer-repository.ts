import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function listCustomers(filters: {
  q?: string;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.CustomerWhereInput = { deletedAt: null };
  if (filters.q) {
    where.OR = [
      { fullName: { contains: filters.q, mode: "insensitive" } },
      { phone: { contains: filters.q, mode: "insensitive" } },
      { email: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { fullName: "asc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      include: {
        credits: {
          where: { status: { notIn: ["PAID", "CANCELLED"] } },
          select: { remainingXaf: true, status: true },
        },
        _count: { select: { sales: true } },
      },
    }),
  ]);

  return { total, items };
}

export async function findCustomerById(id: string) {
  return prisma.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      sales: {
        where: { status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        take: 30,
        select: {
          id: true,
          reference: true,
          kind: true,
          totalXaf: true,
          completedAt: true,
          status: true,
        },
      },
      credits: {
        orderBy: { createdAt: "desc" },
        include: {
          installments: { orderBy: { sequence: "asc" } },
          sale: { select: { id: true, reference: true } },
        },
      },
    },
  });
}

export async function findCustomerByPhone(phone: string) {
  return prisma.customer.findFirst({
    where: { phone, deletedAt: null },
  });
}

export async function createCustomer(data: {
  fullName: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
}) {
  return prisma.customer.create({ data });
}

export async function updateCustomer(
  id: string,
  data: {
    fullName?: string;
    phone?: string;
    email?: string | null;
    address?: string | null;
    notes?: string | null;
  },
) {
  return prisma.customer.update({ where: { id }, data });
}

export async function softDeleteCustomer(id: string) {
  return prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
