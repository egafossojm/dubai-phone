import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { updateVariantSchema } from "@/modules/products/api/schemas";
import { updateVariantUseCase } from "@/modules/products/application/variants";

type RouteContext = { params: Promise<{ variantId: string }> };

export const PATCH = handleRoute(async (request: NextRequest, context) => {
  const user = await requirePermission("products.update");
  const { variantId } = await (context as RouteContext).params;
  const body = await request.json().catch(() => null);
  const parsed = updateVariantSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Données de variante invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await updateVariantUseCase(user, variantId, parsed.data));
});
