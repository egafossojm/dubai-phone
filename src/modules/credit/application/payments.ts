import type { z } from "zod";
import type { InstallmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import type { AuthUser } from "@/lib/auth/session";
import { throwIfUniqueConflict } from "@/lib/db/prisma-errors";
import type {
  listCreditsQuerySchema,
  registerCreditPaymentSchema,
} from "@/modules/credit/api/schemas";
import {
  assertCreditAcceptsPayment,
  assertNoOverpayment,
  assertPositivePaymentAmount,
  deriveCreditStatus,
  deriveInstallmentStatus,
  parsePaymentAmount,
} from "@/modules/credit/domain/policies";
import {
  findCreditById,
  findPaymentByIdempotencyKey,
  listCredits,
} from "@/modules/credit/infrastructure/credit-repository";
import {
  toCreditDetail,
  toCreditListItem,
} from "@/modules/credit/application/presenters";
import {
  refreshCreditStatusesInTx,
  refreshOpenCreditStatuses,
} from "@/modules/credit/application/refresh-status";

type ListQuery = z.infer<typeof listCreditsQuerySchema>;
type PaymentInput = z.infer<typeof registerCreditPaymentSchema>;

function allocateAcrossInstallments(
  installments: Array<{
    id: string;
    sequence: number;
    dueDate: Date;
    amountDueXaf: bigint;
    amountPaidXaf: bigint;
    status: InstallmentStatus;
  }>,
  paymentXaf: bigint,
  preferredInstallmentId?: string,
): Array<{ installmentId: string; amount: bigint }> {
  const open = installments
    .filter((row) => row.amountPaidXaf < row.amountDueXaf)
    .sort((a, b) => a.sequence - b.sequence);

  if (preferredInstallmentId) {
    const preferred = open.find((row) => row.id === preferredInstallmentId);
    if (!preferred) {
      throw new AppError(
        "BUSINESS_RULE_ERROR",
        "L'échéance choisie est déjà soldée ou introuvable sur ce crédit.",
      );
    }
    const room = preferred.amountDueXaf - preferred.amountPaidXaf;
    if (paymentXaf > room) {
      throw new AppError(
        "BUSINESS_RULE_ERROR",
        `Le paiement dépasse le reste de l'échéance n°${preferred.sequence} (${room.toString()} FCFA).`,
      );
    }
    return [{ installmentId: preferred.id, amount: paymentXaf }];
  }

  let left = paymentXaf;
  const allocations: Array<{ installmentId: string; amount: bigint }> = [];
  for (const row of open) {
    if (left <= BigInt(0)) {
      break;
    }
    const room = row.amountDueXaf - row.amountPaidXaf;
    const take = left < room ? left : room;
    allocations.push({ installmentId: row.id, amount: take });
    left -= take;
  }
  if (left > BigInt(0)) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "Impossible d'imputer le paiement sur les échéances restantes.",
    );
  }
  return allocations;
}

export async function listCreditsUseCase(query: ListQuery) {
  await prisma.$transaction(async (tx) => {
    await refreshOpenCreditStatuses(tx, {
      customerId: query.customerId,
    });
  });

  const result = await listCredits(query);
  return {
    items: result.items.map(toCreditListItem),
    total: result.total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getCreditUseCase(id: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.customerCredit.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new AppError("NOT_FOUND", "Crédit introuvable.");
    }
    if (existing.status !== "PAID" && existing.status !== "CANCELLED") {
      await refreshCreditStatusesInTx(tx, id);
    }
  });

  const credit = await findCreditById(id);
  if (!credit) {
    throw new AppError("NOT_FOUND", "Crédit introuvable.");
  }
  return toCreditDetail(credit);
}

