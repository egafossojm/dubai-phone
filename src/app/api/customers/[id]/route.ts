import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { updateCustomerSchema } from "@/modules/customers/api/schemas";
import {
  deactivateCustomerUseCase,
  getCustomerUseCase,
  updateCustomerUseCase,
} from "@/modules/customers/application/customers";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = handleRoute(async (_request: NextRequest, context) => {
  await requirePermission("customers.read");
  const { id } = await (context as RouteContext).params;
  return jsonOk(await getCustomerUseCase(id));
});

export const PATCH = handleRoute(async (request: NextRequest, context) => {
  const user = await requirePermission("customers.create");
  const { id } = await (context as RouteContext).params;
  const body = await request.json().catch(() => null);
  const parsed = updateCustomerSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Données client invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await updateCustomerUseCase(user, id, parsed.data));
});

export const DELETE = handleRoute(async (_request: NextRequest, context) => {
  const user = await requirePermission("customers.create");
  const { id } = await (context as RouteContext).params;
  return jsonOk(await deactivateCustomerUseCase(user, id));
});
