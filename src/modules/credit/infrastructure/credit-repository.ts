import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const creditDetailInclude = {
  customer: {
    select: { id: true, fullName: true, phone: true },
  },
  sale: { select: { id: true, reference: true, completedAt: true } },
  installments: { orderBy: { sequence: "asc" as const } },
  payments: {
    where: { status: "COMPLETED" as const },
    orderBy: { paidAt: "desc" as const },
    include: {
      recordedBy: { select: { id: true, fullName: true } },
      installment: { select: { id: true, sequence: true } },
      allocations: {
        include: {
          installment: { select: { id: true, sequence: true } },
        },
        orderBy: { createdAt: "asc" as const },
      },
    },
  },
} satisfies Prisma.CustomerCreditInclude;

export async function listCredits(filters: {
  q?: string;
  status?: string;
  customerId?: string;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.CustomerCreditWhereInput = {};
  if (filters.status) {
    where.status = filters.status as Prisma.EnumCreditStatusFilter;
  }
  if (filters.customerId) {
    where.customerId = filters.customerId;
  }
  if (filters.q) {
    where.OR = [
      { reference: { contains: filters.q, mode: "insensitive" } },
      { customer: { fullName: { contains: filters.q, mode: "insensitive" } } },
      { customer: { phone: { contains: filters.q, mode: "insensitive" } } },
      { sale: { reference: { contains: filters.q, mode: "insensitive" } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.customerCredit.count({ where }),
    prisma.customerCredit.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
        sale: { select: { id: true, reference: true } },
        installments: {
          select: {
            id: true,
            dueDate: true,
            amountDueXaf: true,
            amountPaidXaf: true,
            status: true,
          },
        },
      },
    }),
  ]);

  return { total, items };
}

export async function findCreditById(id: string) {
  return prisma.customerCredit.findUnique({
    where: { id },
    include: creditDetailInclude,
  });
}

export async function findPaymentByIdempotencyKey(key: string) {
  return prisma.payment.findUnique({
    where: { idempotencyKey: key },
    include: {
      credit: { select: { id: true, reference: true } },
    },
  });
}
