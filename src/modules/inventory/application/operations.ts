import type { DeviceStatus, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { writeAudit } from "@/lib/audit/write-audit";
import { throwIfUniqueConflict } from "@/lib/db/prisma-errors";
import {
  assertSerializedIdentifiers,
  assertCanRegisterSerial,
  normalizeOptionalImei,
  normalizeOptionalSerial,
} from "@/modules/products/domain/policies";
import {
  applyStockMovement,
  type DbClient,
} from "@/modules/inventory/application/apply-movement";
import {
  assertAdjustmentQuantitySign,
  assertAdjustmentReason,
  assertCanReleaseReservation,
  assertCanReserve,
  expectedSerialStatusAfterMovement,
  isAdjustmentType,
} from "@/modules/inventory/domain/policies";

async function withInventoryTx<T>(
  existing: DbClient | undefined,
  run: (tx: DbClient) => Promise<T>,
): Promise<T> {
  if (existing) {
    return run(existing);
  }
  return prisma.$transaction((tx) => run(tx));
}

export type SerialIdentifiers = {
  imei1?: string | null;
  imei2?: string | null;
  serialNumber?: string | null;
  /** Physical condition at goods receipt. DAMAGED → device not sellable. */
  condition?: "NEW" | "DAMAGED" | null;
};

export type PurchaseReceiptLineInput = {
  variantId: string;
  quantity: number;
  goodsReceiptId: string;
  goodsReceiptItemId: string;
  /** One entry per physical unit when the product is serialized. */
  serials?: SerialIdentifiers[];
};

export async function recordPurchaseReceipt(
  recordedById: string,
  lines: PurchaseReceiptLineInput[],
  options?: { tx?: DbClient },
) {
  return withInventoryTx(options?.tx, async (tx) => {
    const movements = [];
    for (const line of lines) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        throw new AppError(
          "VALIDATION_ERROR",
          "La quantité reçue doit être un entier positif.",
        );
      }

      const variant = await tx.productVariant.findFirst({
        where: { id: line.variantId, deletedAt: null },
        include: { product: { select: { isSerialized: true } } },
      });
      if (!variant) {
        throw new AppError("NOT_FOUND", "Variante introuvable.");
      }

      if (variant.product.isSerialized) {
        const serials = line.serials ?? [];
        if (serials.length !== line.quantity) {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            `Produit sérialisé : ${line.quantity} IMEI / séries requis(es) pour la réception.`,
          );
        }
        for (const identifiers of serials) {
          const imei1 = normalizeOptionalImei(identifiers.imei1);
          const imei2 = normalizeOptionalImei(identifiers.imei2);
          const serialNumber = normalizeOptionalSerial(identifiers.serialNumber);
          assertCanRegisterSerial(true);
          assertSerializedIdentifiers({ imei1, imei2, serialNumber });
          const deviceStatus =
            identifiers.condition === "DAMAGED" ? "DAMAGED" : "IN_STOCK";

          let serial;
          try {
            serial = await tx.productSerial.create({
              data: {
                variantId: line.variantId,
                imei1,
                imei2,
                serialNumber,
                status: deviceStatus,
                goodsReceiptItemId: line.goodsReceiptItemId,
              },
            });
          } catch (error) {
            throwIfUniqueConflict(error, {
              imei1: "Cet IMEI 1 existe déjà.",
              imei2: "Cet IMEI 2 existe déjà.",
              serialNumber: "Ce numéro de série existe déjà.",
            });
          }

          movements.push(
            await applyStockMovement(tx, {
              type: "PURCHASE_RECEIPT",
              variantId: line.variantId,
              quantity: 1,
              productSerialId: serial.id,
              goodsReceiptId: line.goodsReceiptId,
              goodsReceiptItemId: line.goodsReceiptItemId,
              recordedById,
              serialStatusAfter: deviceStatus,
              reason:
                deviceStatus === "DAMAGED"
                  ? "Réception — appareil endommagé"
                  : null,
            }),
          );

          if (deviceStatus === "DAMAGED") {
            movements.push(
              await applyStockMovement(tx, {
                type: "DAMAGED",
                variantId: line.variantId,
                quantity: -1,
                productSerialId: serial.id,
                goodsReceiptId: line.goodsReceiptId,
                goodsReceiptItemId: line.goodsReceiptItemId,
                recordedById,
                serialStatusAfter: "DAMAGED",
                reason: "Réception — hors stock vendable",
              }),
            );
          }
        }
      } else {
        if (line.serials && line.serials.length > 0) {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            "Les IMEI ne s'appliquent pas aux produits non sérialisés.",
          );
        }
        movements.push(
          await applyStockMovement(tx, {
            type: "PURCHASE_RECEIPT",
            variantId: line.variantId,
            quantity: line.quantity,
            goodsReceiptId: line.goodsReceiptId,
            goodsReceiptItemId: line.goodsReceiptItemId,
            recordedById,
          }),
        );
      }
    }
    return movements;
  });
}

