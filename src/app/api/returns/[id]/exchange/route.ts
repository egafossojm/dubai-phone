import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { completeExchangeSchema } from "@/modules/returns/api/schemas";
import { completeExchangeUseCase } from "@/modules/returns/application/returns";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = handleRoute(async (request: NextRequest, context) => {
  const user = await requirePermission("sales.refund");
  const { id } = await (context as RouteContext).params;
  const body = await request.json().catch(() => null);
  const parsed = completeExchangeSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Données d'échange invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await completeExchangeUseCase(user, id, parsed.data));
});
