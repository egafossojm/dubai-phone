import { formatXaf } from "@/lib/money";
import {
  returnResolutionLabel,
  returnStatusLabel,
  warrantyStatusLabel,
  deriveWarrantyStatus,
} from "@/modules/returns/domain/policies";

export function toReturnSummary(row: {
  id: string;
  reference: string;
  status: string;
  resolution: string | null;
  sale: { id: string; reference: string };
  customer: { id: string; fullName: string } | null;
  createdAt: Date;
  items: unknown[];
}) {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    statusLabel: returnStatusLabel(row.status),
    resolution: row.resolution,
    resolutionLabel: returnResolutionLabel(row.resolution),
    saleId: row.sale.id,
    saleReference: row.sale.reference,
    customerId: row.customer?.id ?? null,
    customerName: row.customer?.fullName ?? null,
    itemCount: row.items.length,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toReturnDetail(row: {
  id: string;
  reference: string;
  status: string;
  resolution: string | null;
  reason: string | null;
  saleId: string;
  sale: {
    id: string;
    reference: string;
    totalXaf: bigint;
    completedAt: Date | null;
  };
  customer: { id: string; fullName: string; phone: string } | null;
  requestedBy: { fullName: string };
  inspectedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  items: Array<{
    id: string;
    saleItemId: string;
    variantId: string;
    productSerialId: string | null;
    quantity: number;
    restock: boolean;
    variant: { sku: string; name: string };
    productSerial: { imei1: string | null; serialNumber: string | null } | null;
    saleItem: { unitPriceXaf: bigint; lineTotalXaf: bigint; quantity: number };
  }>;
  refunds: Array<{
    id: string;
    amountXaf: bigint;
    method: string;
    operatorReference: string | null;
    refundedAt: Date;
    recordedBy: { fullName: string };
  }>;
  refundableXaf: bigint;
}) {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    statusLabel: returnStatusLabel(row.status),
    resolution: row.resolution,
    resolutionLabel: returnResolutionLabel(row.resolution),
    reason: row.reason,
    saleId: row.sale.id,
    saleReference: row.sale.reference,
    saleTotalLabel: formatXaf(row.sale.totalXaf),
    customerId: row.customer?.id ?? null,
    customerName: row.customer?.fullName ?? null,
    customerPhone: row.customer?.phone ?? null,
    requestedByName: row.requestedBy.fullName,
    inspectedAt: row.inspectedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    refundableXaf: row.refundableXaf.toString(),
    refundableLabel: formatXaf(row.refundableXaf),
    items: row.items.map((item) => ({
      id: item.id,
      saleItemId: item.saleItemId,
      variantId: item.variantId,
      sku: item.variant.sku,
      name: item.variant.name,
      quantity: item.quantity,
      restock: item.restock,
      productSerialId: item.productSerialId,
      imei1: item.productSerial?.imei1 ?? null,
      serialNumber: item.productSerial?.serialNumber ?? null,
      unitPriceLabel: formatXaf(item.saleItem.unitPriceXaf),
      lineTotalLabel: formatXaf(item.saleItem.lineTotalXaf),
    })),
    refunds: row.refunds.map((refund) => ({
      id: refund.id,
      amountXaf: refund.amountXaf.toString(),
      amountLabel: formatXaf(refund.amountXaf),
      method: refund.method,
      operatorReference: refund.operatorReference,
      refundedAt: refund.refundedAt.toISOString(),
      recordedByName: refund.recordedBy.fullName,
    })),
  };
}

export function toWarrantyLookupItem(row: {
  id: string;
  reference: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  sale: { id: string; reference: string };
  customer: { id: string; fullName: string; phone: string } | null;
  productSerial: {
    id: string;
    imei1: string | null;
    serialNumber: string | null;
    variant: { sku: string; name: string };
  } | null;
}) {
  const status = deriveWarrantyStatus({
    status: row.status,
    endsAt: row.endsAt,
  });
  return {
    id: row.id,
    reference: row.reference,
    status,
    statusLabel: warrantyStatusLabel(status),
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    saleId: row.sale.id,
    saleReference: row.sale.reference,
    customerId: row.customer?.id ?? null,
    customerName: row.customer?.fullName ?? null,
    customerPhone: row.customer?.phone ?? null,
    productSerialId: row.productSerial?.id ?? null,
    imei1: row.productSerial?.imei1 ?? null,
    serialNumber: row.productSerial?.serialNumber ?? null,
    sku: row.productSerial?.variant.sku ?? null,
    productName: row.productSerial?.variant.name ?? null,
  };
}