export type SaleDeductionInput = {
  variantId: string;
  quantity: number;
  saleId: string;
  saleItemId: string;
  productSerialId?: string;
};

export async function recordSaleDeduction(
  recordedById: string,
  lines: SaleDeductionInput[],
  options?: { tx?: DbClient },
) {
  return withInventoryTx(options?.tx, async (tx) => {
    const movements = [];
    for (const line of lines) {
      const variant = await tx.productVariant.findFirst({
        where: { id: line.variantId, deletedAt: null },
        include: { product: { select: { isSerialized: true } } },
      });
      if (!variant) {
        throw new AppError("NOT_FOUND", "Variante introuvable.");
      }

      if (variant.product.isSerialized) {
        if (!line.productSerialId || line.quantity !== 1) {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            "Vente sérialisée : un appareil et une quantité de 1 sont requis.",
          );
        }

        movements.push(
          await applyStockMovement(tx, {
            type: "SALE",
            variantId: line.variantId,
            quantity: -1,
            productSerialId: line.productSerialId,
            saleId: line.saleId,
            saleItemId: line.saleItemId,
            recordedById,
            serialStatusAfter: "SOLD",
          }),
        );

        await tx.productSerial.update({
          where: { id: line.productSerialId },
          data: { saleItemId: line.saleItemId },
        });
      } else {
        if (line.productSerialId) {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            "Produit non sérialisé : aucun IMEI attendu.",
          );
        }
        if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
          throw new AppError(
            "VALIDATION_ERROR",
            "La quantité vendue doit être un entier positif.",
          );
        }
        movements.push(
          await applyStockMovement(tx, {
            type: "SALE",
            variantId: line.variantId,
            quantity: -line.quantity,
            saleId: line.saleId,
            saleItemId: line.saleItemId,
            recordedById,
          }),
        );
      }
    }
    return movements;
  });
}

export type CustomerReturnInput = {
  variantId: string;
  quantity: number;
  returnId: string;
  returnItemId: string;
  productSerialId?: string;
  restock: boolean;
};

export async function recordCustomerReturn(
  recordedById: string,
  lines: CustomerReturnInput[],
  options?: { tx?: DbClient },
) {
  return withInventoryTx(options?.tx, async (tx) => {
    const movements = [];
    for (const line of lines) {
      if (!line.restock) {
        if (line.productSerialId) {
          await tx.productSerial.update({
            where: { id: line.productSerialId },
            data: {
              saleItemId: null,
              customerId: null,
              status: "DAMAGED",
            },
          });
        }
        continue;
      }
      const variant = await tx.productVariant.findFirst({
        where: { id: line.variantId, deletedAt: null },
        include: { product: { select: { isSerialized: true } } },
      });
      if (!variant) {
        throw new AppError("NOT_FOUND", "Variante introuvable.");
      }

      if (variant.product.isSerialized) {
        if (!line.productSerialId || line.quantity !== 1) {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            "Retour sérialisé : un appareil et une quantité de 1 sont requis.",
          );
        }
        movements.push(
          await applyStockMovement(tx, {
            type: "CUSTOMER_RETURN",
            variantId: line.variantId,
            quantity: 1,
            productSerialId: line.productSerialId,
            returnId: line.returnId,
            returnItemId: line.returnItemId,
            recordedById,
            serialStatusAfter: "IN_STOCK",
          }),
        );
        await tx.productSerial.update({
          where: { id: line.productSerialId },
          data: { saleItemId: null, customerId: null, status: "IN_STOCK" },
        });
      } else {
        movements.push(
          await applyStockMovement(tx, {
            type: "CUSTOMER_RETURN",
            variantId: line.variantId,
            quantity: line.quantity,
            returnId: line.returnId,
            returnItemId: line.returnItemId,
            recordedById,
          }),
        );
      }
    }
    return movements;
  });
}

export type SupplierReturnInput = {
  variantId: string;
  quantity: number;
  returnId?: string;
  returnItemId?: string;
  productSerialId?: string;
  reason: string;
};

