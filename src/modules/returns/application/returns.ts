import type { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import type { AuthUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { allocateDocumentReference } from "@/lib/db/number-sequence";
import { parseXafAmount } from "@/modules/products/domain/policies";
import {
  recordCustomerReturn,
  recordExchangeReplacement,
} from "@/modules/inventory";
import { refreshCreditStatusesInTx } from "@/modules/credit/application/refresh-status";
import type {
  acceptReturnSchema,
  completeExchangeSchema,
  completeRefundSchema,
  createReturnSchema,
  listReturnsQuerySchema,
  rejectReturnSchema,
  warrantyLookupQuerySchema,
} from "@/modules/returns/api/schemas";
import {
  assertCanTransitionReturn,
  assertRefundWithinLimit,
  assertReturnWindow,
  computeReturnedGoodsValue,
} from "@/modules/returns/domain/policies";
import {
  toReturnDetail,
  toReturnSummary,
  toWarrantyLookupItem,
} from "@/modules/returns/application/presenters";

type CreateInput = z.infer<typeof createReturnSchema>;
type ListQuery = z.infer<typeof listReturnsQuerySchema>;
type AcceptInput = z.infer<typeof acceptReturnSchema>;
type RejectInput = z.infer<typeof rejectReturnSchema>;
type RefundInput = z.infer<typeof completeRefundSchema>;
type ExchangeInput = z.infer<typeof completeExchangeSchema>;
type WarrantyQuery = z.infer<typeof warrantyLookupQuerySchema>;

const RETURN_DETAIL_INCLUDE = {
  sale: {
    select: {
      id: true,
      reference: true,
      totalXaf: true,
      completedAt: true,
      kind: true,
    },
  },
  customer: { select: { id: true, fullName: true, phone: true } },
  requestedBy: { select: { fullName: true } },
  items: {
    include: {
      variant: { select: { sku: true, name: true } },
      productSerial: {
        select: { imei1: true, serialNumber: true },
      },
      saleItem: {
        select: {
          unitPriceXaf: true,
          lineTotalXaf: true,
          quantity: true,
        },
      },
    },
  },
  refunds: {
    include: { recordedBy: { select: { fullName: true } } },
    orderBy: { refundedAt: "desc" as const },
  },
} as const;

async function readReturnMaxDays(tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;
  const setting = await db.storeSetting.findUnique({
    where: { key: "returns.maxDays" },
    select: { value: true },
  });
  const parsed = Number.parseInt(setting?.value ?? "7", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

async function lockSale(tx: Prisma.TransactionClient, saleId: string) {
  await tx.$executeRaw`
    SELECT 1 FROM sales WHERE id = ${saleId} FOR UPDATE
  `;
}

async function lockReturn(tx: Prisma.TransactionClient, returnId: string) {
  await tx.$executeRaw`
    SELECT 1 FROM returns WHERE id = ${returnId} FOR UPDATE
  `;
}

async function sumSalePaidXaf(saleId: string, tx: Prisma.TransactionClient) {
  const payments = await tx.payment.findMany({
    where: { saleId },
    select: { amountXaf: true },
  });
  return payments.reduce((sum, row) => sum + row.amountXaf, BigInt(0));
}

async function sumSaleRefundedXaf(saleId: string, tx: Prisma.TransactionClient) {
  const refunds = await tx.refund.findMany({
    where: { returnRecord: { saleId } },
    select: { amountXaf: true },
  });
  return refunds.reduce((sum, row) => sum + row.amountXaf, BigInt(0));
}

async function sumReturnRefundedXaf(
  returnId: string,
  tx: Prisma.TransactionClient,
) {
  const refunds = await tx.refund.findMany({
    where: { returnId },
    select: { amountXaf: true },
  });
  return refunds.reduce((sum, row) => sum + row.amountXaf, BigInt(0));
}

function goodsValueForReturnItems(
  items: Array<{
    quantity: number;
    saleItem: { lineTotalXaf: bigint; quantity: number };
  }>,
) {
  return computeReturnedGoodsValue({
    items: items.map((item) => ({
      lineTotalXaf: item.saleItem.lineTotalXaf,
      saleQuantity: item.saleItem.quantity,
      returnQuantity: item.quantity,
    })),
  });
}

/**
 * Cap for additional cash refund on this return:
 * min(goods − alreadyRefundedOnThisReturn, paid − alreadyRefundedOnSale).
 */
async function computeRefundableForReturn(
  returnId: string,
  tx: Prisma.TransactionClient,
) {
  const ret = await tx.return.findUniqueOrThrow({
    where: { id: returnId },
    include: {
      items: {
        include: {
          saleItem: {
            select: { lineTotalXaf: true, quantity: true },
          },
        },
      },
    },
  });
  const goods = goodsValueForReturnItems(ret.items);
  const refundedThis = await sumReturnRefundedXaf(returnId, tx);
  const remainingGoods = goods - refundedThis;
  const paid = await sumSalePaidXaf(ret.saleId, tx);
  const refundedSale = await sumSaleRefundedXaf(ret.saleId, tx);
  const remainingPaid = paid - refundedSale;
  const cap =
    remainingGoods < remainingPaid ? remainingGoods : remainingPaid;
  return cap < BigInt(0) ? BigInt(0) : cap;
}

/** Sale status reflects completed (restocked/finalized) returns only. */
async function refreshSaleReturnStatus(
  saleId: string,
  tx: Prisma.TransactionClient,
) {
  const saleItems = await tx.saleItem.findMany({
    where: { saleId },
    select: {
      id: true,
      quantity: true,
      returnItems: {
        where: {
          returnRecord: { status: "COMPLETED" },
        },
        select: { quantity: true },
      },
    },
  });
  let totalQty = 0;
  let returnedQty = 0;
  for (const item of saleItems) {
    totalQty += item.quantity;
    returnedQty += item.returnItems.reduce((sum, row) => sum + row.quantity, 0);
  }
  let status: "COMPLETED" | "PARTIALLY_RETURNED" | "RETURNED" = "COMPLETED";
  if (returnedQty <= 0) {
    status = "COMPLETED";
  } else if (returnedQty >= totalQty) {
    status = "RETURNED";
  } else {
    status = "PARTIALLY_RETURNED";
  }
  await tx.sale.update({
    where: { id: saleId },
    data: { status },
  });
}

async function assertSaleStillInReturnWindow(
  saleId: string,
  tx: Prisma.TransactionClient,
) {
  const sale = await tx.sale.findUniqueOrThrow({
    where: { id: saleId },
    select: { completedAt: true },
  });
  if (!sale.completedAt) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "Seules les ventes complétées peuvent être retournées.",
    );
  }
  const maxDays = await readReturnMaxDays(tx);
  assertReturnWindow({ soldAt: sale.completedAt, maxDays });
}

/**
 * Reduce open credit by the unpaid share of returned goods
 * (goodsValue − cashRefunded), from latest installments first.
 */
async function applyCreditWriteDownForReturn(
  tx: Prisma.TransactionClient,
  saleId: string,
  goodsValueXaf: bigint,
  cashRefundedXaf: bigint,
  actorId: string,
) {
  const credit = await tx.customerCredit.findUnique({
    where: { saleId },
    include: { installments: { orderBy: { sequence: "asc" } } },
  });
  if (!credit || credit.status === "CANCELLED" || credit.status === "PAID") {
    return;
  }

  await tx.$executeRaw`
    SELECT 1 FROM customer_credits WHERE id = ${credit.id} FOR UPDATE
  `;

  const unpaidShare =
    goodsValueXaf > cashRefundedXaf
      ? goodsValueXaf - cashRefundedXaf
      : BigInt(0);
  const writeDown =
    unpaidShare < credit.remainingXaf ? unpaidShare : credit.remainingXaf;
  if (writeDown <= BigInt(0)) {
    return;
  }

  let left = writeDown;
  for (const inst of [...credit.installments].reverse()) {
    if (left <= BigInt(0)) {
      break;
    }
    const remainingInst = inst.amountDueXaf - inst.amountPaidXaf;
    if (remainingInst <= BigInt(0)) {
      continue;
    }
    const cut = remainingInst < left ? remainingInst : left;
    const nextDue = inst.amountDueXaf - cut;
    await tx.installment.update({
      where: { id: inst.id },
      data: {
        amountDueXaf: nextDue,
        ...(nextDue <= inst.amountPaidXaf ? { status: "PAID" as const } : {}),
      },
    });
    left -= cut;
  }

  const remainingXaf = credit.remainingXaf - writeDown;
  await tx.customerCredit.update({
    where: { id: credit.id },
    data: { remainingXaf },
  });
  await refreshCreditStatusesInTx(tx, credit.id);

  await tx.auditLog.create({
    data: {
      actorId,
      action: "credit.write_down_return",
      entityType: "CustomerCredit",
      entityId: credit.id,
      afterJson: JSON.stringify({
        saleId,
        writeDownXaf: writeDown.toString(),
        remainingXaf: remainingXaf.toString(),
      }),
    },
  });
}

async function expireWarrantiesForReturnedSerials(
  tx: Prisma.TransactionClient,
  saleId: string,
  productSerialIds: string[],
) {
  const ids = productSerialIds.filter(Boolean);
  if (ids.length === 0) {
    return;
  }
  await tx.warranty.updateMany({
    where: {
      saleId,
      productSerialId: { in: ids },
      status: { in: ["ACTIVE", "CLAIMED", "INSPECTING"] },
    },
    data: { status: "EXPIRED", resolvedAt: new Date() },
  });
}

async function restockReturnIfNeeded(
  user: AuthUser,
  row: {
    id: string;
    items: Array<{
      id: string;
      variantId: string;
      quantity: number;
      restock: boolean;
      productSerialId: string | null;
    }>;
  },
  tx: Prisma.TransactionClient,
) {
  const anyMovement = await tx.stockMovement.findFirst({
    where: { returnId: row.id, type: "CUSTOMER_RETURN" },
    select: { id: true },
  });
  if (anyMovement) {
    return;
  }
  await recordCustomerReturn(
    user.id,
    row.items.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      returnId: row.id,
      returnItemId: item.id,
      productSerialId: item.productSerialId ?? undefined,
      restock: item.restock,
    })),
    { tx },
  );
}

