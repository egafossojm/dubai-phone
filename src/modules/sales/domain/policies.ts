import { AppError } from "@/lib/errors/app-error";
import { parseXafAmount } from "@/modules/products/domain/policies";
import type { Xaf } from "@/lib/money";

export function saleStatusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "COMPLETED":
      return "Complétée";
    case "CANCELLED":
      return "Annulée";
    case "PARTIALLY_RETURNED":
      return "Retour partiel";
    case "RETURNED":
      return "Retournée";
    default:
      return status;
  }
}

export function saleKindLabel(kind: string): string {
  return kind === "INSTALLMENT" ? "Crédit" : "Comptant";
}

export function assertImmediatePaymentsCoverTotal(
  totalXaf: Xaf,
  paidXaf: Xaf,
): void {
  if (paidXaf !== totalXaf) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      `Paiement incomplet : attendu ${totalXaf.toString()} FCFA, reçu ${paidXaf.toString()} FCFA.`,
      {
        details: {
          kind: "PAYMENT_MISMATCH",
          expectedTotalXaf: totalXaf.toString(),
          receivedPaidXaf: paidXaf.toString(),
        },
      },
    );
  }
}

export function assertCustomerRequiredForInstallment(
  kind: "IMMEDIATE" | "INSTALLMENT",
  customerId: string | null | undefined,
): void {
  if (kind === "INSTALLMENT" && !customerId) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "Un client est obligatoire pour une vente à crédit.",
    );
  }
}

export function assertDownPaymentRules(options: {
  totalXaf: Xaf;
  downPaymentXaf: Xaf;
  minDownPaymentBps: number;
}): void {
  const { totalXaf, downPaymentXaf, minDownPaymentBps } = options;
  if (downPaymentXaf <= BigInt(0)) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "L'acompte crédit doit être supérieur à 0 FCFA.",
      { details: { kind: "DOWN_PAYMENT_RULE" } },
    );
  }
  if (downPaymentXaf >= totalXaf) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "L'acompte doit être inférieur au total (sinon choisissez une vente comptant).",
      { details: { kind: "DOWN_PAYMENT_RULE" } },
    );
  }
  const minRequired =
    (totalXaf * BigInt(minDownPaymentBps) + BigInt(9999)) / BigInt(10_000);
  if (downPaymentXaf < minRequired) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      `Acompte insuffisant (minimum ${minRequired.toString()} FCFA).`,
      { details: { kind: "DOWN_PAYMENT_RULE" } },
    );
  }
}

export function assertDiscountWithinCap(options: {
  subtotalXaf: Xaf;
  discountTotalXaf: Xaf;
  maxDiscountBps: number;
}): void {
  const { subtotalXaf, discountTotalXaf, maxDiscountBps } = options;
  if (discountTotalXaf < BigInt(0)) {
    throw new AppError("VALIDATION_ERROR", "La remise ne peut pas être négative.");
  }
  if (discountTotalXaf > subtotalXaf) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "La remise ne peut pas dépasser le sous-total.",
    );
  }
  if (subtotalXaf === BigInt(0)) {
    if (discountTotalXaf > BigInt(0)) {
      throw new AppError("BUSINESS_RULE_ERROR", "Remise impossible sur un panier vide.");
    }
    return;
  }
  // Exact bigint compare: discount/subtotal > maxBps/10000
  if (discountTotalXaf * BigInt(10_000) > subtotalXaf * BigInt(maxDiscountBps)) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      `Remise au-delà du plafond autorisé (${(maxDiscountBps / 100).toFixed(1)} %).`,
    );
  }
}

export function assertSerializedLine(
  isSerialized: boolean,
  quantity: number,
  productSerialId: string | undefined,
): void {
  if (isSerialized) {
    if (!productSerialId || quantity !== 1) {
      throw new AppError(
        "BUSINESS_RULE_ERROR",
        "Produit sérialisé : sélectionnez un appareil précis (quantité 1).",
      );
    }
  } else if (productSerialId) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "Produit non sérialisé : aucun IMEI attendu.",
    );
  }
}

export function splitEqualInstallments(
  remainingXaf: Xaf,
  count: number,
): Xaf[] {
  if (count < 1) {
    throw new AppError("VALIDATION_ERROR", "Nombre d'échéances invalide.");
  }
  if (remainingXaf <= BigInt(0)) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "Le solde à échelonner doit être positif.",
    );
  }
  const base = remainingXaf / BigInt(count);
  const amounts: Xaf[] = Array.from({ length: count }, () => base);
  const allocated = base * BigInt(count);
  amounts[count - 1] = amounts[count - 1]! + (remainingXaf - allocated);
  return amounts;
}

export function buildInstallmentDueDates(options: {
  count: number;
  firstDueDate?: string;
  intervalDays: number;
  now?: Date;
}): Date[] {
  const now = options.now ?? new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  let cursor: Date;
  if (options.firstDueDate) {
    const raw = options.firstDueDate.trim();
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (dateOnly) {
      cursor = new Date(
        Date.UTC(
          Number(dateOnly[1]),
          Number(dateOnly[2]) - 1,
          Number(dateOnly[3]),
        ),
      );
    } else {
      cursor = new Date(raw);
    }
    if (Number.isNaN(cursor.getTime())) {
      throw new AppError("VALIDATION_ERROR", "Date de première échéance invalide.");
    }
    const cursorDay = new Date(
      Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        cursor.getUTCDate(),
      ),
    );
    if (cursorDay < todayUtc) {
      throw new AppError(
        "BUSINESS_RULE_ERROR",
        "La première échéance ne peut pas être dans le passé.",
      );
    }
    const maxHorizon = new Date(todayUtc);
    maxHorizon.setUTCFullYear(maxHorizon.getUTCFullYear() + 1);
    if (cursorDay > maxHorizon) {
      throw new AppError(
        "BUSINESS_RULE_ERROR",
        "La première échéance ne peut pas dépasser 12 mois.",
      );
    }
    cursor = cursorDay;
  } else {
    cursor = new Date(todayUtc.getTime() + options.intervalDays * 24 * 60 * 60 * 1000);
  }
  const dates: Date[] = [];
  for (let i = 0; i < options.count; i += 1) {
    dates.push(new Date(cursor));
    cursor = new Date(
      cursor.getTime() + options.intervalDays * 24 * 60 * 60 * 1000,
    );
  }
  return dates;
}

export function parseSaleMoney(value: unknown, label: string): Xaf {
  return parseXafAmount(value, label, 0);
}

export function sumPayments(
  payments: Array<{ amountXaf: unknown }>,
): Xaf {
  return payments.reduce(
    (sum, row) => sum + parseSaleMoney(row.amountXaf, "paiement"),
    BigInt(0),
  );
}
