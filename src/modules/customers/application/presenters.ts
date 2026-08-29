import { formatXaf } from "@/lib/money";
import { creditStatusLabel } from "@/modules/credit/domain/policies";

type CreditSummary = {
  remainingXaf: bigint;
  status: string;
};

export function toCustomerListItem(customer: {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  address: string | null;
  credits?: CreditSummary[];
  _count?: { sales: number };
}) {
  const outstanding = (customer.credits ?? []).reduce(
    (sum, credit) => sum + credit.remainingXaf,
    BigInt(0),
  );
  const hasOverdue = (customer.credits ?? []).some(
    (credit) => credit.status === "OVERDUE",
  );

  return {
    id: customer.id,
    fullName: customer.fullName,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    salesCount: customer._count?.sales ?? 0,
    outstandingXaf: outstanding.toString(),
    outstandingLabel: formatXaf(outstanding),
    hasOverdue,
  };
}

export function toCustomerDetail(customer: {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date;
  sales: Array<{
    id: string;
    reference: string;
    kind: string;
    totalXaf: bigint;
    completedAt: Date | null;
    status: string;
  }>;
  credits: Array<{
    id: string;
    reference: string;
    status: string;
    totalAmountXaf: bigint;
    downPaymentXaf: bigint;
    remainingXaf: bigint;
    createdAt: Date;
    sale: { id: string; reference: string };
    installments: Array<{
      id: string;
      sequence: number;
      dueDate: Date;
      amountDueXaf: bigint;
      amountPaidXaf: bigint;
      status: string;
    }>;
  }>;
}) {
  const outstanding = customer.credits
    .filter((credit) => credit.status !== "PAID" && credit.status !== "CANCELLED")
    .reduce((sum, credit) => sum + credit.remainingXaf, BigInt(0));

  return {
    id: customer.id,
    fullName: customer.fullName,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    notes: customer.notes,
    createdAt: customer.createdAt.toISOString(),
    outstandingXaf: outstanding.toString(),
    outstandingLabel: formatXaf(outstanding),
    sales: customer.sales.map((sale) => ({
      id: sale.id,
      reference: sale.reference,
      kind: sale.kind,
      totalXaf: sale.totalXaf.toString(),
      totalLabel: formatXaf(sale.totalXaf),
      completedAt: sale.completedAt?.toISOString() ?? null,
      status: sale.status,
    })),
    credits: customer.credits.map((credit) => ({
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
      saleId: credit.sale.id,
      saleReference: credit.sale.reference,
      installments: credit.installments.map((row) => ({
        id: row.id,
        sequence: row.sequence,
        dueDate: row.dueDate.toISOString(),
        amountDueXaf: row.amountDueXaf.toString(),
        amountPaidXaf: row.amountPaidXaf.toString(),
        amountDueLabel: formatXaf(row.amountDueXaf),
        amountPaidLabel: formatXaf(row.amountPaidXaf),
        status: row.status,
      })),
    })),
  };
}
