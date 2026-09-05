/**
 * Immutable receipt payload frozen at CompleteSale.
 * Amounts stored as decimal strings (BigInt-safe).
 */
export type ReceiptSnapshotV1 = {
  version: 1;
  store: {
    name: string;
    address: string | null;
    city: string | null;
    country: string | null;
    phone: string | null;
    email: string | null;
  };
  receiptReference: string;
  saleReference: string;
  saleKind: string;
  completedAt: string;
  cashierName: string;
  customer: { fullName: string; phone: string } | null;
  subtotalXaf: string;
  /** Sum of line discounts only. */
  lineDiscountTotalXaf: string;
  /** Sale-scope discount only. */
  globalDiscountXaf: string;
  totalXaf: string;
  credit: {
    reference: string;
    remainingXaf: string;
  } | null;
  lines: Array<{
    name: string;
    sku: string;
    quantity: number;
    unitPriceXaf: string;
    discountXaf: string;
    lineTotalXaf: string;
    serial: {
      imei1: string | null;
      imei2: string | null;
      serialNumber: string | null;
    } | null;
    warranty: {
      reference: string;
      startsAt: string;
      endsAt: string;
    } | null;
  }>;
  payments: Array<{
    method: string;
    amountXaf: string;
    operatorReference: string | null;
  }>;
};

export function isReceiptSnapshotV1(value: unknown): value is ReceiptSnapshotV1 {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as { version?: unknown };
  return row.version === 1;
}
