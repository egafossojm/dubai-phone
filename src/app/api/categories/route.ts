import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { createCategorySchema } from "@/modules/products/api/schemas";
import {
  createCategoryUseCase,
  listCatalogOptions,
} from "@/modules/products/application/catalog";

export const GET = handleRoute(async () => {
  await requirePermission("products.read");
  const options = await listCatalogOptions();
  return jsonOk({ categories: options.categories });
});

export const POST = handleRoute(async (request: NextRequest) => {
  const user = await requirePermission("products.create");
  const body = await request.json().catch(() => null);
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Nom de catégorie invalide.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await createCategoryUseCase(user, parsed.data.name), 201);
});
