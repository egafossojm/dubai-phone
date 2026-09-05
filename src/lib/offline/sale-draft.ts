import { normalizeMoneyInput, xaf, type Xaf } from "@/lib/money";
import type { OfflineSalePayload } from "@/lib/offline/types";

export type SaleLineDraft = {
  variantId: string;
  quantity: number;
  productSerialId?: string;
  discountXaf: number | string;
};

export type PaymentLineDraft = {
  method: "CASH" | "ORANGE_MONEY" | "MTN_MOBILE_MONEY";
  amountXaf: string;
  operatorReference: string;
  idempotencyKey: string;
};

export function sumPaymentLineDrafts(rows: PaymentLineDraft[]): Xaf {
  return rows.reduce(
    (sum, row) => sum + xaf(normalizeMoneyInput(row.amountXaf)),
    BigInt(0),
  );
}

export function buildOfflineSalePayload(options: {
  clientTxnId: string;
  kind: "IMMEDIATE" | "INSTALLMENT";
  customerId: string | null;
  globalDiscount: string;
  cart: SaleLineDraft[];
  payments: PaymentLineDraft[];
  installmentCount: string;
  intervalDays: string;
  firstDueDate: string;
}): OfflineSalePayload {
  return {
    clientTxnId: options.clientTxnId,
    kind: options.kind,
    customerId: options.customerId || undefined,
    discountTotalXaf: normalizeMoneyInput(options.globalDiscount),
    items: options.cart.map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
      productSerialId: line.productSerialId,
      discountXaf: normalizeMoneyInput(String(line.discountXaf)),
    })),
    payments: options.payments.map((row) => ({
      method: row.method,
      amountXaf: normalizeMoneyInput(row.amountXaf),
      idempotencyKey: row.idempotencyKey,
      operatorReference: row.operatorReference || undefined,
    })),
    installmentPlan:
      options.kind === "INSTALLMENT"
        ? {
            installmentCount:
              Number.parseInt(options.installmentCount, 10) || 1,
            intervalDays: Number.parseInt(options.intervalDays, 10) || 30,
            firstDueDate: options.firstDueDate || undefined,
          }
        : undefined,
  };
}
