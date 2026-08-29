import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { listInvoicesQuerySchema } from "@/modules/purchases/api/schemas";
import { listPurchaseInvoicesUseCase } from "@/modules/purchases/application/receive";

function emptyToUndefined(value: string | null): string | undefined {
  return value || undefined;
}

export const GET = handleRoute(async (request: NextRequest) => {
  await requirePermission("purchases.read");
  const params = request.nextUrl.searchParams;
  const parsed = listInvoicesQuerySchema.safeParse({
    q: emptyToUndefined(params.get("q")),
    supplierId: emptyToUndefined(params.get("supplierId")),
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Filtres factures invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await listPurchaseInvoicesUseCase(parsed.data));
});
