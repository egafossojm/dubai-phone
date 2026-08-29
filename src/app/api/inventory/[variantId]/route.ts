import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { getInventoryDetailUseCase } from "@/modules/inventory/application/queries";

type RouteContext = { params: Promise<{ variantId: string }> };

export const GET = handleRoute(async (_request: NextRequest, context) => {
  await requirePermission("inventory.read");
  const { variantId } = await (context as RouteContext).params;
  return jsonOk(await getInventoryDetailUseCase(variantId));
});
