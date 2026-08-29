import type { z } from "zod";
import { AppError } from "@/lib/errors/app-error";
import { writeAudit } from "@/lib/audit/write-audit";
import type { AuthUser } from "@/lib/auth/session";
import { throwIfUniqueConflict } from "@/lib/db/prisma-errors";
import {
  assertSellingPrice,
  canChangeProductPrices,
  normalizeSku,
  parseXafAmount,
} from "@/modules/products/domain/policies";
import {
  createVariant,
  findProductById,
  findVariantById,
  getLowStockThreshold,
  updateVariant,
} from "@/modules/products/infrastructure/product-repository";
import { toProductDetail } from "@/modules/products/application/presenters";
import type {
  createVariantSchema,
  updateVariantSchema,
} from "@/modules/products/api/schemas";

type CreateInput = z.infer<typeof createVariantSchema>;
type UpdateInput = z.infer<typeof updateVariantSchema>;

function barcodeOrNull(value: string | null | undefined): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function addVariantUseCase(
  user: AuthUser,
  productId: string,
  input: CreateInput,
) {
  if (!canChangeProductPrices(user.permissions)) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "Seuls le manager ou l'administrateur peuvent définir les prix à la création.",
    );
  }

  const product = await findProductById(productId);
  if (!product) {
    throw new AppError("NOT_FOUND", "Produit introuvable.");
  }

  const selling = parseXafAmount(input.sellingPriceXaf, "Prix de vente");
  const cost = parseXafAmount(input.costPriceXaf, "Coût d'achat");
  assertSellingPrice(selling, cost);

  try {
    const variant = await createVariant({
      productId,
      sku: normalizeSku(input.sku),
      barcode: barcodeOrNull(input.barcode),
      name: input.name,
      sellingPriceXaf: selling,
      costPriceXaf: cost,
      warrantyMonths: input.warrantyMonths,
    });

    await writeAudit({
      actorId: user.id,
      action: "product.variant.create",
      entityType: "ProductVariant",
      entityId: variant.id,
      after: { sku: variant.sku, sellingPriceXaf: selling.toString() },
    });
  } catch (error) {
    throwIfUniqueConflict(error, { sku: "Ce SKU existe déjà." });
  }

  const refreshed = await findProductById(productId);
  const lowThreshold = await getLowStockThreshold();
  return toProductDetail(refreshed!, user, lowThreshold);
}

export async function updateVariantUseCase(
  user: AuthUser,
  variantId: string,
  input: UpdateInput,
) {
  const variant = await findVariantById(variantId);
  if (!variant || variant.product.deletedAt) {
    throw new AppError("NOT_FOUND", "Variante introuvable.");
  }

  const selling =
    input.sellingPriceXaf !== undefined
      ? parseXafAmount(input.sellingPriceXaf, "Prix de vente")
      : variant.sellingPriceXaf;
  const cost =
    input.costPriceXaf !== undefined
      ? parseXafAmount(input.costPriceXaf, "Coût d'achat")
      : variant.costPriceXaf;
  assertSellingPrice(selling, cost);

  const priceChanged =
    selling !== variant.sellingPriceXaf || cost !== variant.costPriceXaf;

  if (
    priceChanged &&
    (input.sellingPriceXaf !== undefined || input.costPriceXaf !== undefined) &&
    !canChangeProductPrices(user.permissions)
  ) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "Seuls le manager ou l'administrateur peuvent modifier les prix.",
    );
  }

  try {
    await updateVariant(variantId, {
      sku: input.sku ? normalizeSku(input.sku) : undefined,
      barcode:
        input.barcode === undefined ? undefined : barcodeOrNull(input.barcode),
      name: input.name,
      sellingPriceXaf: input.sellingPriceXaf !== undefined ? selling : undefined,
      costPriceXaf: input.costPriceXaf !== undefined ? cost : undefined,
      warrantyMonths: input.warrantyMonths,
      status: input.status,
    });
  } catch (error) {
    throwIfUniqueConflict(error, { sku: "Ce SKU existe déjà." });
  }

  await writeAudit({
    actorId: user.id,
    action: priceChanged ? "product.price_change" : "product.variant.update",
    entityType: "ProductVariant",
    entityId: variantId,
    before: {
      sellingPriceXaf: variant.sellingPriceXaf.toString(),
      costPriceXaf: variant.costPriceXaf.toString(),
      sku: variant.sku,
    },
    after: {
      sellingPriceXaf: selling.toString(),
      costPriceXaf: cost.toString(),
      sku: input.sku ? normalizeSku(input.sku) : variant.sku,
    },
  });

  const refreshed = await findProductById(variant.productId);
  const lowThreshold = await getLowStockThreshold();
  return toProductDetail(refreshed!, user, lowThreshold);
}
