import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import {
  createPurchaseOrderSchema,
  listPurchaseOrdersQuerySchema,
} from "@/modules/purchases/api/schemas";
import {
  createPurchaseOrderUseCase,
  listPurchaseOrdersUseCase,
} from "@/modules/purchases/application/purchase-orders";

function emptyToUndefined(value: string | null): string | undefined {
  return value || undefined;
}

export const GET = handleRoute(async (request: NextRequest) => {
  await requirePermission("purchases.read");
  const params = request.nextUrl.searchParams;
  const parsed = listPurchaseOrdersQuerySchema.safeParse({
    q: emptyToUndefined(params.get("q")),
    status: emptyToUndefined(params.get("status")),
    supplierId: emptyToUndefined(params.get("supplierId")),
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Filtres commandes invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await listPurchaseOrdersUseCase(parsed.data));
});

export const POST = handleRoute(async (request: NextRequest) => {
  const user = await requirePermission("purchases.create");
  const body = await request.json().catch(() => null);
  const parsed = createPurchaseOrderSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Données commande invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await createPurchaseOrderUseCase(user, parsed.data), 201);
});
