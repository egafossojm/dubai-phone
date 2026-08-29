import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { reactivateProductUseCase } from "@/modules/products/application/write-product";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = handleRoute(async (_request: NextRequest, context) => {
  const user = await requirePermission("products.delete");
  const { id } = await (context as RouteContext).params;
  return jsonOk(await reactivateProductUseCase(user, id));
});
