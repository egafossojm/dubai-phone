import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { listMovementsQuerySchema } from "@/modules/inventory/api/schemas";
import { listMovementsUseCase } from "@/modules/inventory/application/queries";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function StockMovementsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePagePermission("inventory.read");
  const params = await searchParams;
  const parsed = listMovementsQuerySchema.safeParse({
    variantId: first(params.variantId) || undefined,
    productSerialId: first(params.productSerialId) || undefined,
    type: first(params.type) || undefined,
    page: first(params.page),
    pageSize: first(params.pageSize),
  });
  const query = parsed.success
    ? parsed.data
    : listMovementsQuerySchema.parse({ page: 1, pageSize: 20 });
  const list = await listMovementsUseCase(query);
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted-foreground)]">
          <Link href="/stock" className="hover:underline">
            Stock
          </Link>{" "}
          / Mouvements
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Historique des mouvements
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Journal immuable : chaque entrée / sortie de stock est tracée.
        </p>
      </div>

      {list.items.length === 0 ? (
        <EmptyState
          title="Aucun mouvement"
          description="Les réceptions, ventes et ajustements apparaîtront ici."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Produit</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Qté</th>
                <th className="px-4 py-3 font-medium">IMEI / Série</th>
                <th className="px-4 py-3 font-medium">Par</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(item.createdAt).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">{item.typeLabel}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/stock/${item.variantId}`}
                      className="font-medium hover:underline"
                    >
                      {item.productName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                  <td className="px-4 py-3 tabular-nums font-medium">
                    {item.quantity > 0 ? `+${item.quantity}` : item.quantity}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {item.serial?.imei1 ?? item.serial?.serialNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3">{item.recordedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex justify-end gap-2">
          {list.page > 1 ? (
            <Link
              href={`/stock/mouvements?page=${list.page - 1}${query.variantId ? `&variantId=${query.variantId}` : ""}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Précédent
            </Link>
          ) : null}
          {list.page < totalPages ? (
            <Link
              href={`/stock/mouvements?page=${list.page + 1}${query.variantId ? `&variantId=${query.variantId}` : ""}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Suivant
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
