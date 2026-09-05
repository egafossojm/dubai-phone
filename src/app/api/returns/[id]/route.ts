import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { getReturnUseCase } from "@/modules/returns/application/returns";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = handleRoute(async (_request: NextRequest, context) => {
  await requirePermission("sales.read");
  const { id } = await (context as RouteContext).params;
  return jsonOk(await getReturnUseCase(id));
});
