import { AppError } from "@/lib/errors/app-error";
import type { Xaf } from "@/lib/money";

export function returnStatusLabel(status: string): string {
  switch (status) {
    case "REQUESTED":
      return "Demandé";
    case "INSPECTING":
      return "Inspection";
    case "ACCEPTED":
      return "Accepté";
    case "REJECTED":
      return "Rejeté";
    case "COMPLETED":
      return "Terminé";
    default:
      return status;
  }
}

export function returnResolutionLabel(resolution: string | null | undefined): string {
  switch (resolution) {
    case "REFUND":
      return "Remboursement";
    case "EXCHANGE":
      return "Échange";
    default:
      return "—";
  }
}

export function warrantyStatusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "CLAIMED":
      return "Réclamée";
    case "INSPECTING":
      return "Inspection";
    case "RESOLVED":
      return "Résolue";
    case "EXPIRED":
      return "Expirée";
    default:
      return status;
  }
}

export function deriveWarrantyStatus(options: {
  status: string;
  endsAt: Date;
  now?: Date;
}): string {
  const now = options.now ?? new Date();
  if (
    options.status === "ACTIVE" &&
    options.endsAt.getTime() < now.getTime()
  ) {
    return "EXPIRED";
  }
  return options.status;
}

export function assertReturnWindow(options: {
  soldAt: Date;
  maxDays: number;
  now?: Date;
}): void {
  const now = options.now ?? new Date();
  const deadline = new Date(options.soldAt);
  deadline.setUTCDate(deadline.getUTCDate() + options.maxDays);
  if (now.getTime() > deadline.getTime()) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      `Délai de retour dépassé (${options.maxDays} jours).`,
    );
  }
}

export function assertRefundWithinLimit(options: {
  amountXaf: Xaf;
  refundableXaf: Xaf;
}): void {
  if (options.amountXaf <= BigInt(0)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Le montant du remboursement doit être supérieur à 0 FCFA.",
    );
  }
  if (options.amountXaf > options.refundableXaf) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      `Remboursement trop élevé (maximum ${options.refundableXaf.toString()} FCFA).`,
    );
  }
}

export function assertCanTransitionReturn(options: {
  from: string;
  to: string;
}): void {
  const allowed: Record<string, string[]> = {
    REQUESTED: ["INSPECTING"],
    INSPECTING: ["ACCEPTED", "REJECTED"],
    ACCEPTED: ["COMPLETED"],
  };
  const next = allowed[options.from] ?? [];
  if (!next.includes(options.to)) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      `Transition de retour interdite : ${options.from} → ${options.to}.`,
    );
  }
}

export function computeReturnedGoodsValue(options: {
  items: Array<{ lineTotalXaf: Xaf; saleQuantity: number; returnQuantity: number }>;
}): Xaf {
  let total = BigInt(0);
  for (const item of options.items) {
    if (item.returnQuantity <= 0 || item.saleQuantity <= 0) {
      continue;
    }
    if (item.returnQuantity > item.saleQuantity) {
      throw new AppError(
        "BUSINESS_RULE_ERROR",
        "La quantité retournée dépasse la quantité vendue.",
      );
    }
    // Proportional line value (integer division; remainder stays with unsold qty).
    const share =
      (item.lineTotalXaf * BigInt(item.returnQuantity)) /
      BigInt(item.saleQuantity);
    total += share;
  }
  return total;
}
