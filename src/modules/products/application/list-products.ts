import type { z } from "zod";
import { AppError } from "@/lib/errors/app-error";
import type { AuthUser } from "@/lib/auth/session";
import {
  findProductById,
  getLowStockThreshold,
  listProducts,
} from "@/modules/products/infrastructure/product-repository";
import {
  toProductDetail,
  toProductListItem,
} from "@/modules/products/application/presenters";
import type { listProductsQuerySchema } from "@/modules/products/api/schemas";

type ListQuery = z.infer<typeof listProductsQuerySchema>;

export async function listProductsUseCase(user: AuthUser, query: ListQuery) {
  const lowThreshold = await getLowStockThreshold();
  const products = await listProducts({
    q: query.q,
    brandId: query.brandId,
    categoryId: query.categoryId,
    status: query.status,
    serialized:
      query.serialized === "true"
        ? true
        : query.serialized === "false"
          ? false
          : undefined,
  });

  let items = products.map((product) =>
    toProductListItem(product, user, lowThreshold),
  );

  if (query.stock) {
    items = items.filter((item) => item.stockStatus === query.stock);
  }

  if (query.sort === "recent") {
    const byId = new Map(products.map((product) => [product.id, product]));
    items.sort((a, b) => {
      const left = byId.get(a.id)?.createdAt.getTime() ?? 0;
      const right = byId.get(b.id)?.createdAt.getTime() ?? 0;
      return right - left;
    });
  } else if (query.sort === "price") {
    items.sort(
      (a, b) => Number(b.sellingPriceXaf) - Number(a.sellingPriceXaf),
    );
  }

  const start = (query.page - 1) * query.pageSize;
  const paged = items.slice(start, start + query.pageSize);

  return {
    items: paged,
    page: query.page,
    pageSize: query.pageSize,
    total: items.length,
    lowStockThreshold: lowThreshold,
  };
}

export async function getProductUseCase(user: AuthUser, id: string) {
  const product = await findProductById(id);
  if (!product) {
    throw new AppError("NOT_FOUND", "Produit introuvable.");
  }
  const lowThreshold = await getLowStockThreshold();
  return toProductDetail(product, user, lowThreshold);
}
