import { formatXaf } from "@/lib/money";
import {
  creditStatusLabel,
  installmentStatusLabel,
  paymentMethodLabel,
} from "@/modules/credit/domain/policies";

export function toCreditListItem(credit: {
  id: string;
  reference: string;
  status: string;
  totalAmountXaf: bigint;
  downPaymentXaf: bigint;
  remainingXaf: bigint;
  createdAt: Date;
  customer: { id: string; fullName: string; phone: string };
  sale: { id: string; reference: string };
  installments: Array<{
    dueDate: Date;
    amountDueXaf: bigint;
    amountPaidXaf: bigint;
    status: string;
  }>;
}) {
  const overdueCount = credit.installments.filter(
    (row) =>
      row.status === "OVERDUE" ||
      (row.amountPaidXaf < row.amountDueXaf &&
        row.dueDate.getTime() < Date.now()),
  ).length;

  return {
    id: credit.id,
    reference: credit.reference,
    status: credit.status,
    statusLabel: creditStatusLabel(credit.status),
    totalAmountXaf: credit.totalAmountXaf.toString(),
    totalAmountLabel: formatXaf(credit.totalAmountXaf),
    downPaymentXaf: credit.downPaymentXaf.toString(),
    downPaymentLabel: formatXaf(credit.downPaymentXaf),
    remainingXaf: credit.remainingXaf.toString(),
    remainingLabel: formatXaf(credit.remainingXaf),
    createdAt: credit.createdAt.toISOString(),
    customerId: credit.customer.id,
    customerName: credit.customer.fullName,
    customerPhone: credit.customer.phone,
    saleId: credit.sale.id,
    saleReference: credit.sale.reference,
    overdueInstallments: overdueCount,
  };
}

export function toCreditDetail(credit: {
  id: string;
  reference: string;
  status: string;
  totalAmountXaf: bigint;
  downPaymentXaf: bigint;
  remainingXaf: bigint;
  createdAt: Date;
  customer: { id: string; fullName: string; phone: string };
  sale: { id: string; reference: string; completedAt: Date | null };
  installments: Array<{
    id: string;
    sequence: number;
    dueDate: Date;
    amountDueXaf: bigint;
    amountPaidXaf: bigint;
    status: string;
  }>;
  payments: Array<{
    id: string;
    method: string;
    amountXaf: bigint;
    operatorReference: string | null;
    paidAt: Date;
    idempotencyKey: string;
    recordedBy: { id: string; fullName: string };
    installment: { id: string; sequence: number } | null;
    allocations: Array<{
      amountXaf: bigint;
      installment: { id: string; sequence: number };
    }>;
  }>;
}) {
  return {
    ...toCreditListItem(credit),
    saleCompletedAt: credit.sale.completedAt?.toISOString() ?? null,
    installments: credit.installments.map((row) => ({
      id: row.id,
      sequence: row.sequence,
      dueDate: row.dueDate.toISOString(),
      amountDueXaf: row.amountDueXaf.toString(),
      amountPaidXaf: row.amountPaidXaf.toString(),
      amountDueLabel: formatXaf(row.amountDueXaf),
      amountPaidLabel: formatXaf(row.amountPaidXaf),
      remainingXaf: (row.amountDueXaf - row.amountPaidXaf).toString(),
      remainingLabel: formatXaf(row.amountDueXaf - row.amountPaidXaf),
      status: row.status,
      statusLabel: installmentStatusLabel(row.status),
    })),
    payments: credit.payments.map((payment) => ({
      id: payment.id,
      method: payment.method,
      methodLabel: paymentMethodLabel(payment.method),
      amountXaf: payment.amountXaf.toString(),
      amountLabel: formatXaf(payment.amountXaf),
      operatorReference: payment.operatorReference,
      paidAt: payment.paidAt.toISOString(),
      idempotencyKey: payment.idempotencyKey,
      recordedByName: payment.recordedBy.fullName,
      installmentSequence: payment.installment?.sequence ?? null,
      allocations: payment.allocations.map((row) => ({
        installmentSequence: row.installment.sequence,
        amountXaf: row.amountXaf.toString(),
        amountLabel: formatXaf(row.amountXaf),
      })),
    })),
  };
}
