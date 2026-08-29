import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { createProductSchema, listProductsQuerySchema } from "@/modules/products/api/schemas";
import { createProductUseCase } from "@/modules/products/application/write-product";
import { listProductsUseCase } from "@/modules/products/application/list-products";

function emptyToUndefined(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  return value;
}

export const GET = handleRoute(async (request: NextRequest) => {
  const user = await requirePermission("products.read");
  const params = request.nextUrl.searchParams;
  const parsed = listProductsQuerySchema.safeParse({
    q: emptyToUndefined(params.get("q")),
    brandId: emptyToUndefined(params.get("brandId")),
    categoryId: emptyToUndefined(params.get("categoryId")),
    status: emptyToUndefined(params.get("status")),
    serialized: emptyToUndefined(params.get("serialized")),
    stock: emptyToUndefined(params.get("stock")),
    sort: emptyToUndefined(params.get("sort")),
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Filtres invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await listProductsUseCase(user, parsed.data));
});

export const POST = handleRoute(async (request: NextRequest) => {
  const user = await requirePermission("products.create");
  const body = await request.json().catch(() => null);
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Données produit invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const product = await createProductUseCase(user, parsed.data);
  return jsonOk(product, 201);
});
