import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { markReceiptPrintedUseCase } from "@/modules/receipts/application/receipts";

type RouteContext = { params: Promise<{ saleId: string }> };

export const POST = handleRoute(async (_request: NextRequest, context) => {
  const user = await requirePermission("sales.read");
  const { saleId } = await (context as RouteContext).params;
  if (!saleId) {
    throw new AppError("VALIDATION_ERROR", "Identifiant de vente manquant.");
  }
  return jsonOk(await markReceiptPrintedUseCase(user, saleId));
});
