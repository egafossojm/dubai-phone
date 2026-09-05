import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { warrantyLookupQuerySchema } from "@/modules/returns/api/schemas";
import { lookupWarrantyUseCase } from "@/modules/returns/application/returns";

export const GET = handleRoute(async (request: NextRequest) => {
  await requirePermission("sales.read");
  const parsed = warrantyLookupQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Recherche garantie invalide.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await lookupWarrantyUseCase(parsed.data));
});
