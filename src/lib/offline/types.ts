export type OutboxLocalStatus =
  | "PENDING_SYNC"
  | "SYNCING"
  | "SYNCED"
  | "FAILED"
  | "CONFLICT";

export type OfflineCatalogItem = {
  variantId: string;
  sku: string;
  name: string;
  sellingPriceXaf: string;
  sellingPriceLabel: string;
  isSerialized: boolean;
  quantityAvailable: number;
};

export type OfflineCustomer = {
  id: string;
  fullName: string;
  phone: string;
};

export type OfflineSerial = {
  id: string;
  variantId: string;
  imei1: string | null;
  serialNumber: string | null;
  status: string;
};

export type OfflineSalePayload = {
  clientTxnId: string;
  kind: "IMMEDIATE" | "INSTALLMENT";
  customerId?: string | null;
  items: Array<{
    variantId: string;
    quantity: number;
    productSerialId?: string;
    discountXaf?: number | string;
  }>;
  discountTotalXaf?: number | string;
  payments: Array<{
    method: "CASH" | "ORANGE_MONEY" | "MTN_MOBILE_MONEY";
    amountXaf: number | string;
    idempotencyKey: string;
    operatorReference?: string;
  }>;
  installmentPlan?: {
    installmentCount: number;
    firstDueDate?: string;
    intervalDays?: number;
  };
  notes?: string;
};

export type OutboxSaleRecord = {
  clientTxnId: string;
  status: OutboxLocalStatus;
  payload: OfflineSalePayload;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastError?: string | null;
  lastErrorDetails?: unknown;
  saleId?: string | null;
  saleReference?: string | null;
};

export type SnapshotMeta = {
  fetchedAt: string;
  catalogCount: number;
  customerCount: number;
  serialCount: number;
  catalogTruncated: boolean;
  customersTruncated: boolean;
  serialsTruncated: boolean;
  minDownPaymentBps: number;
};

export function outboxStatusLabel(status: OutboxLocalStatus): string {
  switch (status) {
    case "PENDING_SYNC":
      return "En attente";
    case "SYNCING":
      return "Synchronisation";
    case "SYNCED":
      return "Synchronisé";
    case "FAILED":
      return "Échec";
    case "CONFLICT":
      return "Conflit";
    default:
      return status;
  }
}
