import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { getSaleUseCase } from "@/modules/sales/application/complete-sale";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = handleRoute(async (_request: NextRequest, context) => {
  await requirePermission("sales.read");
  const { id } = await (context as RouteContext).params;
  if (!id) {
    throw new AppError("VALIDATION_ERROR", "Identifiant de vente manquant.");
  }
  return jsonOk(await getSaleUseCase(id));
});
