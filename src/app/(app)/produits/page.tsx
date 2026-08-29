import Link from "next/link";
import { Suspense } from "react";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { listCatalogOptions } from "@/modules/products/application/catalog";
import { listProductsUseCase } from "@/modules/products/application/list-products";
import { listProductsQuerySchema } from "@/modules/products/api/schemas";
import { ProductFilters } from "@/components/catalog/product-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge, productTone, stockTone } from "@/components/catalog/status-badge";
import { formatXaf, xaf } from "@/lib/money";
import {
  canChangeProductPrices,
  productStatusLabel,
} from "@/modules/products/domain/policies";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function productsQueryHref(
  query: {
    q?: string;
    brandId?: string;
    categoryId?: string;
    status?: string;
    serialized?: string;
    stock?: string;
    sort?: string;
  },
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, page: String(page) })) {
    if (value) {
      params.set(key, value);
    }
  }
  return `/produits?${params.toString()}`;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requirePagePermission("products.read");
  const params = await searchParams;
  const parsed = listProductsQuerySchema.safeParse({
    q: first(params.q),
    brandId: first(params.brandId) || undefined,
    categoryId: first(params.categoryId) || undefined,
    status: first(params.status) || undefined,
    serialized: first(params.serialized) || undefined,
    stock: first(params.stock) || undefined,
    sort: first(params.sort) || undefined,
    page: first(params.page),
    pageSize: first(params.pageSize),
  });
  const query = parsed.success
    ? parsed.data
    : listProductsQuerySchema.parse({ page: 1, pageSize: 20 });
  const [list, options] = await Promise.all([
    listProductsUseCase(user, query),
    listCatalogOptions(),
  ]);
  const canCreate =
    hasPermission(user.permissions, "products.create") &&
    canChangeProductPrices(user.permissions);
  const canUpdate = hasPermission(user.permissions, "products.update");
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Produits</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Catalogue, variantes, SKU et suivi sérialisé. Le stock affiché est
          indicatif (mis à jour à la réception).
        </p>
      </div>

      <Suspense>
        <ProductFilters
          brands={options.brands}
          categories={options.categories}
          canCreate={canCreate}
        />
      </Suspense>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        {list.items.length === 0 ? (
          <EmptyState
            title="Aucun produit enregistré"
            description="Commencez par ajouter votre premier produit au catalogue."
            action={
              canCreate ? (
                <Link href="/produits/nouveau" className={buttonVariants()}>
                  Ajouter un produit
                </Link>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs text-[var(--muted-foreground)]">
                  <th className="px-4 py-3 font-medium">Produit</th>
                  <th className="px-4 py-3 font-medium">Catégorie</th>
                  <th className="px-4 py-3 font-medium">Marque</th>
                  <th className="px-4 py-3 text-right font-medium">Prix (FCFA)</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]">
                    <td className="px-4 py-3">
                      <Link href={`/produits/${item.id}`} className="font-medium hover:text-[var(--primary)]">
                        {item.name}
                      </Link>
                      <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                        SKU : {item.sku || "—"} {item.isSerialized ? "· Sérialisé" : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">{item.category.name}</td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">{item.brand.name}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatXaf(xaf(item.sellingPriceXaf)).replace(" FCFA", "")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums">{item.quantityOnHand}</span>
                        <StatusBadge label={item.stockLabel} tone={stockTone(item.stockStatus)} />
                        <StatusBadge label={productStatusLabel(item.status)} tone={productTone(item.status)} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link className="text-sm text-[var(--primary)] hover:underline" href={`/produits/${item.id}`}>
                          Voir
                        </Link>
                        {canUpdate ? (
                          <Link
                            className="text-sm text-[var(--primary)] hover:underline"
                            href={`/produits/${item.id}/modifier`}
                          >
                            Modifier
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {list.total > 0 ? (
        <div className="flex items-center justify-between text-sm text-[var(--muted-foreground)]">
          <p>
            Page {list.page} / {totalPages} · {list.total} produit(s)
          </p>
          <div className="flex gap-3">
            {list.page > 1 ? (
              <Link className="hover:text-[var(--primary)]" href={productsQueryHref(query, list.page - 1)}>
                Précédent
              </Link>
            ) : null}
            {list.page < totalPages ? (
              <Link className="hover:text-[var(--primary)]" href={productsQueryHref(query, list.page + 1)}>
                Suivant
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