export async function listReturnsUseCase(query: ListQuery) {
  const where: Prisma.ReturnWhereInput = {};
  if (query.status) {
    where.status = query.status;
  }
  if (query.q?.trim()) {
    const q = query.q.trim();
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      { sale: { reference: { contains: q, mode: "insensitive" } } },
      { customer: { fullName: { contains: q, mode: "insensitive" } } },
    ];
  }
  const skip = (query.page - 1) * query.pageSize;
  const [total, rows] = await Promise.all([
    prisma.return.count({ where }),
    prisma.return.findMany({
      where,
      include: {
        sale: { select: { id: true, reference: true } },
        customer: { select: { id: true, fullName: true } },
        items: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: query.pageSize,
    }),
  ]);
  return {
    items: rows.map(toReturnSummary),
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}

export async function getReturnUseCase(id: string) {
  const row = await prisma.return.findUnique({
    where: { id },
    include: RETURN_DETAIL_INCLUDE,
  });
  if (!row) {
    throw new AppError("NOT_FOUND", "Retour introuvable.");
  }
  const refundableXaf = await prisma.$transaction((tx) =>
    computeRefundableForReturn(id, tx),
  );
  return toReturnDetail({ ...row, refundableXaf });
}

export async function createReturnUseCase(user: AuthUser, input: CreateInput) {
  const maxDays = await readReturnMaxDays();

  const returnId = await prisma.$transaction(async (tx) => {
    await lockSale(tx, input.saleId);

    const sale = await tx.sale.findUnique({
      where: { id: input.saleId },
      include: {
        items: {
          include: {
            variant: {
              include: { product: { select: { isSerialized: true } } },
            },
            serial: { select: { id: true, status: true, saleItemId: true } },
            returnItems: {
              where: {
                returnRecord: {
                  status: { notIn: ["REJECTED"] },
                },
              },
              select: { quantity: true, productSerialId: true },
            },
          },
        },
      },
    });
    if (!sale || sale.status === "CANCELLED" || sale.status === "DRAFT") {
      throw new AppError("NOT_FOUND", "Vente introuvable ou non retournable.");
    }
    if (!sale.completedAt) {
      throw new AppError(
        "BUSINESS_RULE_ERROR",
        "Seules les ventes complétées peuvent être retournées.",
      );
    }
    assertReturnWindow({
      soldAt: sale.completedAt,
      maxDays,
    });

    const saleItemById = new Map(sale.items.map((item) => [item.id, item]));
    const prepared: Array<{
      saleItemId: string;
      variantId: string;
      productSerialId?: string;
      quantity: number;
    }> = [];

    for (const item of input.items) {
      const saleItem = saleItemById.get(item.saleItemId);
      if (!saleItem) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Ligne de vente introuvable pour ce retour.",
        );
      }
      const alreadyReturned = saleItem.returnItems.reduce(
        (sum, row) => sum + row.quantity,
        0,
      );
      if (alreadyReturned + item.quantity > saleItem.quantity) {
        throw new AppError(
          "BUSINESS_RULE_ERROR",
          "Quantité déjà retournée insuffisante pour cette ligne.",
        );
      }
      if (saleItem.variant.product.isSerialized) {
        if (!item.productSerialId || item.quantity !== 1) {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            "Retour sérialisé : indiquez l'appareil exact (quantité 1).",
          );
        }
        const serial =
          saleItem.serial ??
          (await tx.productSerial.findFirst({
            where: { saleItemId: saleItem.id },
            select: { id: true, status: true, saleItemId: true },
          }));
        if (!serial) {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            "Aucun appareil sérialisé lié à cette ligne de vente.",
          );
        }
        if (serial.id !== item.productSerialId) {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            "L'IMEI ne correspond pas à la ligne de vente.",
          );
        }
        if (serial.status !== "SOLD" || serial.saleItemId !== saleItem.id) {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            "L'appareil n'est pas dans un état retournable (vendu).",
          );
        }
        const alreadySerial = saleItem.returnItems.some(
          (row) => row.productSerialId === item.productSerialId,
        );
        if (alreadySerial) {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            "Cet appareil est déjà inclus dans un retour.",
          );
        }
      } else if (item.productSerialId) {
        throw new AppError(
          "BUSINESS_RULE_ERROR",
          "Produit non sérialisé : aucun IMEI attendu.",
        );
      }
      prepared.push({
        saleItemId: saleItem.id,
        variantId: saleItem.variantId,
        productSerialId: item.productSerialId,
        quantity: item.quantity,
      });
    }

    const reference = await allocateDocumentReference("RETURN", { tx });
    const created = await tx.return.create({
      data: {
        reference,
        saleId: sale.id,
        customerId: sale.customerId,
        status: "REQUESTED",
        reason: input.reason.trim(),
        requestedById: user.id,
        items: {
          create: prepared.map((item) => ({
            saleItemId: item.saleItemId,
            variantId: item.variantId,
            productSerialId: item.productSerialId ?? null,
            quantity: item.quantity,
            restock: true,
          })),
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "return.request",
        entityType: "Return",
        entityId: created.id,
        afterJson: JSON.stringify({
          reference,
          saleId: sale.id,
          itemCount: prepared.length,
          reason: input.reason.trim(),
        }),
      },
    });

    return created.id;
  });

  return getReturnUseCase(returnId);
}

