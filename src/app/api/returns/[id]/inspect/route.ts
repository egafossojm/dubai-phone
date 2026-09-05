import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { startInspectionUseCase } from "@/modules/returns/application/returns";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = handleRoute(async (_request: NextRequest, context) => {
  const user = await requirePermission("sales.refund");
  const { id } = await (context as RouteContext).params;
  return jsonOk(await startInspectionUseCase(user, id));
});
