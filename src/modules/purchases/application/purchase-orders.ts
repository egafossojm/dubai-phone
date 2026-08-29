import type { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import type { AuthUser } from "@/lib/auth/session";
import { parseXafAmount } from "@/modules/products/domain/policies";
import { allocateDocumentReference } from "@/lib/db/number-sequence";
import type {
  createPurchaseOrderSchema,
  listPurchaseOrdersQuerySchema,
  updatePurchaseOrderSchema,
} from "@/modules/purchases/api/schemas";
import {
  assertCanCancelPurchaseOrder,
  assertCanCloseRemainder,
  assertCanEditPurchaseOrder,
  assertCanSubmitPurchaseOrder,
} from "@/modules/purchases/domain/policies";
import {
  findPurchaseOrderById,
  listActiveVariantsForPurchase,
  listPurchaseOrders,
} from "@/modules/purchases/infrastructure/purchase-repository";
import {
  toPurchaseOrderDetail,
  toPurchaseOrderListItem,
} from "@/modules/purchases/application/presenters";

type ListQuery = z.infer<typeof listPurchaseOrdersQuerySchema>;
type CreateInput = z.infer<typeof createPurchaseOrderSchema>;
type UpdateInput = z.infer<typeof updatePurchaseOrderSchema>;

async function assertVariantsExist(
  items: Array<{ variantId: string }>,
): Promise<void> {
  const ids = [...new Set(items.map((item) => item.variantId))];
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true },
  });
  if (variants.length !== ids.length) {
    throw new AppError("NOT_FOUND", "Une ou plusieurs variantes sont introuvables.");
  }
}

export async function listPurchaseCatalogVariantsUseCase() {
  const variants = await listActiveVariantsForPurchase();
  return variants.map((variant) => ({
    id: variant.id,
    label: `${variant.product.name} · ${variant.sku} (${variant.name})`,
    costPriceXaf: variant.costPriceXaf.toString(),
    isSerialized: variant.product.isSerialized,
  }));
}

export async function listPurchaseOrdersUseCase(query: ListQuery) {
  const result = await listPurchaseOrders(query);
  return {
    items: result.items.map(toPurchaseOrderListItem),
    total: result.total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getPurchaseOrderUseCase(id: string) {
  const order = await findPurchaseOrderById(id);
  if (!order) {
    throw new AppError("NOT_FOUND", "Commande d'achat introuvable.");
  }
  return toPurchaseOrderDetail(order);
}

export async function createPurchaseOrderUseCase(
  user: AuthUser,
  input: CreateInput,
) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: input.supplierId, deletedAt: null },
  });
  if (!supplier) {
    throw new AppError("NOT_FOUND", "Fournisseur introuvable.");
  }
  await assertVariantsExist(input.items);

  const order = await prisma.$transaction(async (tx) => {
    const reference = await allocateDocumentReference("PURCHASE_ORDER", { tx });
    const status = input.submit ? "ORDERED" : "DRAFT";
    const created = await tx.purchaseOrder.create({
      data: {
        reference,
        supplierId: input.supplierId,
        status,
        notes: input.notes?.trim() || null,
        createdById: user.id,
        orderedAt: input.submit ? new Date() : null,
        items: {
          create: input.items.map((item) => ({
            variantId: item.variantId,
            quantityOrdered: item.quantityOrdered,
            unitCostXaf: parseXafAmount(item.unitCostXaf, "Coût unitaire"),
          })),
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: input.submit ? "purchase_order.submit" : "purchase_order.create",
        entityType: "PurchaseOrder",
        entityId: created.id,
        afterJson: JSON.stringify({
          reference: created.reference,
          status: created.status,
        }),
      },
    });

    return created;
  });

  return getPurchaseOrderUseCase(order.id);
}

export async function updatePurchaseOrderUseCase(
  user: AuthUser,
  id: string,
  input: UpdateInput,
) {
  if (input.items) {
    await assertVariantsExist(input.items);
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT 1 FROM purchase_orders WHERE id = ${id} FOR UPDATE
    `;

    const existing = await tx.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new AppError("NOT_FOUND", "Commande d'achat introuvable.");
    }
    assertCanEditPurchaseOrder(existing.status);

    await tx.purchaseOrder.update({
      where: { id },
      data: {
        notes:
          input.notes !== undefined ? input.notes.trim() || null : undefined,
      },
    });

    if (input.items) {
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      await tx.purchaseOrderItem.createMany({
        data: input.items.map((item) => ({
          purchaseOrderId: id,
          variantId: item.variantId,
          quantityOrdered: item.quantityOrdered,
          unitCostXaf: parseXafAmount(item.unitCostXaf, "Coût unitaire"),
        })),
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "purchase_order.update",
        entityType: "PurchaseOrder",
        entityId: id,
      },
    });
  });

  return getPurchaseOrderUseCase(id);
}

export async function submitPurchaseOrderUseCase(user: AuthUser, id: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT 1 FROM purchase_orders WHERE id = ${id} FOR UPDATE
    `;

    const existing = await tx.purchaseOrder.findUnique({
      where: { id },
      include: { items: { select: { id: true } } },
    });
    if (!existing) {
      throw new AppError("NOT_FOUND", "Commande d'achat introuvable.");
    }
    assertCanSubmitPurchaseOrder(existing.status);
    if (existing.items.length === 0) {
      throw new AppError("VALIDATION_ERROR", "La commande n'a aucune ligne.");
    }

    await tx.purchaseOrder.update({
      where: { id },
      data: { status: "ORDERED", orderedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "purchase_order.submit",
        entityType: "PurchaseOrder",
        entityId: id,
        afterJson: JSON.stringify({ status: "ORDERED" }),
      },
    });
  });

  return getPurchaseOrderUseCase(id);
}

export async function cancelPurchaseOrderUseCase(user: AuthUser, id: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT 1 FROM purchase_orders WHERE id = ${id} FOR UPDATE
    `;

    const existing = await tx.purchaseOrder.findUnique({
      where: { id },
      include: {
        receipts: { select: { status: true } },
      },
    });
    if (!existing) {
      throw new AppError("NOT_FOUND", "Commande d'achat introuvable.");
    }

    const hasReceipts = existing.receipts.some(
      (receipt) => receipt.status === "POSTED",
    );
    assertCanCancelPurchaseOrder(existing.status, hasReceipts);

    await tx.purchaseOrder.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "purchase_order.cancel",
        entityType: "PurchaseOrder",
        entityId: id,
        afterJson: JSON.stringify({ status: "CANCELLED" }),
      },
    });
  });

  return getPurchaseOrderUseCase(id);
}

export async function closePurchaseOrderRemainderUseCase(
  user: AuthUser,
  id: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT 1 FROM purchase_orders WHERE id = ${id} FOR UPDATE
    `;

    const existing = await tx.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new AppError("NOT_FOUND", "Commande d'achat introuvable.");
    }
    assertCanCloseRemainder(existing.status);

    await tx.purchaseOrder.update({
      where: { id },
      data: { status: "CLOSED", closedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "purchase_order.close",
        entityType: "PurchaseOrder",
        entityId: id,
        afterJson: JSON.stringify({ status: "CLOSED" }),
        reason: "Clôture du reste non reçu",
      },
    });
  });

  return getPurchaseOrderUseCase(id);
}
