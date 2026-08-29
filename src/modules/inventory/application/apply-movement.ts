import type {
  DeviceStatus,
  Prisma,
  StockMovement,
  StockMovementType,
} from "@prisma/client";
import { AppError } from "@/lib/errors/app-error";
import { throwIfUniqueConflict } from "@/lib/db/prisma-errors";
import {
  assertNoNegativeStock,
  assertNonZeroQuantity,
  assertDeviceSellable,
} from "@/modules/inventory/domain/policies";

export type DbClient = Prisma.TransactionClient;

export type ApplyMovementInput = {
  type: StockMovementType;
  variantId: string;
  quantity: number;
  productSerialId?: string | null;
  goodsReceiptId?: string | null;
  goodsReceiptItemId?: string | null;
  saleId?: string | null;
  saleItemId?: string | null;
  returnId?: string | null;
  returnItemId?: string | null;
  reason?: string | null;
  recordedById: string;
  approvedById?: string | null;
  allowNegative?: boolean;
  serialStatusAfter?: DeviceStatus | null;
};

/**
 * Authoritative stock mutation: creates an immutable StockMovement and updates
 * the variant quantityOnHand cache in the same transaction.
 */
export async function applyStockMovement(
  tx: DbClient,
  input: ApplyMovementInput,
): Promise<StockMovement> {
  assertNonZeroQuantity(input.quantity);

  // Row lock prevents concurrent lost updates on the quantity cache.
  const locked = await tx.$queryRaw<
    Array<{ id: string; quantityOnHand: number; isSerialized: boolean }>
  >`
    SELECT v.id, v."quantityOnHand", p."isSerialized"
    FROM product_variants v
    INNER JOIN products p ON p.id = v."productId"
    WHERE v.id = ${input.variantId} AND v."deletedAt" IS NULL
    FOR UPDATE OF v
  `;
  const variant = locked[0];
  if (!variant) {
    throw new AppError("NOT_FOUND", "Variante introuvable.");
  }

  if (input.saleItemId) {
    const duplicate = await tx.stockMovement.findFirst({
      where: { saleItemId: input.saleItemId },
      select: { id: true },
    });
    if (duplicate) {
      throw new AppError(
        "CONFLICT",
        "Un mouvement de stock existe déjà pour cette ligne de vente.",
      );
    }
  }

  if (input.returnItemId) {
    const duplicate = await tx.stockMovement.findFirst({
      where: { returnItemId: input.returnItemId },
      select: { id: true },
    });
    if (duplicate) {
      throw new AppError(
        "CONFLICT",
        "Un mouvement de stock existe déjà pour cette ligne de retour.",
      );
    }
  }

  if (input.goodsReceiptItemId && input.type === "PURCHASE_RECEIPT") {
    const duplicate = await tx.stockMovement.findFirst({
      where: {
        goodsReceiptItemId: input.goodsReceiptItemId,
        type: "PURCHASE_RECEIPT",
        ...(input.productSerialId
          ? { productSerialId: input.productSerialId }
          : { productSerialId: null }),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new AppError(
        "CONFLICT",
        input.productSerialId
          ? "Un mouvement de réception existe déjà pour cet appareil."
          : "Un mouvement de réception existe déjà pour cette ligne de réception.",
      );
    }
  }

  if (input.productSerialId) {
    const lockedSerials = await tx.$queryRaw<
      Array<{ id: string; variantId: string; status: DeviceStatus }>
    >`
      SELECT id, "variantId", status
      FROM product_serials
      WHERE id = ${input.productSerialId}
      FOR UPDATE
    `;
    const serial = lockedSerials[0];
    if (!serial) {
      throw new AppError("NOT_FOUND", "Appareil sérialisé introuvable.");
    }
    if (serial.variantId !== input.variantId) {
      throw new AppError(
        "BUSINESS_RULE_ERROR",
        "L'appareil n'appartient pas à cette variante.",
      );
    }
    if (input.type === "SALE") {
      assertDeviceSellable(serial.status);
    }
  }

  const nextQty = assertNoNegativeStock(
    variant.quantityOnHand,
    input.quantity,
    input.allowNegative === true,
  );

  let movement: StockMovement;
  try {
    movement = await tx.stockMovement.create({
      data: {
        type: input.type,
        variantId: input.variantId,
        quantity: input.quantity,
        productSerialId: input.productSerialId ?? null,
        goodsReceiptId: input.goodsReceiptId ?? null,
        goodsReceiptItemId: input.goodsReceiptItemId ?? null,
        saleId: input.saleId ?? null,
        saleItemId: input.saleItemId ?? null,
        returnId: input.returnId ?? null,
        returnItemId: input.returnItemId ?? null,
        reason: input.reason ?? null,
        recordedById: input.recordedById,
        approvedById: input.approvedById ?? null,
      },
    });
  } catch (error) {
    throwIfUniqueConflict(error, {
      goodsReceiptItemId:
        "Un mouvement de réception existe déjà pour cette ligne de réception.",
      saleItemId: "Un mouvement de stock existe déjà pour cette ligne de vente.",
      returnItemId:
        "Un mouvement de stock existe déjà pour cette ligne de retour.",
    });
  }

  await tx.productVariant.update({
    where: { id: input.variantId },
    data: { quantityOnHand: nextQty },
  });

  if (input.productSerialId && input.serialStatusAfter) {
    if (input.type === "SALE" && input.serialStatusAfter === "SOLD") {
      const sold = await tx.productSerial.updateMany({
        where: { id: input.productSerialId, status: "IN_STOCK" },
        data: { status: "SOLD" },
      });
      if (sold.count !== 1) {
        throw new AppError(
          "BUSINESS_RULE_ERROR",
          "Cet appareil n'est plus disponible à la vente.",
        );
      }
    } else {
      await tx.productSerial.update({
        where: { id: input.productSerialId },
        data: { status: input.serialStatusAfter },
      });
    }
  }

  return movement;
}

export async function sumMovementsForVariant(
  tx: DbClient,
  variantId: string,
): Promise<number> {
  const result = await tx.stockMovement.aggregate({
    where: { variantId },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}
