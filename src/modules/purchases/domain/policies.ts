import { AppError } from "@/lib/errors/app-error";
import type { PurchaseOrderStatus } from "@prisma/client";

export function purchaseOrderStatusLabel(status: PurchaseOrderStatus): string {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "ORDERED":
      return "Commandée";
    case "PARTIALLY_RECEIVED":
      return "Réception partielle";
    case "RECEIVED":
      return "Réceptionnée";
    case "CANCELLED":
      return "Annulée";
    case "CLOSED":
      return "Clôturée";
    default:
      return status;
  }
}

export function goodsReceiptStatusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "POSTED":
      return "Validée";
    case "CANCELLED":
      return "Annulée";
    default:
      return status;
  }
}

export function assertCanEditPurchaseOrder(status: PurchaseOrderStatus): void {
  if (status !== "DRAFT") {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "Seules les commandes brouillon peuvent être modifiées.",
    );
  }
}

export function assertCanSubmitPurchaseOrder(status: PurchaseOrderStatus): void {
  if (status !== "DRAFT") {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "Seules les commandes brouillon peuvent être confirmées.",
    );
  }
}

export function assertCanCancelPurchaseOrder(
  status: PurchaseOrderStatus,
  hasReceipts: boolean,
): void {
  if (hasReceipts || status === "PARTIALLY_RECEIVED" || status === "RECEIVED") {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "Impossible d'annuler après une réception. Clôturez le reste non reçu.",
    );
  }
  if (status !== "DRAFT" && status !== "ORDERED") {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "Cette commande ne peut plus être annulée.",
    );
  }
}

export function assertCanReceivePurchaseOrder(status: PurchaseOrderStatus): void {
  if (status !== "ORDERED" && status !== "PARTIALLY_RECEIVED") {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "La réception n'est possible que pour une commande confirmée ou partiellement reçue.",
    );
  }
}

export function assertCanCloseRemainder(status: PurchaseOrderStatus): void {
  if (status !== "PARTIALLY_RECEIVED") {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "La clôture du reste s'applique aux commandes partiellement reçues.",
    );
  }
}

export function assertNoOverReceive(
  quantityOrdered: number,
  quantityAlreadyReceived: number,
  quantityNow: number,
): void {
  if (quantityNow <= 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "La quantité reçue doit être un entier positif.",
    );
  }
  const remaining = quantityOrdered - quantityAlreadyReceived;
  if (quantityNow > remaining) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      `Sur-réception interdite (restant : ${remaining}, demandé : ${quantityNow}).`,
    );
  }
}

export function derivePurchaseOrderStatusAfterReceive(items: {
  quantityOrdered: number;
  quantityReceived: number;
}[]): "PARTIALLY_RECEIVED" | "RECEIVED" {
  const allReceived = items.every(
    (item) => item.quantityReceived >= item.quantityOrdered,
  );
  return allReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";
}
