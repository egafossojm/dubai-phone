import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import {
  createCustomerSchema,
  listCustomersQuerySchema,
} from "@/modules/customers/api/schemas";
import {
  createCustomerUseCase,
  listCustomersUseCase,
} from "@/modules/customers/application/customers";

export const GET = handleRoute(async (request: NextRequest) => {
  await requirePermission("customers.read");
  const url = new URL(request.url);
  const parsed = listCustomersQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Paramètres de recherche invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await listCustomersUseCase(parsed.data));
});

export const POST = handleRoute(async (request: NextRequest) => {
  const user = await requirePermission("customers.create");
  const body = await request.json().catch(() => null);
  const parsed = createCustomerSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Données client invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await createCustomerUseCase(user, parsed.data), 201);
});
