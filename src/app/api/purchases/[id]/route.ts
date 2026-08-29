import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { updatePurchaseOrderSchema } from "@/modules/purchases/api/schemas";
import {
  cancelPurchaseOrderUseCase,
  getPurchaseOrderUseCase,
  updatePurchaseOrderUseCase,
} from "@/modules/purchases/application/purchase-orders";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = handleRoute(async (_request: NextRequest, context) => {
  await requirePermission("purchases.read");
  const { id } = await (context as RouteContext).params;
  return jsonOk(await getPurchaseOrderUseCase(id));
});

export const PATCH = handleRoute(async (request: NextRequest, context) => {
  const user = await requirePermission("purchases.create");
  const { id } = await (context as RouteContext).params;
  const body = await request.json().catch(() => null);
  const parsed = updatePurchaseOrderSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Données commande invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await updatePurchaseOrderUseCase(user, id, parsed.data));
});

export const DELETE = handleRoute(async (_request: NextRequest, context) => {
  const user = await requirePermission("purchases.create");
  const { id } = await (context as RouteContext).params;
  return jsonOk(await cancelPurchaseOrderUseCase(user, id));
});
