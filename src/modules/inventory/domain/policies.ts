import { AppError } from "@/lib/errors/app-error";
import type { DeviceStatus, StockMovementType } from "@prisma/client";
import {
  deviceStatusLabel,
  stockStatusFromQuantity,
  stockStatusLabel,
} from "@/modules/products/domain/policies";

export { deviceStatusLabel, stockStatusFromQuantity, stockStatusLabel };

const ADJUSTMENT_TYPES = new Set<StockMovementType>([
  "STOCK_ADJUSTMENT",
  "DAMAGED",
  "LOST",
]);

export function assertNonZeroQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "La quantité du mouvement doit être un entier non nul.",
    );
  }
}

export function assertAdjustmentReason(reason: string | undefined): string {
  const trimmed = reason?.trim() ?? "";
  if (trimmed.length < 3) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Le motif d'ajustement est obligatoire (3 caractères minimum).",
    );
  }
  if (trimmed.length > 500) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Le motif d'ajustement est trop long (500 caractères max).",
    );
  }
  return trimmed;
}

export function assertNoNegativeStock(
  currentQty: number,
  delta: number,
  allowNegative: boolean,
): number {
  const next = currentQty + delta;
  if (next < 0 && !allowNegative) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      `Stock insuffisant (disponible : ${currentQty}, demandé : ${Math.abs(delta)}).`,
    );
  }
  return next;
}

export function isAdjustmentType(type: StockMovementType): boolean {
  return ADJUSTMENT_TYPES.has(type);
}

export function assertAdjustmentQuantitySign(
  type: StockMovementType,
  quantity: number,
): void {
  if (type === "DAMAGED" || type === "LOST") {
    if (quantity >= 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Un mouvement endommagé / perdu doit diminuer le stock (quantité négative).",
      );
    }
  }
}

export function assertDeviceSellable(status: DeviceStatus): void {
  if (status !== "IN_STOCK") {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      `Cet appareil n'est pas disponible à la vente (statut : ${deviceStatusLabel(status)}).`,
    );
  }
}

export function assertCanReserve(status: DeviceStatus): void {
  if (status !== "IN_STOCK") {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "Seuls les appareils en stock peuvent être réservés.",
    );
  }
}

export function assertCanReleaseReservation(status: DeviceStatus): void {
  if (status !== "RESERVED") {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "Cet appareil n'est pas en réservation.",
    );
  }
}

export function movementTypeLabel(type: StockMovementType): string {
  switch (type) {
    case "PURCHASE_RECEIPT":
      return "Réception achat";
    case "SALE":
      return "Vente";
    case "CUSTOMER_RETURN":
      return "Retour client";
    case "SUPPLIER_RETURN":
      return "Retour fournisseur";
    case "STOCK_ADJUSTMENT":
      return "Ajustement";
    case "DAMAGED":
      return "Endommagé";
    case "LOST":
      return "Perte";
    default:
      return type;
  }
}

export function expectedSerialStatusAfterMovement(
  type: StockMovementType,
  quantity: number,
): DeviceStatus | undefined {
  switch (type) {
    case "PURCHASE_RECEIPT":
    case "CUSTOMER_RETURN":
      return "IN_STOCK";
    case "SALE":
      return "SOLD";
    case "SUPPLIER_RETURN":
      return "RETURNED_TO_SUPPLIER";
    case "DAMAGED":
      return "DAMAGED";
    case "LOST":
      return "LOST";
    case "STOCK_ADJUSTMENT":
      if (quantity < 0) {
        return undefined;
      }
      return "IN_STOCK";
    default:
      return undefined;
  }
}
