import type { Prisma } from "@prisma/client";
import {
  deriveCreditStatus,
  deriveInstallmentStatus,
} from "@/modules/credit/domain/policies";
import { AppError } from "@/lib/errors/app-error";

type Tx = Prisma.TransactionClient;

export async function refreshCreditStatusesInTx(
  tx: Tx,
  creditId: string,
  now = new Date(),
) {
  const credit = await tx.customerCredit.findUnique({
    where: { id: creditId },
    include: { installments: { orderBy: { sequence: "asc" } } },
  });
  if (!credit) {
    throw new AppError("NOT_FOUND", "Crédit introuvable.");
  }

  for (const row of credit.installments) {
    const nextStatus = deriveInstallmentStatus({
      dueDate: row.dueDate,
      amountDueXaf: row.amountDueXaf,
      amountPaidXaf: row.amountPaidXaf,
      now,
    });
    if (nextStatus !== row.status) {
      await tx.installment.update({
        where: { id: row.id },
        data: { status: nextStatus },
      });
      row.status = nextStatus;
    }
  }

  const nextCreditStatus = deriveCreditStatus({
    remainingXaf: credit.remainingXaf,
    totalAmountXaf: credit.totalAmountXaf,
    downPaymentXaf: credit.downPaymentXaf,
    installments: credit.installments,
    now,
  });
  if (nextCreditStatus !== credit.status) {
    await tx.customerCredit.update({
      where: { id: creditId },
      data: { status: nextCreditStatus },
    });
  }

  return nextCreditStatus;
}

/** Persist overdue / partial statuses for all open credits (optionally for one customer). */
export async function refreshOpenCreditStatuses(
  tx: Tx,
  options?: { customerId?: string },
) {
  const open = await tx.customerCredit.findMany({
    where: {
      status: { notIn: ["PAID", "CANCELLED", "DEFAULTED"] },
      ...(options?.customerId ? { customerId: options.customerId } : {}),
    },
    select: { id: true },
  });
  for (const credit of open) {
    await refreshCreditStatusesInTx(tx, credit.id);
  }
}
