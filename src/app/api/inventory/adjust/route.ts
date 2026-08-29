import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { adjustStockSchema } from "@/modules/inventory/api/schemas";
import { adjustStockUseCase } from "@/modules/inventory/application/queries";

export const POST = handleRoute(async (request: NextRequest) => {
  const user = await requirePermission("inventory.adjust");
  const body = await request.json().catch(() => null);
  const parsed = adjustStockSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Données d'ajustement invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await adjustStockUseCase(user, parsed.data), 201);
});