export async function startInspectionUseCase(user: AuthUser, returnId: string) {
  if (!hasPermission(user.permissions, "sales.refund")) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "Permission insuffisante pour inspecter un retour.",
    );
  }
  await prisma.$transaction(async (tx) => {
    await lockReturn(tx, returnId);
    const row = await tx.return.findUnique({ where: { id: returnId } });
    if (!row) {
      throw new AppError("NOT_FOUND", "Retour introuvable.");
    }
    assertCanTransitionReturn({ from: row.status, to: "INSPECTING" });
    await tx.return.update({
      where: { id: returnId },
      data: { status: "INSPECTING", inspectedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "return.inspect",
        entityType: "Return",
        entityId: returnId,
      },
    });
  });
  return getReturnUseCase(returnId);
}

export async function acceptReturnUseCase(
  user: AuthUser,
  returnId: string,
  input: AcceptInput,
) {
  if (!hasPermission(user.permissions, "sales.refund")) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "Permission insuffisante pour accepter un retour.",
    );
  }
  await prisma.$transaction(async (tx) => {
    await lockReturn(tx, returnId);
    const row = await tx.return.findUnique({
      where: { id: returnId },
      include: { items: true },
    });
    if (!row) {
      throw new AppError("NOT_FOUND", "Retour introuvable.");
    }
    assertCanTransitionReturn({ from: row.status, to: "ACCEPTED" });
    await assertSaleStillInReturnWindow(row.saleId, tx);

    if (input.items?.length) {
      const itemIds = new Set(row.items.map((item) => item.id));
      const seen = new Set<string>();
      for (const patch of input.items) {
        if (!itemIds.has(patch.returnItemId) || seen.has(patch.returnItemId)) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Lignes de restock invalides à l'acceptation.",
          );
        }
        seen.add(patch.returnItemId);
        await tx.returnItem.update({
          where: { id: patch.returnItemId },
          data: { restock: patch.restock },
        });
      }
    }

    await tx.return.update({
      where: { id: returnId },
      data: {
        status: "ACCEPTED",
        resolution: input.resolution,
        inspectedAt: row.inspectedAt ?? new Date(),
      },
    });
    // Sale RETURNED status only after COMPLETED (restock/finalize).
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "return.accept",
        entityType: "Return",
        entityId: returnId,
        afterJson: JSON.stringify({ resolution: input.resolution }),
      },
    });
  });
  return getReturnUseCase(returnId);
}

