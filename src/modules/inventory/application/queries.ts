import type { z } from "zod";
import { AppError } from "@/lib/errors/app-error";
import type {
  adjustStockSchema,
  listInventoryQuerySchema,
  listMovementsQuerySchema,
  listSerialsQuerySchema,
} from "@/modules/inventory/api/schemas";
import {
  findSerialByIdOrIdentifier,
  findVariantInventory,
  listInventoryVariants,
  listSerializedDevices,
  listStockMovements,
} from "@/modules/inventory/infrastructure/inventory-queries";
import {
  toInventoryDetail,
  toInventoryListItem,
  toMovementItem,
  toSerialListItem,
} from "@/modules/inventory/application/presenters";
import { recordManualAdjustment } from "@/modules/inventory/application/operations";
import type { AuthUser } from "@/lib/auth/session";
import { deviceStatusLabel } from "@/modules/inventory/domain/policies";

type ListInventoryQuery = z.infer<typeof listInventoryQuerySchema>;
type ListMovementsQuery = z.infer<typeof listMovementsQuerySchema>;
type ListSerialsQuery = z.infer<typeof listSerialsQuerySchema>;
type AdjustInput = z.infer<typeof adjustStockSchema>;

export async function listInventoryUseCase(query: ListInventoryQuery) {
  const result = await listInventoryVariants({
    q: query.q,
    stock: query.stock,
    serialized:
      query.serialized === undefined ? undefined : query.serialized === "true",
    brandId: query.brandId,
    categoryId: query.categoryId,
    page: query.page,
    pageSize: query.pageSize,
  });

  return {
    items: result.items.map((item) =>
      toInventoryListItem(item, result.lowThreshold),
    ),
    total: result.total,
    page: query.page,
    pageSize: query.pageSize,
    lowStockThreshold: result.lowThreshold,
  };
}

export async function getInventoryDetailUseCase(variantId: string) {
  const { variant, lowThreshold } = await findVariantInventory(variantId);
  if (!variant) {
    throw new AppError("NOT_FOUND", "Fiche stock introuvable.");
  }
  return toInventoryDetail(variant, lowThreshold);
}

export async function listMovementsUseCase(query: ListMovementsQuery) {
  const result = await listStockMovements({
    variantId: query.variantId,
    productSerialId: query.productSerialId,
    type: query.type,
    page: query.page,
    pageSize: query.pageSize,
  });

  return {
    items: result.items.map(toMovementItem),
    total: result.total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function listSerialsUseCase(query: ListSerialsQuery) {
  const result = await listSerializedDevices({
    q: query.q,
    status: query.status,
    variantId: query.variantId,
    page: query.page,
    pageSize: query.pageSize,
  });

  return {
    items: result.items.map(toSerialListItem),
    total: result.total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getSerialHistoryUseCase(query: string) {
  const serial = await findSerialByIdOrIdentifier(query);
  if (!serial) {
    throw new AppError("NOT_FOUND", "IMEI / numéro de série introuvable.");
  }

  return {
    id: serial.id,
    imei1: serial.imei1,
    imei2: serial.imei2,
    serialNumber: serial.serialNumber,
    status: serial.status,
    statusLabel: deviceStatusLabel(serial.status),
    variantId: serial.variant.id,
    sku: serial.variant.sku,
    variantName: serial.variant.name,
    productId: serial.variant.product.id,
    productName: serial.variant.product.name,
    movements: serial.stockMovements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      quantity: movement.quantity,
      reason: movement.reason,
      createdAt: movement.createdAt.toISOString(),
      recordedBy: movement.recordedBy.fullName,
    })),
  };
}

export async function adjustStockUseCase(user: AuthUser, input: AdjustInput) {
  const movement = await recordManualAdjustment(user.id, {
    variantId: input.variantId,
    quantity: input.quantity,
    type: input.type,
    reason: input.reason,
    productSerialId: input.productSerialId,
    idempotencyKey: input.idempotencyKey,
  });

  const detail = await getInventoryDetailUseCase(input.variantId);
  return { movementId: movement.id, inventory: detail };
}
