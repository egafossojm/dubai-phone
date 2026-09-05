import type { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import type { AuthUser } from "@/lib/auth/session";
import { allocateDocumentReference } from "@/lib/db/number-sequence";
import { recordSaleDeduction } from "@/modules/inventory";
import type { completeSaleSchema } from "@/modules/sales/api/schemas";
import {
  assertCustomerRequiredForInstallment,
  assertDiscountWithinCap,
  assertDownPaymentRules,
  assertImmediatePaymentsCoverTotal,
  assertSerializedLine,
  buildInstallmentDueDates,
  parseSaleMoney,
  splitEqualInstallments,
  sumPayments,
} from "@/modules/sales/domain/policies";
import { computeSalePayloadFingerprint } from "@/modules/sales/application/fingerprint";
import { toSaleDetail, toSaleSummary } from "@/modules/sales/application/presenters";
import { deriveCreditStatus } from "@/modules/credit/domain/policies";
import { buildReceiptSnapshotInTx } from "@/modules/receipts/application/build-snapshot";

type CompleteInput = z.infer<typeof completeSaleSchema>;

const SALE_DETAIL_INCLUDE = {
  customer: { select: { id: true, fullName: true, phone: true } },
  soldBy: { select: { id: true, fullName: true } },
  receipt: { select: { id: true, reference: true } },
  credit: {
    select: {
      id: true,
      reference: true,
      remainingXaf: true,
      downPaymentXaf: true,
    },
  },
  items: {
    include: {
      variant: {
        include: {
          product: { select: { name: true, isSerialized: true } },
        },
      },
      serial: {
        select: { id: true, imei1: true, serialNumber: true },
      },
    },
  },
  payments: {
    orderBy: { paidAt: "asc" as const },
  },
} satisfies Prisma.SaleInclude;

async function loadSaleDetail(saleId: string) {
  const sale = await prisma.sale.findUniqueOrThrow({
    where: { id: saleId },
    include: SALE_DETAIL_INCLUDE,
  });
  return toSaleDetail(sale);
}

async function replayOrConflict(
  saleId: string,
  fingerprint: string,
  clientTxnId: string,
) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      status: true,
      clientTxnId: true,
      payloadFingerprint: true,
    },
  });
  if (!sale || sale.status !== "COMPLETED") {
    throw new AppError(
      "CONFLICT",
      "Cette transaction existe déjà dans un état inattendu.",
    );
  }
  if (sale.clientTxnId !== clientTxnId) {
    throw new AppError(
      "CONFLICT",
      "Ces clés de paiement appartiennent à une autre vente.",
    );
  }
  if (sale.payloadFingerprint && sale.payloadFingerprint !== fingerprint) {
    throw new AppError(
      "CONFLICT",
      "Cette clé de transaction existe déjà avec un autre panier ou paiement.",
    );
  }
  return {
    replayed: true as const,
    sale: await loadSaleDetail(sale.id),
  };
}

async function maxDiscountBpsForUser(
  userId: string,
  tx?: Prisma.TransactionClient,
): Promise<number> {
  const db = tx ?? prisma;
  const links = await db.userRole.findMany({
    where: { userId },
    include: { role: { select: { maxDiscountBps: true } } },
  });
  if (links.length === 0) {
    return 0;
  }
  return Math.max(...links.map((row) => row.role.maxDiscountBps));
}

async function readMinDownPaymentBps(
  tx?: Prisma.TransactionClient,
): Promise<number> {
  const db = tx ?? prisma;
  const setting = await db.storeSetting.findUnique({
    where: { key: "credit.minDownPaymentBps" },
  });
  const raw = setting?.value ?? "1000";
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0 || value >= 10_000) {
    return 1000;
  }
  return value;
}

function isClientTxnConflict(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }
  const target = Array.isArray(error.meta?.target)
    ? (error.meta.target as string[]).join(",")
    : String(error.meta?.target ?? "");
  return target.includes("clientTxnId");
}

function isSaleSerialConflict(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }
  const target = Array.isArray(error.meta?.target)
    ? (error.meta.target as string[]).join(",")
    : String(error.meta?.target ?? "");
  return (
    target.includes("stock_movements_sale_productSerialId_key") ||
    target.includes("productSerialId")
  );
}

