import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { receivePurchaseSchema } from "@/modules/purchases/api/schemas";
import { receivePurchaseUseCase } from "@/modules/purchases/application/receive";

export const POST = handleRoute(async (request: NextRequest) => {
  const user = await requirePermission("purchases.receive");
  const body = await request.json().catch(() => null);
  const parsed = receivePurchaseSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Données de réception invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await receivePurchaseUseCase(user, parsed.data), 201);
});
