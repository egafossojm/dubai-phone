import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { registerSerialUseCase } from "@/modules/products/application/serials";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = handleRoute(async (_request: NextRequest, context) => {
  const user = await requirePermission("products.update");
  const { id } = await (context as RouteContext).params;
  await registerSerialUseCase(user, id);
  return jsonOk({ registered: false });
});