export async function recordSupplierReturn(
  recordedById: string,
  lines: SupplierReturnInput[],
  options?: { tx?: DbClient },
) {
  return withInventoryTx(options?.tx, async (tx) => {
    const movements = [];
    for (const line of lines) {
      const reason = assertAdjustmentReason(line.reason);
      const variant = await tx.productVariant.findFirst({
        where: { id: line.variantId, deletedAt: null },
        include: { product: { select: { isSerialized: true } } },
      });
      if (!variant) {
        throw new AppError("NOT_FOUND", "Variante introuvable.");
      }

      if (variant.product.isSerialized) {
        if (!line.productSerialId || line.quantity !== 1) {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            "Retour fournisseur sérialisé : un appareil et une quantité de 1 sont requis.",
          );
        }
        const serial = await tx.productSerial.findUnique({
          where: { id: line.productSerialId },
        });
        if (!serial || serial.variantId !== line.variantId) {
          throw new AppError("NOT_FOUND", "Appareil sérialisé introuvable.");
        }
        if (serial.status !== "IN_STOCK" && serial.status !== "DAMAGED") {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            "Seuls les appareils en stock ou endommagés peuvent être retournés au fournisseur.",
          );
        }
        movements.push(
          await applyStockMovement(tx, {
            type: "SUPPLIER_RETURN",
            variantId: line.variantId,
            quantity: -1,
            productSerialId: serial.id,
            returnId: line.returnId,
            returnItemId: line.returnItemId,
            reason,
            recordedById,
            serialStatusAfter: "RETURNED_TO_SUPPLIER",
          }),
        );
      } else {
        if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
          throw new AppError(
            "VALIDATION_ERROR",
            "La quantité retournée doit être un entier positif.",
          );
        }
        movements.push(
          await applyStockMovement(tx, {
            type: "SUPPLIER_RETURN",
            variantId: line.variantId,
            quantity: -line.quantity,
            returnId: line.returnId,
            returnItemId: line.returnItemId,
            reason,
            recordedById,
          }),
        );
      }
    }
    return movements;
  });
}

export type ManualAdjustmentInput = {
  variantId: string;
  quantity: number;
  type?: Extract<StockMovementType, "STOCK_ADJUSTMENT" | "DAMAGED" | "LOST">;
  reason: string;
  productSerialId?: string;
  approvedById?: string;
};

export async function recordManualAdjustment(
  recordedById: string,
  input: ManualAdjustmentInput,
  options?: { tx?: DbClient },
) {
  const type = input.type ?? "STOCK_ADJUSTMENT";
  if (!isAdjustmentType(type)) {
    throw new AppError("VALIDATION_ERROR", "Type d'ajustement invalide.");
  }
  const reason = assertAdjustmentReason(input.reason);
  assertAdjustmentQuantitySign(type, input.quantity);

  const movement = await withInventoryTx(options?.tx, async (tx) => {
    const variant = await tx.productVariant.findFirst({
      where: { id: input.variantId, deletedAt: null },
      include: { product: { select: { isSerialized: true, name: true } } },
    });
    if (!variant) {
      throw new AppError("NOT_FOUND", "Variante introuvable.");
    }

    let serialStatusAfter: DeviceStatus | undefined =
      expectedSerialStatusAfterMovement(type, input.quantity);

    if (variant.product.isSerialized) {
      if (!input.productSerialId) {
        throw new AppError(
          "BUSINESS_RULE_ERROR",
          "Ajustement sérialisé : précisez l'appareil (IMEI / série).",
        );
      }
      if (Math.abs(input.quantity) !== 1) {
        throw new AppError(
          "BUSINESS_RULE_ERROR",
          "Ajustement sérialisé : quantité +1 ou -1 uniquement.",
        );
      }
      const serial = await tx.productSerial.findUnique({
        where: { id: input.productSerialId },
      });
      if (!serial || serial.variantId !== input.variantId) {
        throw new AppError("NOT_FOUND", "Appareil sérialisé introuvable.");
      }
      if (input.quantity < 0) {
        if (serial.status !== "IN_STOCK" && serial.status !== "RESERVED") {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            "Seuls les appareils en stock (ou réservés) peuvent sortir par ajustement.",
          );
        }
        if (type === "STOCK_ADJUSTMENT") {
          serialStatusAfter = "LOST";
        }
      } else {
        if (serial.status === "IN_STOCK") {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            "Cet appareil est déjà en stock.",
          );
        }
        serialStatusAfter = "IN_STOCK";
      }
    } else if (input.productSerialId) {
      throw new AppError(
        "BUSINESS_RULE_ERROR",
        "Produit non sérialisé : aucun IMEI attendu.",
      );
    }

    return applyStockMovement(tx, {
      type,
      variantId: input.variantId,
      quantity: input.quantity,
      productSerialId: input.productSerialId,
      reason,
      recordedById,
      approvedById: input.approvedById,
      serialStatusAfter,
    });
  });

  await writeAudit({
    actorId: recordedById,
    action: "inventory.adjust",
    entityType: "StockMovement",
    entityId: movement.id,
    after: {
      type: movement.type,
      variantId: movement.variantId,
      quantity: movement.quantity,
      productSerialId: movement.productSerialId,
      reason,
    },
    reason,
  });

  return movement;
}