export async function rejectReturnUseCase(
  user: AuthUser,
  returnId: string,
  input: RejectInput,
) {
  if (!hasPermission(user.permissions, "sales.refund")) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "Permission insuffisante pour rejeter un retour.",
    );
  }
  await prisma.$transaction(async (tx) => {
    await lockReturn(tx, returnId);
    const row = await tx.return.findUnique({ where: { id: returnId } });
    if (!row) {
      throw new AppError("NOT_FOUND", "Retour introuvable.");
    }
    assertCanTransitionReturn({ from: row.status, to: "REJECTED" });
    await tx.return.update({
      where: { id: returnId },
      data: {
        status: "REJECTED",
        reason: input.reason?.trim()
          ? `${row.reason ?? ""}\nRejet : ${input.reason.trim()}`.trim()
          : row.reason,
        inspectedAt: row.inspectedAt ?? new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "return.reject",
        entityType: "Return",
        entityId: returnId,
      },
    });
  });
  return getReturnUseCase(returnId);
}

export async function completeRefundUseCase(
  user: AuthUser,
  returnId: string,
  input: RefundInput,
) {
  if (!hasPermission(user.permissions, "sales.refund")) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "Permission insuffisante pour rembourser (BR-RETURN-003).",
    );
  }

  const amountXaf = parseXafAmount(input.amountXaf, "Remboursement", 1);
  const operatorReference = input.operatorReference?.trim() || null;

  const existing = await prisma.refund.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    if (existing.returnId !== returnId) {
      throw new AppError(
        "CONFLICT",
        "Cette clé d'idempotence appartient à un autre remboursement.",
      );
    }
    return getReturnUseCase(returnId);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await lockReturn(tx, returnId);
      const row = await tx.return.findUnique({
        where: { id: returnId },
        include: {
          items: {
            include: {
              saleItem: {
                select: { lineTotalXaf: true, quantity: true },
              },
            },
          },
        },
      });
      if (!row) {
        throw new AppError("NOT_FOUND", "Retour introuvable.");
      }
      if (row.status !== "ACCEPTED" || row.resolution !== "REFUND") {
        throw new AppError(
          "BUSINESS_RULE_ERROR",
          "Le retour doit être accepté en remboursement avant encaissement inverse.",
        );
      }

      await lockSale(tx, row.saleId);
      await assertSaleStillInReturnWindow(row.saleId, tx);

      const refundable = await computeRefundableForReturn(returnId, tx);
      assertRefundWithinLimit({ amountXaf, refundableXaf: refundable });

      await restockReturnIfNeeded(user, row, tx);

      await expireWarrantiesForReturnedSerials(
        tx,
        row.saleId,
        row.items
          .map((item) => item.productSerialId)
          .filter((id): id is string => Boolean(id)),
      );

      await tx.refund.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          returnId: row.id,
          amountXaf,
          method: input.method,
          operatorReference,
          recordedById: user.id,
        },
      });

      const goods = goodsValueForReturnItems(row.items);
      const refundedThis = await sumReturnRefundedXaf(returnId, tx);
      const remainingAfter = await computeRefundableForReturn(returnId, tx);

      if (remainingAfter <= BigInt(0) || refundedThis >= goods) {
        await tx.return.update({
          where: { id: returnId },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        await applyCreditWriteDownForReturn(
          tx,
          row.saleId,
          goods,
          refundedThis,
          user.id,
        );
        await refreshSaleReturnStatus(row.saleId, tx);
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "return.refund",
          entityType: "Return",
          entityId: returnId,
          afterJson: JSON.stringify({
            amountXaf: amountXaf.toString(),
            method: input.method,
            operatorReference,
            idempotencyKey: input.idempotencyKey,
          }),
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const again = await prisma.refund.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (again?.returnId === returnId) {
        return getReturnUseCase(returnId);
      }
      throw new AppError("CONFLICT", "Conflit d'idempotence sur le remboursement.");
    }
    throw error;
  }

  return getReturnUseCase(returnId);
}

