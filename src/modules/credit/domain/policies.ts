import type { CreditStatus, InstallmentStatus } from "@prisma/client";
import { AppError } from "@/lib/errors/app-error";
import { parseXafAmount } from "@/modules/products/domain/policies";

export function creditStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "En attente";
    case "ACTIVE":
      return "Actif";
    case "PARTIALLY_PAID":
      return "Partiellement payé";
    case "OVERDUE":
      return "En retard";
    case "PAID":
      return "Payé";
    case "DEFAULTED":
      return "Défaut";
    case "CANCELLED":
      return "Annulé";
    default:
      return status;
  }
}

export function installmentStatusLabel(status: string): string {
  switch (status) {
    case "DUE":
      return "À payer";
    case "PARTIAL":
      return "Partiel";
    case "PAID":
      return "Payée";
    case "OVERDUE":
      return "En retard";
    case "CANCELLED":
      return "Annulée";
    default:
      return status;
  }
}

export function paymentMethodLabel(method: string): string {
  switch (method) {
    case "CASH":
      return "Espèces";
    case "ORANGE_MONEY":
      return "Orange Money";
    case "MTN_MOBILE_MONEY":
      return "MTN MoMo";
    default:
      return method;
  }
}

export function assertPositivePaymentAmount(amountXaf: bigint): void {
  if (amountXaf <= BigInt(0)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Le montant du paiement doit être un entier positif.",
    );
  }
}

export function assertNoOverpayment(
  remainingXaf: bigint,
  paymentXaf: bigint,
): void {
  if (paymentXaf > remainingXaf) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      `Surpaiement refusé (reste dû : ${remainingXaf.toString()} FCFA).`,
    );
  }
}

export function assertCreditAcceptsPayment(status: CreditStatus): void {
  if (status === "PAID" || status === "CANCELLED" || status === "DEFAULTED") {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "Ce crédit n'accepte plus de paiements.",
    );
  }
}

export function startOfUtcDay(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function deriveInstallmentStatus(input: {
  dueDate: Date;
  amountDueXaf: bigint;
  amountPaidXaf: bigint;
  now?: Date;
}): InstallmentStatus {
  if (input.amountPaidXaf >= input.amountDueXaf) {
    return "PAID";
  }
  const today = startOfUtcDay(input.now);
  const due = startOfUtcDay(input.dueDate);
  if (due < today) {
    return "OVERDUE";
  }
  if (input.amountPaidXaf > BigInt(0)) {
    return "PARTIAL";
  }
  return "DUE";
}

/**
 * MVP status derivation (docs/business/06-states-transitions.md + prompt 008):
 * PAID → OVERDUE → PARTIALLY_PAID → PENDING
 * (ACTIVE is treated as PENDING for display when no installment payment yet)
 */
export function deriveCreditStatus(input: {
  remainingXaf: bigint;
  totalAmountXaf: bigint;
  downPaymentXaf: bigint;
  installments: Array<{
    dueDate: Date;
    amountDueXaf: bigint;
    amountPaidXaf: bigint;
    status: InstallmentStatus;
  }>;
  now?: Date;
}): CreditStatus {
  if (input.remainingXaf <= BigInt(0)) {
    return "PAID";
  }

  const hasOverdue = input.installments.some((row) => {
    if (row.amountPaidXaf >= row.amountDueXaf) {
      return false;
    }
    return deriveInstallmentStatus({ ...row, now: input.now }) === "OVERDUE";
  });
  if (hasOverdue) {
    return "OVERDUE";
  }

  const financed = input.totalAmountXaf - input.downPaymentXaf;
  if (input.remainingXaf < financed) {
    return "PARTIALLY_PAID";
  }

  return "PENDING";
}

export function parsePaymentAmount(raw: string | number | bigint): bigint {
  return parseXafAmount(raw, "Montant du paiement");
}
