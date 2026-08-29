import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { updateSupplierSchema } from "@/modules/purchases/api/schemas";
import {
  deactivateSupplierUseCase,
  getSupplierUseCase,
  updateSupplierUseCase,
} from "@/modules/purchases/application/suppliers";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = handleRoute(async (_request: NextRequest, context) => {
  await requirePermission("purchases.read");
  const { id } = await (context as RouteContext).params;
  return jsonOk(await getSupplierUseCase(id));
});

export const PATCH = handleRoute(async (request: NextRequest, context) => {
  const user = await requirePermission("purchases.create");
  const { id } = await (context as RouteContext).params;
  const body = await request.json().catch(() => null);
  const parsed = updateSupplierSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Données fournisseur invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await updateSupplierUseCase(user, id, parsed.data));
});

export const DELETE = handleRoute(async (_request: NextRequest, context) => {
  const user = await requirePermission("purchases.create");
  const { id } = await (context as RouteContext).params;
  return jsonOk(await deactivateSupplierUseCase(user, id));
});
