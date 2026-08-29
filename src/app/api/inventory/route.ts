import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { listInventoryQuerySchema } from "@/modules/inventory/api/schemas";
import { listInventoryUseCase } from "@/modules/inventory/application/queries";

function emptyToUndefined(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  return value;
}

export const GET = handleRoute(async (request: NextRequest) => {
  await requirePermission("inventory.read");
  const params = request.nextUrl.searchParams;
  const parsed = listInventoryQuerySchema.safeParse({
    q: emptyToUndefined(params.get("q")),
    stock: emptyToUndefined(params.get("stock")),
    serialized: emptyToUndefined(params.get("serialized")),
    brandId: emptyToUndefined(params.get("brandId")),
    categoryId: emptyToUndefined(params.get("categoryId")),
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Filtres stock invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await listInventoryUseCase(parsed.data));
});
