import Link from "next/link";
import { Suspense } from "react";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { listInventoryQuerySchema } from "@/modules/inventory/api/schemas";
import { listInventoryUseCase } from "@/modules/inventory/application/queries";
import { InventoryFilters } from "@/components/inventory/inventory-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge, stockTone } from "@/components/catalog/status-badge";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function stockHref(
  query: {
    q?: string;
    stock?: string;
    serialized?: string;
  },
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, page: String(page) })) {
    if (value) {
      params.set(key, value);
    }
  }
  return `/stock?${params.toString()}`;
}

export default async function StockListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requirePagePermission("inventory.read");
  const params = await searchParams;
  const parsed = listInventoryQuerySchema.safeParse({
    q: first(params.q),
    stock: first(params.stock) || undefined,
    serialized: first(params.serialized) || undefined,
    brandId: first(params.brandId) || undefined,
    categoryId: first(params.categoryId) || undefined,
    page: first(params.page),
    pageSize: first(params.pageSize),
  });
  const query = parsed.success
    ? parsed.data
    : listInventoryQuerySchema.parse({ page: 1, pageSize: 20 });
  const list = await listInventoryUseCase(query);
  const canAdjust = hasPermission(user.permissions, "inventory.adjust");
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Stock</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Quantités dérivées des mouvements. Seuil stock bas :{" "}
          {list.lowStockThreshold}.
        </p>
      </div>

      <Suspense fallback={null}>
        <InventoryFilters canAdjust={canAdjust} />
      </Suspense>

      {list.items.length === 0 ? (
        <EmptyState
          title="Aucun article en stock"
          description="Les variantes apparaissent ici dès qu’elles existent au catalogue."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">Produit</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Qté</th>
                <th className="px-4 py-3 font-medium">Niveau</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={item.variantId} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.productName}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {item.brandName} · {item.variantName}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                  <td className="px-4 py-3 tabular-nums">{item.quantityOnHand}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={item.stockStatusLabel}
                      tone={stockTone(item.stockStatus)}
                    />
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {item.isSerialized ? "Sérialisé" : "Quantité"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/stock/${item.variantId}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Détail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--muted-foreground)]">
            Page {list.page} / {totalPages} ({list.total} articles)
          </span>
          <div className="flex gap-2">
            {list.page > 1 ? (
              <Link
                href={stockHref(query, list.page - 1)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Précédent
              </Link>
            ) : null}
            {list.page < totalPages ? (
              <Link
                href={stockHref(query, list.page + 1)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Suivant
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
