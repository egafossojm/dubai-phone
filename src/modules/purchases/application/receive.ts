import type { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import type { AuthUser } from "@/lib/auth/session";
import { parseXafAmount } from "@/modules/products/domain/policies";
import { allocateDocumentReference } from "@/lib/db/number-sequence";
import { recordPurchaseReceipt } from "@/modules/inventory";
import type {
  listInvoicesQuerySchema,
  receivePurchaseSchema,
} from "@/modules/purchases/api/schemas";
import {
  assertCanReceivePurchaseOrder,
  assertNoOverReceive,
  derivePurchaseOrderStatusAfterReceive,
} from "@/modules/purchases/domain/policies";
import {
  findGoodsReceiptById,
  listPostedReceipts,
} from "@/modules/purchases/infrastructure/purchase-repository";
import {
  toInvoiceDetail,
  toInvoiceListItem,
} from "@/modules/purchases/application/presenters";
import { getPurchaseOrderUseCase } from "@/modules/purchases/application/purchase-orders";

type ReceiveInput = z.infer<typeof receivePurchaseSchema>;
type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;

function isIdempotencyConflict(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }
  const target = Array.isArray(error.meta?.target)
    ? (error.meta.target as string[]).join(",")
    : String(error.meta?.target ?? "");
  return target.includes("idempotencyKey");
}

async function replayExistingReceipt(idempotencyKey: string) {
  const existing = await prisma.goodsReceipt.findUnique({
    where: { idempotencyKey },
  });
  if (!existing) {
    throw new AppError(
      "CONFLICT",
      "Conflit d'idempotence sans réception existante.",
    );
  }
  return {
    receiptId: existing.id,
    reference: existing.reference,
    purchaseOrder: await getPurchaseOrderUseCase(existing.purchaseOrderId),
    replayed: true as const,
  };
}

