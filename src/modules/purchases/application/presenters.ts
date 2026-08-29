import { formatXaf } from "@/lib/money";
import {
  goodsReceiptStatusLabel,
  purchaseOrderStatusLabel,
} from "@/modules/purchases/domain/policies";
import type { PurchaseOrderStatus } from "@prisma/client";

export function toSupplierListItem(supplier: {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}) {
  return {
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
  };
}

export function toPurchaseOrderListItem(order: {
  id: string;
  reference: string;
  status: PurchaseOrderStatus;
  createdAt: Date;
  orderedAt: Date | null;
  supplier: { id: string; name: string };
  createdBy: { fullName: string };
  items: Array<{
    quantityOrdered: number;
    quantityReceived: number;
    unitCostXaf: bigint;
  }>;
  _count: { receipts: number };
}) {
  const linesTotal = order.items.reduce(
    (sum, item) => sum + item.unitCostXaf * BigInt(item.quantityOrdered),
    BigInt(0),
  );
  const qtyOrdered = order.items.reduce((sum, item) => sum + item.quantityOrdered, 0);
  const qtyReceived = order.items.reduce(
    (sum, item) => sum + item.quantityReceived,
    0,
  );

  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    statusLabel: purchaseOrderStatusLabel(order.status),
    supplierId: order.supplier.id,
    supplierName: order.supplier.name,
    createdBy: order.createdBy.fullName,
    createdAt: order.createdAt.toISOString(),
    orderedAt: order.orderedAt?.toISOString() ?? null,
    quantityOrdered: qtyOrdered,
    quantityReceived: qtyReceived,
    linesTotalXaf: linesTotal.toString(),
    linesTotalLabel: formatXaf(linesTotal),
    receiptsCount: order._count.receipts,
  };
}

export function toPurchaseOrderDetail(order: {
  id: string;
  reference: string;
  status: PurchaseOrderStatus;
  notes: string | null;
  createdAt: Date;
  orderedAt: Date | null;
  cancelledAt: Date | null;
  closedAt: Date | null;
  supplier: { id: string; name: string; phone: string | null };
  createdBy: { id: string; fullName: string };
  items: Array<{
    id: string;
    quantityOrdered: number;
    quantityReceived: number;
    unitCostXaf: bigint;
      variant: {
      id: string;
      sku: string;
      name: string;
      warrantyMonths: number;
      product: {
        id: string;
        name: string;
        isSerialized: boolean;
      };
    };
  }>;
  receipts: Array<{
    id: string;
    reference: string;
    status: string;
    postedAt: Date | null;
    postedBy: { fullName: string } | null;
    items: Array<{
      id: string;
      quantityReceived: number;
      unitCostXaf: bigint;
      variant: {
        sku: string;
        name: string;
        product: { name: string };
      };
      serials: Array<{
        id: string;
        imei1: string | null;
        serialNumber: string | null;
      }>;
    }>;
  }>;
}) {
  const linesTotal = order.items.reduce(
    (sum, item) => sum + item.unitCostXaf * BigInt(item.quantityOrdered),
    BigInt(0),
  );

  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    statusLabel: purchaseOrderStatusLabel(order.status),
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    orderedAt: order.orderedAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    closedAt: order.closedAt?.toISOString() ?? null,
    supplier: order.supplier,
    createdBy: order.createdBy.fullName,
    linesTotalXaf: linesTotal.toString(),
    linesTotalLabel: formatXaf(linesTotal),
    items: order.items.map((item) => ({
      id: item.id,
      variantId: item.variant.id,
      sku: item.variant.sku,
      variantName: item.variant.name,
      productId: item.variant.product.id,
      productName: item.variant.product.name,
      isSerialized: item.variant.product.isSerialized,
      warrantyMonths: item.variant.warrantyMonths,
      quantityOrdered: item.quantityOrdered,
      quantityReceived: item.quantityReceived,
      quantityRemaining: Math.max(
        0,
        item.quantityOrdered - item.quantityReceived,
      ),
      unitCostXaf: item.unitCostXaf.toString(),
      unitCostLabel: formatXaf(item.unitCostXaf),
      lineTotalLabel: formatXaf(
        item.unitCostXaf * BigInt(item.quantityOrdered),
      ),
    })),
    receipts: order.receipts.map((receipt) => ({
      id: receipt.id,
      reference: receipt.reference,
      status: receipt.status,
      statusLabel: goodsReceiptStatusLabel(receipt.status),
      postedAt: receipt.postedAt?.toISOString() ?? null,
      postedBy: receipt.postedBy?.fullName ?? null,
      itemsCount: receipt.items.length,
      quantityReceived: receipt.items.reduce(
        (sum, line) => sum + line.quantityReceived,
        0,
      ),
    })),
  };
}

