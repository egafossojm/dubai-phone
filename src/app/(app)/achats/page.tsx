import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { listPurchaseOrdersQuerySchema } from "@/modules/purchases/api/schemas";
import { listPurchaseOrdersUseCase } from "@/modules/purchases/application/purchase-orders";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/catalog/status-badge";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requirePagePermission("purchases.read");
  const params = await searchParams;
  const parsed = listPurchaseOrdersQuerySchema.safeParse({
    q: first(params.q),
    status: first(params.status) || undefined,
    supplierId: first(params.supplierId) || undefined,
    page: first(params.page),
    pageSize: first(params.pageSize),
  });
  const query = parsed.success
    ? parsed.data
    : listPurchaseOrdersQuerySchema.parse({ page: 1, pageSize: 20 });
  const list = await listPurchaseOrdersUseCase(query);
  const canCreate = hasPermission(user.permissions, "purchases.create");

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Achats</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Commandes fournisseur, réceptions et historique des coûts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/achats/fournisseurs"
            className={buttonVariants({ variant: "outline" })}
          >
            Fournisseurs
          </Link>
          <Link
            href="/achats/factures"
            className={buttonVariants({ variant: "outline" })}
          >
            Factures / BR
          </Link>
          {canCreate ? (
            <Link href="/achats/nouveau" className={buttonVariants()}>
              Nouvelle commande
            </Link>
          ) : null}
        </div>
      </div>

      {list.items.length === 0 ? (
        <EmptyState
          title="Aucune commande"
          description="Créez une commande d'achat pour démarrer une réception."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">Référence</th>
                <th className="px-4 py-3 font-medium">Fournisseur</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Reçu</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{item.reference}</td>
                  <td className="px-4 py-3">{item.supplierName}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={item.statusLabel} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {item.quantityReceived}/{item.quantityOrdered}
                  </td>
                  <td className="px-4 py-3">{item.linesTotalLabel}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/achats/${item.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
