import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { registerCreditPaymentSchema } from "@/modules/credit/api/schemas";
import { registerCreditPaymentUseCase } from "@/modules/credit/application/payments";

export const POST = handleRoute(async (request: NextRequest) => {
  const user = await requirePermission("credit.payment");
  const body = await request.json().catch(() => null);
  const parsed = registerCreditPaymentSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Données de paiement invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await registerCreditPaymentUseCase(user, parsed.data), 201);
});
