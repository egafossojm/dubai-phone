import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { listSerialsQuerySchema } from "@/modules/inventory/api/schemas";
import { listSerialsUseCase } from "@/modules/inventory/application/queries";

function emptyToUndefined(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  return value;
}

export const GET = handleRoute(async (request: NextRequest) => {
  await requirePermission("inventory.read");
  const params = request.nextUrl.searchParams;
  const parsed = listSerialsQuerySchema.safeParse({
    q: emptyToUndefined(params.get("q")),
    status: emptyToUndefined(params.get("status")),
    variantId: emptyToUndefined(params.get("variantId")),
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Filtres IMEI invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await listSerialsUseCase(parsed.data));
});
