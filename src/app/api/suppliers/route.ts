import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import {
  createSupplierSchema,
  listSuppliersQuerySchema,
} from "@/modules/purchases/api/schemas";
import {
  createSupplierUseCase,
  listSuppliersUseCase,
} from "@/modules/purchases/application/suppliers";

function emptyToUndefined(value: string | null): string | undefined {
  return value || undefined;
}

export const GET = handleRoute(async (request: NextRequest) => {
  await requirePermission("purchases.read");
  const params = request.nextUrl.searchParams;
  const parsed = listSuppliersQuerySchema.safeParse({
    q: emptyToUndefined(params.get("q")),
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Filtres fournisseurs invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await listSuppliersUseCase(parsed.data));
});

export const POST = handleRoute(async (request: NextRequest) => {
  const user = await requirePermission("purchases.create");
  const body = await request.json().catch(() => null);
  const parsed = createSupplierSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Données fournisseur invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await createSupplierUseCase(user, parsed.data), 201);
});
