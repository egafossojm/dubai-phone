import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { getCreditUseCase } from "@/modules/credit/application/payments";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = handleRoute(async (_request: NextRequest, context) => {
  await requirePermission("credit.read");
  const { id } = await (context as RouteContext).params;
  return jsonOk(await getCreditUseCase(id));
});
