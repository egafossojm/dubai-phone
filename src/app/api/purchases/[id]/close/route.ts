import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { closePurchaseOrderRemainderUseCase } from "@/modules/purchases/application/purchase-orders";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = handleRoute(async (_request: NextRequest, context) => {
  const user = await requirePermission("purchases.create");
  const { id } = await (context as RouteContext).params;
  return jsonOk(await closePurchaseOrderRemainderUseCase(user, id));
});
