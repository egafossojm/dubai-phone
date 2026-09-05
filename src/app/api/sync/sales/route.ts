import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { completeSaleSchema } from "@/modules/sales/api/schemas";
import { syncSaleUseCase } from "@/modules/sales/application/sync-sale";

export const POST = handleRoute(async (request: NextRequest) => {
  const user = await requirePermission("sales.create");
  const body = await request.json().catch(() => null);
  const parsed = completeSaleSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Données de sync invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const result = await syncSaleUseCase(user, parsed.data);
  return jsonOk(result, result.replayed ? 200 : 201);
});
