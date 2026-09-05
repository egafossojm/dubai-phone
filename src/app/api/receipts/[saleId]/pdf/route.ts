import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { getReceiptPdfBySaleIdUseCase } from "@/modules/receipts/application/receipts";

type RouteContext = { params: Promise<{ saleId: string }> };

export const runtime = "nodejs";

export const GET = handleRoute(async (_request: NextRequest, context) => {
  await requirePermission("sales.read");
  const { saleId } = await (context as RouteContext).params;
  if (!saleId) {
    throw new AppError("VALIDATION_ERROR", "Identifiant de vente manquant.");
  }
  const { buffer, filename } = await getReceiptPdfBySaleIdUseCase(saleId);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
