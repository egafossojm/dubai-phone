import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { completeRefundSchema } from "@/modules/returns/api/schemas";
import { completeRefundUseCase } from "@/modules/returns/application/returns";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = handleRoute(async (request: NextRequest, context) => {
  const user = await requirePermission("sales.refund");
  const { id } = await (context as RouteContext).params;
  const body = await request.json().catch(() => null);
  const parsed = completeRefundSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Données de remboursement invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await completeRefundUseCase(user, id, parsed.data));
});