export async function completeSaleUseCase(user: AuthUser, input: CompleteInput) {
  const fingerprint = computeSalePayloadFingerprint(input);

  const existing = await prisma.sale.findUnique({
    where: { clientTxnId: input.clientTxnId },
    select: {
      id: true,
      status: true,
      payloadFingerprint: true,
    },
  });
  if (existing) {
    return replayOrConflict(existing.id, fingerprint, input.clientTxnId);
  }

  const paymentKeys = input.payments.map((row) => row.idempotencyKey);
  if (new Set(paymentKeys).size !== paymentKeys.length) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Chaque paiement doit avoir une clé d'idempotence distincte.",
    );
  }
  const existingPayments = await prisma.payment.findMany({
    where: { idempotencyKey: { in: paymentKeys } },
    select: { idempotencyKey: true, saleId: true },
  });
  if (existingPayments.length > 0) {
    const saleIds = [
      ...new Set(
        existingPayments
          .map((row) => row.saleId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (saleIds.length === 1) {
      return replayOrConflict(saleIds[0]!, fingerprint, input.clientTxnId);
    }
    throw new AppError(
      "CONFLICT",
      "Une clé d'idempotence de paiement est déjà utilisée.",
    );
  }

  assertCustomerRequiredForInstallment(input.kind, input.customerId);

  if (input.kind === "INSTALLMENT" && !input.installmentPlan) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Le plan d'échéances est requis pour une vente à crédit.",
    );
  }
  if (input.kind === "IMMEDIATE" && input.installmentPlan) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Un plan d'échéances n'est pas autorisé pour une vente comptant.",
    );
  }

  const paidNowXaf = sumPayments(input.payments);
  const globalDiscountXaf = parseSaleMoney(
    input.discountTotalXaf,
    "remise globale",
  );

  try {
    const saleId = await prisma.$transaction(async (tx) => {
      const maxDiscountBps = await maxDiscountBpsForUser(user.id, tx);
      const minDownPaymentBps = await readMinDownPaymentBps(tx);

      if (input.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: input.customerId, deletedAt: null },
          select: { id: true },
        });
        if (!customer) {
          throw new AppError("NOT_FOUND", "Client introuvable.");
        }
      }

      const racedPayments = await tx.payment.findMany({
        where: { idempotencyKey: { in: paymentKeys } },
        select: { saleId: true },
      });
      if (racedPayments.length > 0) {
        throw new AppError(
          "CONFLICT",
          "Une clé d'idempotence de paiement est déjà utilisée.",
        );
      }

      type PreparedLine = {
        variantId: string;
        quantity: number;
        productSerialId?: string;
        unitPriceXaf: bigint;
        discountXaf: bigint;
        lineTotalXaf: bigint;
        warrantyMonths: number;
        isSerialized: boolean;
      };

      const prepared: PreparedLine[] = [];
      const serialIdsSeen = new Set<string>();

      for (const item of input.items) {
        const variant = await tx.productVariant.findFirst({
          where: { id: item.variantId, deletedAt: null },
          include: {
            product: {
              select: {
                isSerialized: true,
                status: true,
                deletedAt: true,
              },
            },
          },
        });
        if (
          !variant ||
          variant.status !== "ACTIVE" ||
          variant.product.deletedAt ||
          variant.product.status !== "ACTIVE"
        ) {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            "Produit indisponible à la vente.",
          );
        }

        assertSerializedLine(
          variant.product.isSerialized,
          item.quantity,
          item.productSerialId,
        );

        if (item.productSerialId) {
          if (serialIdsSeen.has(item.productSerialId)) {
            throw new AppError(
              "BUSINESS_RULE_ERROR",
              "Le même appareil ne peut pas apparaître deux fois dans le panier.",
            );
          }
          serialIdsSeen.add(item.productSerialId);
        }

        const lineDiscount = parseSaleMoney(item.discountXaf, "remise ligne");
        const unitPrice = variant.sellingPriceXaf;
        const gross = unitPrice * BigInt(item.quantity);
        if (lineDiscount > gross) {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            "La remise ligne dépasse le montant de la ligne.",
          );
        }
        prepared.push({
          variantId: variant.id,
          quantity: item.quantity,
          productSerialId: item.productSerialId,
          unitPriceXaf: unitPrice,
          discountXaf: lineDiscount,
          lineTotalXaf: gross - lineDiscount,
          warrantyMonths: variant.warrantyMonths,
          isSerialized: variant.product.isSerialized,
        });
      }

      const linesSubtotal = prepared.reduce(
        (sum, row) => sum + row.unitPriceXaf * BigInt(row.quantity),
        BigInt(0),
      );
      const linesDiscount = prepared.reduce(
        (sum, row) => sum + row.discountXaf,
        BigInt(0),
      );
      const discountTotalXaf = linesDiscount + globalDiscountXaf;
      assertDiscountWithinCap({
        subtotalXaf: linesSubtotal,
        discountTotalXaf,
        maxDiscountBps,
      });

      const afterLineTotals = prepared.reduce(
        (sum, row) => sum + row.lineTotalXaf,
        BigInt(0),
      );
      if (globalDiscountXaf > afterLineTotals) {
        throw new AppError(
          "BUSINESS_RULE_ERROR",
          "La remise globale dépasse le total des lignes.",
        );
      }
      const totalXaf = afterLineTotals - globalDiscountXaf;
      if (totalXaf <= BigInt(0)) {
        throw new AppError(
          "BUSINESS_RULE_ERROR",
          "Le total de la vente doit être positif.",
        );
      }

      if (input.kind === "IMMEDIATE") {
        assertImmediatePaymentsCoverTotal(totalXaf, paidNowXaf);
      } else {
        assertDownPaymentRules({
          totalXaf,
          downPaymentXaf: paidNowXaf,
          minDownPaymentBps,
        });
      }

      const saleReference = await allocateDocumentReference("SALE", { tx });
      const receiptReference = await allocateDocumentReference("RECEIPT", {
        tx,
      });

      const sale = await tx.sale.create({
        data: {
          reference: saleReference,
          clientTxnId: input.clientTxnId,
          payloadFingerprint: fingerprint,
          kind: input.kind,
          status: "COMPLETED",
          customerId: input.customerId ?? null,
          soldById: user.id,
          subtotalXaf: linesSubtotal,
          discountTotalXaf,
          totalXaf,
          notes: input.notes?.trim() || null,
          completedAt: new Date(),
        },
      });

      const createdItems: Array<{
        id: string;
        variantId: string;
        quantity: number;
        productSerialId?: string;
        warrantyMonths: number;
        isSerialized: boolean;
      }> = [];

      for (const line of prepared) {
        const saleItem = await tx.saleItem.create({
          data: {
            saleId: sale.id,
            variantId: line.variantId,
            quantity: line.quantity,
            unitPriceXaf: line.unitPriceXaf,
            discountXaf: line.discountXaf,
            lineTotalXaf: line.lineTotalXaf,
          },
        });
        createdItems.push({
          id: saleItem.id,
          variantId: line.variantId,
          quantity: line.quantity,
          productSerialId: line.productSerialId,
          warrantyMonths: line.warrantyMonths,
          isSerialized: line.isSerialized,
        });

        if (line.discountXaf > BigInt(0)) {
          await tx.saleDiscount.create({
            data: {
              saleId: sale.id,
              saleItemId: saleItem.id,
              scope: "LINE",
              type: "FIXED",
              amountXaf: line.discountXaf,
              grantedById: user.id,
            },
          });
        }
      }

      if (globalDiscountXaf > BigInt(0)) {
        await tx.saleDiscount.create({
          data: {
            saleId: sale.id,
            scope: "SALE",
            type: "FIXED",
            amountXaf: globalDiscountXaf,
            grantedById: user.id,
          },
        });
      }

      for (const [index, payment] of input.payments.entries()) {
        const amountXaf = parseSaleMoney(payment.amountXaf, "paiement");
        if (amountXaf <= BigInt(0)) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Chaque paiement doit être un montant positif.",
          );
        }
        await tx.payment.create({
          data: {
            idempotencyKey: payment.idempotencyKey,
            method: payment.method,
            amountXaf,
            operatorReference: payment.operatorReference?.trim() || null,
            saleId: sale.id,
            recordedById: user.id,
          },
        });
        void index;
      }

      let creditId: string | null = null;
      let creditSnapshot: {
        reference: string;
        remainingXaf: bigint;
      } | null = null;
      if (input.kind === "INSTALLMENT" && input.installmentPlan) {
        const remainingXaf = totalXaf - paidNowXaf;
        const amounts = splitEqualInstallments(
          remainingXaf,
          input.installmentPlan.installmentCount,
        );
        const dueDates = buildInstallmentDueDates({
          count: input.installmentPlan.installmentCount,
          firstDueDate: input.installmentPlan.firstDueDate,
          intervalDays: input.installmentPlan.intervalDays,
        });
        const creditStatus = deriveCreditStatus({
          remainingXaf,
          totalAmountXaf: totalXaf,
          downPaymentXaf: paidNowXaf,
          installments: amounts.map((amountDueXaf, index) => ({
            dueDate: dueDates[index]!,
            amountDueXaf,
            amountPaidXaf: BigInt(0),
            status: "DUE" as const,
          })),
        });
        const creditReference = await allocateDocumentReference("CREDIT", {
          tx,
        });
        const credit = await tx.customerCredit.create({
          data: {
            reference: creditReference,
            saleId: sale.id,
            customerId: input.customerId!,
            totalAmountXaf: totalXaf,
            downPaymentXaf: paidNowXaf,
            remainingXaf,
            status: creditStatus,
            installments: {
              create: amounts.map((amountDueXaf, index) => ({
                sequence: index + 1,
                dueDate: dueDates[index]!,
                amountDueXaf,
              })),
            },
          },
        });
        creditId = credit.id;
        creditSnapshot = {
          reference: credit.reference,
          remainingXaf,
        };

        // Link down-payment payments to the credit account (not to installments).
        await tx.payment.updateMany({
          where: { saleId: sale.id },
          data: { creditId: credit.id },
        });
      }

      await recordSaleDeduction(
        user.id,
        createdItems.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
          saleId: sale.id,
          saleItemId: item.id,
          productSerialId: item.productSerialId,
        })),
        { tx },
      );

      for (const item of createdItems) {
        if (!item.productSerialId) {
          continue;
        }
        await tx.productSerial.update({
          where: { id: item.productSerialId },
          data: {
            customerId: input.customerId ?? null,
          },
        });

        if (item.warrantyMonths > 0) {
          const startsAt = new Date();
          const endsAt = new Date(startsAt);
          endsAt.setMonth(endsAt.getMonth() + item.warrantyMonths);
          const warrantyReference = await allocateDocumentReference(
            "WARRANTY",
            { tx },
          );
          await tx.warranty.create({
            data: {
              reference: warrantyReference,
              saleId: sale.id,
              saleItemId: item.id,
              productSerialId: item.productSerialId,
              customerId: input.customerId ?? null,
              status: "ACTIVE",
              startsAt,
              endsAt,
            },
          });
        }
      }

      await tx.receipt.create({
        data: {
          saleId: sale.id,
          reference: receiptReference,
          snapshotJson: await buildReceiptSnapshotInTx(tx, {
            receiptReference,
            saleId: sale.id,
            saleReference: sale.reference,
            saleKind: input.kind,
            completedAt: sale.completedAt!,
            cashierName: user.fullName,
            customer: input.customerId
              ? await tx.customer
                  .findUniqueOrThrow({
                    where: { id: input.customerId },
                    select: { fullName: true, phone: true },
                  })
                  .then((row) => ({
                    fullName: row.fullName,
                    phone: row.phone,
                  }))
              : null,
            subtotalXaf: linesSubtotal,
            lineDiscountTotalXaf: linesDiscount,
            globalDiscountXaf,
            totalXaf,
            credit: creditSnapshot,
          }),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "sale.complete",
          entityType: "Sale",
          entityId: sale.id,
          afterJson: JSON.stringify({
            reference: sale.reference,
            kind: input.kind,
            totalXaf: totalXaf.toString(),
            paidNowXaf: paidNowXaf.toString(),
            discountTotalXaf: discountTotalXaf.toString(),
            payments: input.payments.map((row) => ({
              method: row.method,
              amountXaf: parseSaleMoney(row.amountXaf, "paiement").toString(),
              idempotencyKey: row.idempotencyKey,
            })),
            serialIds: createdItems
              .map((row) => row.productSerialId)
              .filter(Boolean),
            customerId: input.customerId ?? null,
            creditId,
            itemCount: createdItems.length,
            payloadFingerprint: fingerprint,
          }),
        },
      });

      if (discountTotalXaf > BigInt(0)) {
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "sale.discount",
            entityType: "Sale",
            entityId: sale.id,
            afterJson: JSON.stringify({
              discountTotalXaf: discountTotalXaf.toString(),
              subtotalXaf: linesSubtotal.toString(),
            }),
          },
        });
      }

      return sale.id;
    });

    return {
      replayed: false as const,
      sale: await loadSaleDetail(saleId),
    };
  } catch (error) {
    if (isClientTxnConflict(error)) {
      const sale = await prisma.sale.findUnique({
        where: { clientTxnId: input.clientTxnId },
        select: { id: true },
      });
      if (sale) {
        return replayOrConflict(sale.id, fingerprint, input.clientTxnId);
      }
    }
    if (isSaleSerialConflict(error)) {
      throw new AppError(
        "BUSINESS_RULE_ERROR",
        "Cet appareil vient d'être vendu par une autre opération.",
      );
    }
    if (error instanceof AppError && error.message.includes("paiement")) {
      const raced = await prisma.payment.findMany({
        where: { idempotencyKey: { in: paymentKeys } },
        select: { saleId: true },
      });
      const saleIds = [
        ...new Set(
          raced.map((row) => row.saleId).filter((id): id is string => Boolean(id)),
        ),
      ];
      if (saleIds.length === 1) {
        return replayOrConflict(saleIds[0]!, fingerprint, input.clientTxnId);
      }
    }
    throw error;
  }
}

export async function getSaleUseCase(id: string) {
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: SALE_DETAIL_INCLUDE,
  });
  if (!sale) {
    throw new AppError("NOT_FOUND", "Vente introuvable.");
  }
  return toSaleDetail(sale);
}

export async function listRecentSalesUseCase() {
  const sales = await prisma.sale.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, fullName: true, phone: true } },
      soldBy: { select: { fullName: true } },
      receipt: { select: { id: true, reference: true } },
      credit: {
        select: {
          id: true,
          reference: true,
          remainingXaf: true,
          downPaymentXaf: true,
        },
      },
    },
  });
  return sales.map((sale) => toSaleSummary(sale));
}
