import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { updateProductSchema } from "@/modules/products/api/schemas";
import { getProductUseCase } from "@/modules/products/application/list-products";
import {
  deactivateProductUseCase,
  updateProductUseCase,
} from "@/modules/products/application/write-product";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = handleRoute(async (_request: NextRequest, context) => {
  const user = await requirePermission("products.read");
  const { id } = await (context as RouteContext).params;
  return jsonOk(await getProductUseCase(user, id));
});

export const PATCH = handleRoute(async (request: NextRequest, context) => {
  const user = await requirePermission("products.update");
  const { id } = await (context as RouteContext).params;
  const body = await request.json().catch(() => null);
  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Données produit invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await updateProductUseCase(user, id, parsed.data));
});

export const DELETE = handleRoute(async (_request: NextRequest, context) => {
  const user = await requirePermission("products.delete");
  const { id } = await (context as RouteContext).params;
  return jsonOk(await deactivateProductUseCase(user, id));
});
