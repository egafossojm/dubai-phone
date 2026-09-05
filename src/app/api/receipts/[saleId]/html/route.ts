import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { getReceiptHtmlBySaleIdUseCase } from "@/modules/receipts/application/receipts";

type RouteContext = { params: Promise<{ saleId: string }> };

export const GET = handleRoute(async (_request: NextRequest, context) => {
  await requirePermission("sales.read");
  const { saleId } = await (context as RouteContext).params;
  if (!saleId) {
    throw new AppError("VALIDATION_ERROR", "Identifiant de vente manquant.");
  }
  const { html, filename } = await getReceiptHtmlBySaleIdUseCase(saleId);
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
