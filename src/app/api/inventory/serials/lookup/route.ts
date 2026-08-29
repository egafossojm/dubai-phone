import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { getSerialHistoryUseCase } from "@/modules/inventory/application/queries";

export const GET = handleRoute(async (request: NextRequest) => {
  await requirePermission("inventory.read");
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Indiquez un IMEI, un numéro de série ou un identifiant.",
    );
  }
  return jsonOk(await getSerialHistoryUseCase(q));
});
