import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { getPurchaseInvoiceUseCase } from "@/modules/purchases/application/receive";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = handleRoute(async (_request: NextRequest, context) => {
  await requirePermission("purchases.read");
  const { id } = await (context as RouteContext).params;
  return jsonOk(await getPurchaseInvoiceUseCase(id));
});
