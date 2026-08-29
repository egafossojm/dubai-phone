import { AppError } from "@/lib/errors/app-error";
import { writeAudit } from "@/lib/audit/write-audit";
import type { AuthUser } from "@/lib/auth/session";
import {
  createBrand,
  createCategory,
  findBrandByName,
  findCategoryByName,
  listBrands,
  listCategories,
} from "@/modules/products/infrastructure/product-repository";

export async function listCatalogOptions() {
  const [brands, categories] = await Promise.all([listBrands(), listCategories()]);
  return {
    brands: brands.map((item) => ({ id: item.id, name: item.name })),
    categories: categories.map((item) => ({ id: item.id, name: item.name })),
  };
}

export async function createBrandUseCase(user: AuthUser, name: string) {
  const existing = await findBrandByName(name);
  if (existing) {
    throw new AppError("CONFLICT", "Cette marque existe déjà.");
  }
  const brand = await createBrand(name);
  await writeAudit({
    actorId: user.id,
    action: "brand.create",
    entityType: "Brand",
    entityId: brand.id,
    after: { name: brand.name },
  });
  return { id: brand.id, name: brand.name };
}

export async function createCategoryUseCase(user: AuthUser, name: string) {
  const existing = await findCategoryByName(name);
  if (existing) {
    throw new AppError("CONFLICT", "Cette catégorie existe déjà.");
  }
  const category = await createCategory(name);
  await writeAudit({
    actorId: user.id,
    action: "category.create",
    entityType: "Category",
    entityId: category.id,
    after: { name: category.name },
  });
  return { id: category.id, name: category.name };
}