export function toInvoiceListItem(receipt: {
  id: string;
  reference: string;
  postedAt: Date | null;
  purchaseOrder: {
    id: string;
    reference: string;
    supplier: { id: string; name: string };
  };
  postedBy: { fullName: string } | null;
  items: Array<{
    quantityReceived: number;
    unitCostXaf: bigint;
    variant: { sku: string; product: { name: string } };
  }>;
}) {
  const total = receipt.items.reduce(
    (sum, item) => sum + item.unitCostXaf * BigInt(item.quantityReceived),
    BigInt(0),
  );
  return {
    id: receipt.id,
    reference: receipt.reference,
    purchaseOrderId: receipt.purchaseOrder.id,
    purchaseOrderReference: receipt.purchaseOrder.reference,
    supplierId: receipt.purchaseOrder.supplier.id,
    supplierName: receipt.purchaseOrder.supplier.name,
    postedAt: receipt.postedAt?.toISOString() ?? null,
    postedBy: receipt.postedBy?.fullName ?? null,
    totalXaf: total.toString(),
    totalLabel: formatXaf(total),
    linesCount: receipt.items.length,
  };
}

export function toInvoiceDetail(receipt: {
  id: string;
  reference: string;
  status: string;
  postedAt: Date | null;
  purchaseOrder: {
    id: string;
    reference: string;
    supplier: {
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
      address: string | null;
    };
  };
  postedBy: { fullName: string } | null;
  items: Array<{
    id: string;
    quantityReceived: number;
    unitCostXaf: bigint;
    variant: {
      id: string;
      sku: string;
      name: string;
      product: { id: string; name: string; isSerialized: boolean };
    };
    serials: Array<{
      id: string;
      imei1: string | null;
      imei2: string | null;
      serialNumber: string | null;
      status: string;
    }>;
  }>;
}) {
  const total = receipt.items.reduce(
    (sum, item) => sum + item.unitCostXaf * BigInt(item.quantityReceived),
    BigInt(0),
  );

  return {
    id: receipt.id,
    reference: receipt.reference,
    status: receipt.status,
    statusLabel: goodsReceiptStatusLabel(receipt.status),
    postedAt: receipt.postedAt?.toISOString() ?? null,
    postedBy: receipt.postedBy?.fullName ?? null,
    purchaseOrderId: receipt.purchaseOrder.id,
    purchaseOrderReference: receipt.purchaseOrder.reference,
    supplier: receipt.purchaseOrder.supplier,
    totalXaf: total.toString(),
    totalLabel: formatXaf(total),
    items: receipt.items.map((item) => ({
      id: item.id,
      sku: item.variant.sku,
      productName: item.variant.product.name,
      variantName: item.variant.name,
      quantityReceived: item.quantityReceived,
      unitCostXaf: item.unitCostXaf.toString(),
      unitCostLabel: formatXaf(item.unitCostXaf),
      lineTotalLabel: formatXaf(
        item.unitCostXaf * BigInt(item.quantityReceived),
      ),
      serials: item.serials.map((serial) => ({
        id: serial.id,
        imei1: serial.imei1,
        imei2: serial.imei2,
        serialNumber: serial.serialNumber,
        status: serial.status,
      })),
    })),
  };
}
