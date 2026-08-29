import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { posCatalogQuerySchema } from "@/modules/sales/api/schemas";
import { searchPosCatalogUseCase } from "@/modules/sales/application/catalog-search";

export const GET = handleRoute(async (request: NextRequest) => {
  await requirePermission("sales.create");
  const url = new URL(request.url);
  const parsed = posCatalogQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Recherche invalide.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await searchPosCatalogUseCase(parsed.data));
});
