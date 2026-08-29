import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { createBrandSchema } from "@/modules/products/api/schemas";
import {
  createBrandUseCase,
  listCatalogOptions,
} from "@/modules/products/application/catalog";

export const GET = handleRoute(async () => {
  await requirePermission("products.read");
  const options = await listCatalogOptions();
  return jsonOk({ brands: options.brands });
});

export const POST = handleRoute(async (request: NextRequest) => {
  const user = await requirePermission("products.create");
  const body = await request.json().catch(() => null);
  const parsed = createBrandSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Nom de marque invalide.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await createBrandUseCase(user, parsed.data.name), 201);
});
