import type { DeviceStatus, StockMovementType } from "@prisma/client";
import {
  deviceStatusLabel,
  movementTypeLabel,
  stockStatusFromQuantity,
  stockStatusLabel,
} from "@/modules/inventory/domain/policies";

type VariantRow = {
  id: string;
  sku: string;
  name: string;
  quantityOnHand: number;
  product: {
    id: string;
    name: string;
    isSerialized: boolean;
    status: string;
    brand: { id: string; name: string };
    category: { id: string; name: string };
  };
};

export function toInventoryListItem(variant: VariantRow, lowThreshold: number) {
  const stockStatus = stockStatusFromQuantity(variant.quantityOnHand, lowThreshold);
  return {
    variantId: variant.id,
    sku: variant.sku,
    variantName: variant.name,
    productId: variant.product.id,
    productName: variant.product.name,
    brandName: variant.product.brand.name,
    categoryName: variant.product.category.name,
    isSerialized: variant.product.isSerialized,
    productStatus: variant.product.status,
    quantityOnHand: variant.quantityOnHand,
    stockStatus,
    stockStatusLabel: stockStatusLabel(stockStatus),
  };
}

export function toInventoryDetail(
  variant: VariantRow & {
    serials?: Array<{
      id: string;
      imei1: string | null;
      imei2: string | null;
      serialNumber: string | null;
      status: DeviceStatus;
      createdAt: Date;
    }>;
  },
  lowThreshold: number,
) {
  return {
    ...toInventoryListItem(variant, lowThreshold),
    serials: (variant.serials ?? []).map((serial) => ({
      id: serial.id,
      imei1: serial.imei1,
      imei2: serial.imei2,
      serialNumber: serial.serialNumber,
      status: serial.status,
      statusLabel: deviceStatusLabel(serial.status),
      createdAt: serial.createdAt.toISOString(),
    })),
  };
}

export function toMovementItem(movement: {
  id: string;
  type: StockMovementType;
  quantity: number;
  reason: string | null;
  createdAt: Date;
  variant: {
    id: string;
    sku: string;
    name: string;
    product: { id: string; name: string };
  };
  productSerial: {
    id: string;
    imei1: string | null;
    imei2: string | null;
    serialNumber: string | null;
    status: DeviceStatus;
  } | null;
  recordedBy: { id: string; fullName: string };
}) {
  return {
    id: movement.id,
    type: movement.type,
    typeLabel: movementTypeLabel(movement.type),
    quantity: movement.quantity,
    reason: movement.reason,
    createdAt: movement.createdAt.toISOString(),
    variantId: movement.variant.id,
    sku: movement.variant.sku,
    variantName: movement.variant.name,
    productId: movement.variant.product.id,
    productName: movement.variant.product.name,
    serial: movement.productSerial
      ? {
          id: movement.productSerial.id,
          imei1: movement.productSerial.imei1,
          imei2: movement.productSerial.imei2,
          serialNumber: movement.productSerial.serialNumber,
          status: movement.productSerial.status,
          statusLabel: deviceStatusLabel(movement.productSerial.status),
        }
      : null,
    recordedBy: movement.recordedBy.fullName,
  };
}

export function toSerialListItem(serial: {
  id: string;
  imei1: string | null;
  imei2: string | null;
  serialNumber: string | null;
  status: DeviceStatus;
  createdAt: Date;
  variant: {
    id: string;
    sku: string;
    name: string;
    product: { id: string; name: string };
  };
}) {
  return {
    id: serial.id,
    imei1: serial.imei1,
    imei2: serial.imei2,
    serialNumber: serial.serialNumber,
    status: serial.status,
    statusLabel: deviceStatusLabel(serial.status),
    createdAt: serial.createdAt.toISOString(),
    variantId: serial.variant.id,
    sku: serial.variant.sku,
    variantName: serial.variant.name,
    productId: serial.variant.product.id,
    productName: serial.variant.product.name,
  };
}
