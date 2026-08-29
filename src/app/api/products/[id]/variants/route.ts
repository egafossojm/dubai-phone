import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { createVariantSchema } from "@/modules/products/api/schemas";
import { addVariantUseCase } from "@/modules/products/application/variants";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = handleRoute(async (request: NextRequest, context) => {
  const user = await requirePermission("products.update");
  const { id } = await (context as RouteContext).params;
  const body = await request.json().catch(() => null);
  const parsed = createVariantSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Données de variante invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await addVariantUseCase(user, id, parsed.data), 201);
});
