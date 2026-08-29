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
  createProductWithVariant,
  findBrandById,
  findCategoryById,
  findProductById,
  getLowStockThreshold,
  updateProduct,
} from "@/modules/products/infrastructure/product-repository";
import { toProductDetail } from "@/modules/products/application/presenters";
import type { z } from "zod";
import type {
  createProductSchema,
  updateProductSchema,
} from "@/modules/products/api/schemas";

type CreateInput = z.infer<typeof createProductSchema>;
type UpdateInput = z.infer<typeof updateProductSchema>;

function barcodeOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createProductUseCase(user: AuthUser, input: CreateInput) {
  if (!canChangeProductPrices(user.permissions)) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "Seuls le manager ou l'administrateur peuvent définir les prix à la création.",
    );
  }

  const brand = await findBrandById(input.brandId);
  if (!brand) {
    throw new AppError("NOT_FOUND", "Marque introuvable.");
  }
  const category = await findCategoryById(input.categoryId);
  if (!category) {
    throw new AppError("NOT_FOUND", "Catégorie introuvable.");
  }

  const selling = parseXafAmount(input.variant.sellingPriceXaf, "Prix de vente");
  const cost = parseXafAmount(input.variant.costPriceXaf, "Coût d'achat");
  assertSellingPrice(selling, cost);

  try {
    const product = await createProductWithVariant({
      name: input.name,
      brandId: input.brandId,
      categoryId: input.categoryId,
      isSerialized: input.isSerialized,
      status: input.status ?? "ACTIVE",
      variant: {
        sku: normalizeSku(input.variant.sku),
        barcode: barcodeOrNull(input.variant.barcode),
        name: input.variant.name,
        sellingPriceXaf: selling,
        costPriceXaf: cost,
        warrantyMonths: input.variant.warrantyMonths,
      },
    });

    await writeAudit({
      actorId: user.id,
      action: "product.create",
      entityType: "Product",
      entityId: product.id,
      after: {
        name: product.name,
        sku: product.variants[0]?.sku,
        sellingPriceXaf: selling.toString(),
        isSerialized: product.isSerialized,
      },
    });

    const lowThreshold = await getLowStockThreshold();
    return toProductDetail(product, user, lowThreshold);
  } catch (error) {
    throwIfUniqueConflict(error, {
      sku: "Ce SKU existe déjà.",
    });
  }
}

export async function updateProductUseCase(
  user: AuthUser,
  id: string,
  input: UpdateInput,
) {
  const existing = await findProductById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", "Produit introuvable.");
  }

  if (input.brandId) {
    const brand = await findBrandById(input.brandId);
    if (!brand) {
      throw new AppError("NOT_FOUND", "Marque introuvable.");
    }
  }
  if (input.categoryId) {
    const category = await findCategoryById(input.categoryId);
    if (!category) {
      throw new AppError("NOT_FOUND", "Catégorie introuvable.");
    }
  }

  if (input.isSerialized === false && existing.isSerialized) {
    const hasSerials = existing.variants.some((variant) => variant.serials.length > 0);
    if (hasSerials) {
      throw new AppError(
        "BUSINESS_RULE_ERROR",
        "Impossible de désactiver le suivi sérialisé : des IMEI / séries sont déjà enregistrés.",
      );
    }
  }

  if (existing.status === "INACTIVE" && input.status !== undefined) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "Pour réactiver un produit, utilisez l'action Réactiver.",
    );
  }

  const updated = await updateProduct(id, {
    name: input.name,
    status: input.status,
    isSerialized: input.isSerialized,
    brand: input.brandId ? { connect: { id: input.brandId } } : undefined,
    category: input.categoryId ? { connect: { id: input.categoryId } } : undefined,
  });

  await writeAudit({
    actorId: user.id,
    action: "product.update",
    entityType: "Product",
    entityId: id,
    before: {
      name: existing.name,
      status: existing.status,
      isSerialized: existing.isSerialized,
    },
    after: {
      name: updated.name,
      status: updated.status,
      isSerialized: updated.isSerialized,
    },
  });

  const lowThreshold = await getLowStockThreshold();
  return toProductDetail(updated, user, lowThreshold);
}

export async function deactivateProductUseCase(user: AuthUser, id: string) {
  const existing = await findProductById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", "Produit introuvable.");
  }

  const updated = await updateProduct(id, {
    status: "INACTIVE",
  });

  await writeAudit({
    actorId: user.id,
    action: "product.deactivate",
    entityType: "Product",
    entityId: id,
    before: { status: existing.status },
    after: { status: "INACTIVE" },
  });

  const lowThreshold = await getLowStockThreshold();
  return toProductDetail(updated, user, lowThreshold);
}

export async function reactivateProductUseCase(user: AuthUser, id: string) {
  const existing = await findProductById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", "Produit introuvable.");
  }

  const updated = await updateProduct(id, {
    status: "ACTIVE",
  });

  await writeAudit({
    actorId: user.id,
    action: "product.reactivate",
    entityType: "Product",
    entityId: id,
    before: { status: existing.status },
    after: { status: "ACTIVE" },
  });

  const lowThreshold = await getLowStockThreshold();
  return toProductDetail(updated, user, lowThreshold);
}
