import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { listCreditsQuerySchema } from "@/modules/credit/api/schemas";
import { listCreditsUseCase } from "@/modules/credit/application/payments";

export const GET = handleRoute(async (request: NextRequest) => {
  await requirePermission("credit.read");
  const url = new URL(request.url);
  const parsed = listCreditsQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    customerId: url.searchParams.get("customerId") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Paramètres de recherche invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await listCreditsUseCase(parsed.data));
});