export async function registerCreditPaymentUseCase(
  user: AuthUser,
  input: PaymentInput,
) {
  const amountXaf = parsePaymentAmount(input.amountXaf);
  assertPositivePaymentAmount(amountXaf);

  const existingPayment = await findPaymentByIdempotencyKey(input.idempotencyKey);
  if (existingPayment) {
    if (existingPayment.creditId !== input.creditId) {
      throw new AppError(
        "CONFLICT",
        "Cette clé d'idempotence est déjà utilisée pour un autre crédit.",
      );
    }
    if (
      existingPayment.amountXaf !== amountXaf ||
      existingPayment.method !== input.method
    ) {
      throw new AppError(
        "CONFLICT",
        "Cette clé d'idempotence existe déjà avec un autre montant ou mode de paiement.",
      );
    }
    const credit = await findCreditById(input.creditId);
    if (!credit) {
      throw new AppError("NOT_FOUND", "Crédit introuvable.");
    }
    return {
      replayed: true,
      paymentId: existingPayment.id,
      credit: toCreditDetail(credit),
    };
  }

  try {
    const paymentId = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT 1 FROM customer_credits WHERE id = ${input.creditId} FOR UPDATE
      `;

      const credit = await tx.customerCredit.findUnique({
        where: { id: input.creditId },
        include: {
          installments: { orderBy: { sequence: "asc" } },
        },
      });
      if (!credit) {
        throw new AppError("NOT_FOUND", "Crédit introuvable.");
      }

      assertCreditAcceptsPayment(credit.status);
      assertNoOverpayment(credit.remainingXaf, amountXaf);

      const allocations = allocateAcrossInstallments(
        credit.installments,
        amountXaf,
        input.installmentId,
      );

      const primaryInstallmentId =
        allocations.length === 1 ? allocations[0]!.installmentId : null;

      const payment = await tx.payment.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          method: input.method,
          amountXaf,
          operatorReference: input.operatorReference?.trim() || null,
          creditId: credit.id,
          saleId: credit.saleId,
          installmentId: primaryInstallmentId,
          recordedById: user.id,
          allocations: {
            create: allocations.map((allocation) => ({
              installmentId: allocation.installmentId,
              amountXaf: allocation.amount,
            })),
          },
        },
      });

      for (const allocation of allocations) {
        const row = credit.installments.find(
          (item) => item.id === allocation.installmentId,
        );
        if (!row) {
          throw new AppError("NOT_FOUND", "Échéance introuvable.");
        }
        const amountPaidXaf = row.amountPaidXaf + allocation.amount;
        const status = deriveInstallmentStatus({
          dueDate: row.dueDate,
          amountDueXaf: row.amountDueXaf,
          amountPaidXaf,
        });
        await tx.installment.update({
          where: { id: row.id },
          data: { amountPaidXaf, status },
        });
        row.amountPaidXaf = amountPaidXaf;
        row.status = status;
      }

      const remainingXaf = credit.remainingXaf - amountXaf;
      const status = deriveCreditStatus({
        remainingXaf,
        totalAmountXaf: credit.totalAmountXaf,
        downPaymentXaf: credit.downPaymentXaf,
        installments: credit.installments,
      });

      await tx.customerCredit.update({
        where: { id: credit.id },
        data: { remainingXaf, status },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "credit.payment",
          entityType: "CustomerCredit",
          entityId: credit.id,
          afterJson: JSON.stringify({
            paymentId: payment.id,
            amountXaf: amountXaf.toString(),
            method: input.method,
            remainingXaf: remainingXaf.toString(),
            status,
            allocations: allocations.map((row) => ({
              installmentId: row.installmentId,
              amountXaf: row.amount.toString(),
            })),
          }),
        },
      });

      return payment.id;
    });

    const credit = await findCreditById(input.creditId);
    return {
      replayed: false,
      paymentId,
      credit: toCreditDetail(credit!),
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      const replay = await findPaymentByIdempotencyKey(input.idempotencyKey);
      if (replay?.creditId === input.creditId) {
        if (
          replay.amountXaf !== amountXaf ||
          replay.method !== input.method
        ) {
          throw new AppError(
            "CONFLICT",
            "Cette clé d'idempotence existe déjà avec un autre montant ou mode de paiement.",
          );
        }
        const credit = await findCreditById(input.creditId);
        return {
          replayed: true,
          paymentId: replay.id,
          credit: toCreditDetail(credit!),
        };
      }
    }
    throwIfUniqueConflict(error, {
      idempotencyKey: "Cette clé d'idempotence existe déjà.",
    });
  }
}
