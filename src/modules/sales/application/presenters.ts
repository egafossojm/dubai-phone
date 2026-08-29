import { formatXaf } from "@/lib/money";
import {
  saleKindLabel,
  saleStatusLabel,
} from "@/modules/sales/domain/policies";
import { paymentMethodLabel } from "@/modules/credit/domain/policies";

export function toSaleSummary(sale: {
  id: string;
  reference: string;
  kind: string;
  status: string;
  subtotalXaf: bigint;
  discountTotalXaf: bigint;
  totalXaf: bigint;
  completedAt: Date | null;
  customer: { id: string; fullName: string; phone: string } | null;
  receipt: { id: string; reference: string } | null;
  credit: { id: string; reference: string; remainingXaf: bigint } | null;
  soldBy?: { fullName: string } | null;
}) {
  return {
    id: sale.id,
    reference: sale.reference,
    kind: sale.kind,
    kindLabel: saleKindLabel(sale.kind),
    status: sale.status,
    statusLabel: saleStatusLabel(sale.status),
    subtotalXaf: sale.subtotalXaf.toString(),
    subtotalLabel: formatXaf(sale.subtotalXaf),
    discountTotalXaf: sale.discountTotalXaf.toString(),
    discountTotalLabel: formatXaf(sale.discountTotalXaf),
    totalXaf: sale.totalXaf.toString(),
    totalLabel: formatXaf(sale.totalXaf),
    completedAt: sale.completedAt?.toISOString() ?? null,
    soldByName: sale.soldBy?.fullName ?? null,
    customer: sale.customer
      ? {
          id: sale.customer.id,
          fullName: sale.customer.fullName,
          phone: sale.customer.phone,
        }
      : null,
    receiptReference: sale.receipt?.reference ?? null,
    creditId: sale.credit?.id ?? null,
    creditReference: sale.credit?.reference ?? null,
    creditRemainingLabel: sale.credit
      ? formatXaf(sale.credit.remainingXaf)
      : null,
  };
}

export function toSaleDetail(sale: {
  id: string;
  reference: string;
  clientTxnId: string;
  kind: string;
  status: string;
  notes: string | null;
  subtotalXaf: bigint;
  discountTotalXaf: bigint;
  totalXaf: bigint;
  completedAt: Date | null;
  customer: { id: string; fullName: string; phone: string } | null;
  soldBy: { id: string; fullName: string };
  receipt: { id: string; reference: string } | null;
  credit: {
    id: string;
    reference: string;
    remainingXaf: bigint;
    downPaymentXaf: bigint;
  } | null;
  items: Array<{
    id: string;
    quantity: number;
    unitPriceXaf: bigint;
    discountXaf: bigint;
    lineTotalXaf: bigint;
    variant: {
      id: string;
      sku: string;
      name: string;
      product: { name: string; isSerialized: boolean };
    };
    serial: {
      id: string;
      imei1: string | null;
      serialNumber: string | null;
    } | null;
  }>;
  payments: Array<{
    id: string;
    method: string;
    amountXaf: bigint;
    operatorReference: string | null;
    paidAt: Date;
  }>;
}) {
  return {
    ...toSaleSummary(sale),
    notes: sale.notes,
    soldByName: sale.soldBy.fullName,
    items: sale.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      sku: item.variant.sku,
      name: `${item.variant.product.name} — ${item.variant.name}`,
      isSerialized: item.variant.product.isSerialized,
      unitPriceXaf: item.unitPriceXaf.toString(),
      unitPriceLabel: formatXaf(item.unitPriceXaf),
      discountXaf: item.discountXaf.toString(),
      lineTotalXaf: item.lineTotalXaf.toString(),
      lineTotalLabel: formatXaf(item.lineTotalXaf),
      serial: item.serial
        ? {
            id: item.serial.id,
            imei1: item.serial.imei1,
            serialNumber: item.serial.serialNumber,
          }
        : null,
    })),
    payments: sale.payments.map((payment) => ({
      id: payment.id,
      method: payment.method,
      methodLabel: paymentMethodLabel(payment.method),
      amountXaf: payment.amountXaf.toString(),
      amountLabel: formatXaf(payment.amountXaf),
      operatorReference: payment.operatorReference,
      paidAt: payment.paidAt.toISOString(),
    })),
  };
}