/** Soft hold on a serialized unit (no quantity movement). V1 long-basket holds stay out of scope. */
export async function reserveSerializedDevice(
  recordedById: string,
  productSerialId: string,
  options?: { tx?: DbClient },
) {
  return withInventoryTx(options?.tx, async (tx) => {
    const serial = await tx.productSerial.findUnique({
      where: { id: productSerialId },
    });
    if (!serial) {
      throw new AppError("NOT_FOUND", "Appareil sérialisé introuvable.");
    }
    assertCanReserve(serial.status);
    const updated = await tx.productSerial.update({
      where: { id: productSerialId },
      data: { status: "RESERVED" },
    });
    await writeAudit({
      actorId: recordedById,
      action: "inventory.reserve",
      entityType: "ProductSerial",
      entityId: productSerialId,
      before: { status: "IN_STOCK" },
      after: { status: "RESERVED" },
    });
    return updated;
  });
}

export async function releaseSerializedReservation(
  recordedById: string,
  productSerialId: string,
  options?: { tx?: DbClient },
) {
  return withInventoryTx(options?.tx, async (tx) => {
    const serial = await tx.productSerial.findUnique({
      where: { id: productSerialId },
    });
    if (!serial) {
      throw new AppError("NOT_FOUND", "Appareil sérialisé introuvable.");
    }
    assertCanReleaseReservation(serial.status);
    const updated = await tx.productSerial.update({
      where: { id: productSerialId },
      data: { status: "IN_STOCK" },
    });
    await writeAudit({
      actorId: recordedById,
      action: "inventory.release_reservation",
      entityType: "ProductSerial",
      entityId: productSerialId,
      before: { status: "RESERVED" },
      after: { status: "IN_STOCK" },
    });
    return updated;
  });
}

/**
 * Deduct a same-SKU replacement during exchange.
 * Does not use saleItemId (already consumed by the original sale movement).
 * Idempotent per (returnId, returnItemId) via reason marker.
 */
export type ExchangeReplacementInput = {
  variantId: string;
  quantity: number;
  returnId: string;
  returnItemId: string;
  productSerialId?: string;
};

export async function recordExchangeReplacement(
  recordedById: string,
  lines: ExchangeReplacementInput[],
  options?: { tx?: DbClient },
) {
  return withInventoryTx(options?.tx, async (tx) => {
    const movements = [];
    for (const line of lines) {
      const reason = `EXCHANGE_OUT:${line.returnItemId}`;
      const existing = await tx.stockMovement.findFirst({
        where: { returnId: line.returnId, reason },
        select: { id: true },
      });
      if (existing) {
        continue;
      }

      const variant = await tx.productVariant.findFirst({
        where: { id: line.variantId, deletedAt: null },
        include: { product: { select: { isSerialized: true } } },
      });
      if (!variant) {
        throw new AppError("NOT_FOUND", "Variante introuvable.");
      }

      if (variant.product.isSerialized) {
        if (!line.productSerialId || line.quantity !== 1) {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            "Échange sérialisé : un appareil de remplacement (qté 1) est requis.",
          );
        }
        movements.push(
          await applyStockMovement(tx, {
            type: "SALE",
            variantId: line.variantId,
            quantity: -1,
            productSerialId: line.productSerialId,
            returnId: line.returnId,
            reason,
            recordedById,
            serialStatusAfter: "SOLD",
          }),
        );
      } else {
        if (line.productSerialId) {
          throw new AppError(
            "BUSINESS_RULE_ERROR",
            "Produit non sérialisé : aucun IMEI attendu pour l'échange.",
          );
        }
        movements.push(
          await applyStockMovement(tx, {
            type: "SALE",
            variantId: line.variantId,
            quantity: -line.quantity,
            returnId: line.returnId,
            reason,
            recordedById,
          }),
        );
      }
    }
    return movements;
  });
}