export async function receivePurchaseUseCase(
  user: AuthUser,
  input: ReceiveInput,
) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const existing = await tx.goodsReceipt.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          return { kind: "replay" as const, receipt: existing };
        }
      }

      // Lock the purchase order header, then each line before validating remaining qty.
      await tx.$executeRaw`
        SELECT 1 FROM purchase_orders WHERE id = ${input.purchaseOrderId} FOR UPDATE
      `;

      const order = await tx.purchaseOrder.findUnique({
        where: { id: input.purchaseOrderId },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: {
                    select: { id: true, name: true, isSerialized: true },
                  },
                },
              },
            },
          },
        },
      });
      if (!order) {
        throw new AppError("NOT_FOUND", "Commande d'achat introuvable.");
      }
      assertCanReceivePurchaseOrder(order.status);

      const receiveLines = [];

      for (const line of input.lines) {
        await tx.$executeRaw`
          SELECT 1 FROM purchase_order_items WHERE id = ${line.purchaseOrderItemId} FOR UPDATE
        `;

        const lockedItem = await tx.purchaseOrderItem.findUnique({
          where: { id: line.purchaseOrderItemId },
          include: {
            variant: {
              include: {
                product: {
                  select: { id: true, name: true, isSerialized: true },
                },
              },
            },
          },
        });
        if (!lockedItem || lockedItem.purchaseOrderId !== order.id) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Ligne de commande introuvable dans cette commande.",
          );
        }

        assertNoOverReceive(
          lockedItem.quantityOrdered,
          lockedItem.quantityReceived,
          line.quantityReceived,
        );

        if (lockedItem.variant.product.isSerialized) {
          const serials = line.serials ?? [];
          if (serials.length !== line.quantityReceived) {
            throw new AppError(
              "BUSINESS_RULE_ERROR",
              `${lockedItem.variant.product.name} : ${line.quantityReceived} IMEI / séries requis(es).`,
            );
          }
        } else if (line.serials && line.serials.length > 0) {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            `${lockedItem.variant.product.name} n'est pas sérialisé.`,
          );
        }

        receiveLines.push({
          poItem: lockedItem,
          quantityReceived: line.quantityReceived,
          unitCostXaf: parseXafAmount(
            line.unitCostXaf ?? lockedItem.unitCostXaf.toString(),
            "Coût unitaire",
          ),
          serials: (line.serials ?? []).map((serial) => ({
            imei1: serial.imei1,
            imei2: serial.imei2,
            serialNumber: serial.serialNumber,
            condition: serial.condition ?? "NEW",
          })),
        });
      }

      const reference = await allocateDocumentReference("GOODS_RECEIPT", { tx });
      const receipt = await tx.goodsReceipt.create({
        data: {
          reference,
          purchaseOrderId: order.id,
          status: "DRAFT",
          idempotencyKey: input.idempotencyKey ?? null,
          receivedAt: new Date(),
        },
      });

      const createdItems: Array<{
        id: string;
        variantId: string;
        quantityReceived: number;
        serials: Array<{
          imei1?: string | null;
          imei2?: string | null;
          serialNumber?: string | null;
          condition?: "NEW" | "DAMAGED" | null;
        }>;
      }> = [];

      for (const line of receiveLines) {
        const item = await tx.goodsReceiptItem.create({
          data: {
            goodsReceiptId: receipt.id,
            purchaseOrderItemId: line.poItem.id,
            variantId: line.poItem.variantId,
            quantityReceived: line.quantityReceived,
            unitCostXaf: line.unitCostXaf,
          },
        });

        await tx.purchaseOrderItem.update({
          where: { id: line.poItem.id },
          data: {
            quantityReceived: {
              increment: line.quantityReceived,
            },
          },
        });

        await tx.productVariant.update({
          where: { id: line.poItem.variantId },
          data: { costPriceXaf: line.unitCostXaf },
        });

        createdItems.push({
          id: item.id,
          variantId: line.poItem.variantId,
          quantityReceived: line.quantityReceived,
          serials: line.serials,
        });
      }

      await recordPurchaseReceipt(
        user.id,
        createdItems.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantityReceived,
          goodsReceiptId: receipt.id,
          goodsReceiptItemId: item.id,
          serials: item.serials,
        })),
        { tx },
      );

      const refreshedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: order.id },
        select: { quantityOrdered: true, quantityReceived: true },
      });
      const nextStatus = derivePurchaseOrderStatusAfterReceive(refreshedItems);

      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: nextStatus },
      });

      const posted = await tx.goodsReceipt.update({
        where: { id: receipt.id },
        data: {
          status: "POSTED",
          postedAt: new Date(),
          postedById: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "purchase.receive",
          entityType: "GoodsReceipt",
          entityId: posted.id,
          afterJson: JSON.stringify({
            reference: posted.reference,
            purchaseOrderId: order.id,
            purchaseOrderStatus: nextStatus,
            lines: receiveLines.map((line) => ({
              purchaseOrderItemId: line.poItem.id,
              quantity: line.quantityReceived,
              unitCostXaf: line.unitCostXaf.toString(),
            })),
          }),
          reason: input.notes?.trim() || undefined,
        },
      });

      return {
        kind: "created" as const,
        receipt: posted,
        nextStatus,
        purchaseOrderId: order.id,
      };
    });

    if (result.kind === "replay") {
      return {
        receiptId: result.receipt.id,
        reference: result.receipt.reference,
        purchaseOrder: await getPurchaseOrderUseCase(result.receipt.purchaseOrderId),
        replayed: true as const,
      };
    }

    return {
      receiptId: result.receipt.id,
      reference: result.receipt.reference,
      purchaseOrder: await getPurchaseOrderUseCase(result.purchaseOrderId),
      replayed: false as const,
    };
  } catch (error) {
    if (input.idempotencyKey && isIdempotencyConflict(error)) {
      return replayExistingReceipt(input.idempotencyKey);
    }
    throw error;
  }
}

export async function listPurchaseInvoicesUseCase(query: ListInvoicesQuery) {
  const result = await listPostedReceipts(query);
  return {
    items: result.items.map(toInvoiceListItem),
    total: result.total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getPurchaseInvoiceUseCase(id: string) {
  const receipt = await findGoodsReceiptById(id);
  if (!receipt || receipt.status !== "POSTED") {
    throw new AppError("NOT_FOUND", "Facture / réception introuvable.");
  }
  return toInvoiceDetail(receipt);
}