export async function completeExchangeUseCase(
  user: AuthUser,
  returnId: string,
  input: ExchangeInput,
) {
  if (!hasPermission(user.permissions, "sales.refund")) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "Permission insuffisante pour finaliser un échange.",
    );
  }

  const existingKey = await prisma.return.findFirst({
    where: { completionIdempotencyKey: input.idempotencyKey },
    select: { id: true, status: true },
  });
  if (existingKey) {
    if (existingKey.id !== returnId) {
      throw new AppError(
        "CONFLICT",
        "Cette clé d'idempotence appartient à un autre échange.",
      );
    }
    return getReturnUseCase(returnId);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await lockReturn(tx, returnId);
      const row = await tx.return.findUnique({
        where: { id: returnId },
        include: {
          items: {
            include: {
              variant: {
                include: { product: { select: { isSerialized: true } } },
              },
              saleItem: {
                select: { lineTotalXaf: true, quantity: true },
              },
            },
          },
        },
      });
      if (!row) {
        throw new AppError("NOT_FOUND", "Retour introuvable.");
      }
      if (row.status === "COMPLETED" && row.resolution === "EXCHANGE") {
        return;
      }
      if (row.status !== "ACCEPTED" || row.resolution !== "EXCHANGE") {
        throw new AppError(
          "BUSINESS_RULE_ERROR",
          "Le retour doit être accepté en échange avant finalisation.",
        );
      }

      await lockSale(tx, row.saleId);
      await assertSaleStillInReturnWindow(row.saleId, tx);

      const itemById = new Map(row.items.map((item) => [item.id, item]));
      const expectedIds = [...itemById.keys()].sort();
      const inputIds = input.items.map((item) => item.returnItemId).sort();
      if (
        expectedIds.length !== inputIds.length ||
        expectedIds.some((id, index) => id !== inputIds[index])
      ) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Chaque ligne retournée doit apparaître exactement une fois.",
        );
      }

      for (const item of row.items) {
        if (!item.restock && item.variant.product.isSerialized) {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            "Échange sérialisé sans restock interdit (conflit d'appartenance appareil).",
          );
        }
      }

      await restockReturnIfNeeded(user, row, tx);

      const replacements = input.items.map((replacement) => {
        const returnItem = itemById.get(replacement.returnItemId)!;
        return {
          variantId: returnItem.variantId,
          quantity: returnItem.quantity,
          returnId: row.id,
          returnItemId: returnItem.id,
          productSerialId: replacement.replacementProductSerialId,
          isSerialized: returnItem.variant.product.isSerialized,
          saleItemId: returnItem.saleItemId,
          returnedSerialId: returnItem.productSerialId,
        };
      });

      for (const line of replacements) {
        if (line.isSerialized && !line.productSerialId) {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            "Échange sérialisé : choisissez un nouvel appareil en stock.",
          );
        }
        if (line.isSerialized && line.productSerialId) {
          const serial = await tx.productSerial.findUnique({
            where: { id: line.productSerialId },
          });
          if (
            !serial ||
            serial.variantId !== line.variantId ||
            serial.status !== "IN_STOCK"
          ) {
            throw new AppError(
              "BUSINESS_RULE_ERROR",
              "Appareil de remplacement indisponible.",
            );
          }
        }
      }

      await recordExchangeReplacement(
        user.id,
        replacements.map((line) => ({
          variantId: line.variantId,
          quantity: line.isSerialized ? 1 : line.quantity,
          returnId: line.returnId,
          returnItemId: line.returnItemId,
          productSerialId: line.productSerialId,
        })),
        { tx },
      );

      for (const line of replacements) {
        if (!line.isSerialized || !line.productSerialId) {
          continue;
        }
        await tx.productSerial.update({
          where: { id: line.productSerialId },
          data: {
            saleItemId: line.saleItemId,
            customerId: row.customerId,
            status: "SOLD",
          },
        });
        if (line.returnedSerialId) {
          await tx.warranty.updateMany({
            where: {
              productSerialId: line.returnedSerialId,
              saleId: row.saleId,
              status: { in: ["ACTIVE", "CLAIMED", "INSPECTING"] },
            },
            data: {
              productSerialId: line.productSerialId,
              saleItemId: line.saleItemId,
            },
          });
        }
      }

      const goods = goodsValueForReturnItems(row.items);
      await applyCreditWriteDownForReturn(
        tx,
        row.saleId,
        goods,
        BigInt(0),
        user.id,
      );

      await tx.return.update({
        where: { id: returnId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          completionIdempotencyKey: input.idempotencyKey,
        },
      });
      await refreshSaleReturnStatus(row.saleId, tx);

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "return.exchange",
          entityType: "Return",
          entityId: returnId,
          afterJson: JSON.stringify({
            replacements: input.items,
            idempotencyKey: input.idempotencyKey,
          }),
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const again = await prisma.return.findFirst({
        where: { completionIdempotencyKey: input.idempotencyKey },
      });
      if (again?.id === returnId) {
        return getReturnUseCase(returnId);
      }
      throw new AppError("CONFLICT", "Conflit d'idempotence sur l'échange.");
    }
    throw error;
  }

  return getReturnUseCase(returnId);
}

export async function lookupWarrantyUseCase(query: WarrantyQuery) {
  const q = query.q.trim();
  const rows = await prisma.warranty.findMany({
    where: {
      OR: [
        { reference: { equals: q, mode: "insensitive" } },
        { productSerial: { imei1: { equals: q, mode: "insensitive" } } },
        {
          productSerial: {
            serialNumber: { equals: q, mode: "insensitive" },
          },
        },
        { sale: { reference: { equals: q, mode: "insensitive" } } },
        { productSerial: { imei1: { contains: q, mode: "insensitive" } } },
      ],
    },
    take: 20,
    include: {
      sale: { select: { id: true, reference: true } },
      customer: { select: { id: true, fullName: true, phone: true } },
      productSerial: {
        select: {
          id: true,
          imei1: true,
          serialNumber: true,
          variant: { select: { sku: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  for (const row of rows) {
    if (row.status === "ACTIVE" && row.endsAt < now) {
      await prisma.warranty.update({
        where: { id: row.id },
        data: { status: "EXPIRED" },
      });
      row.status = "EXPIRED";
    }
  }

  return { items: rows.map(toWarrantyLookupItem) };
}
