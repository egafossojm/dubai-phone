import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { listInvoicesQuerySchema } from "@/modules/purchases/api/schemas";
import { listPurchaseInvoicesUseCase } from "@/modules/purchases/application/receive";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function PurchaseInvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePagePermission("purchases.read");
  const params = await searchParams;
  const parsed = listInvoicesQuerySchema.safeParse({
    q: first(params.q),
    supplierId: first(params.supplierId) || undefined,
    page: first(params.page),
    pageSize: first(params.pageSize),
  });
  const query = parsed.success
    ? parsed.data
    : listInvoicesQuerySchema.parse({ page: 1, pageSize: 20 });
  const list = await listPurchaseInvoicesUseCase(query);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted-foreground)]">
          <Link href="/achats" className="hover:underline">
            Achats
          </Link>{" "}
          / Factures
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Factures / bons de réception
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Historique des réceptions validées avec coûts d&apos;achat.
        </p>
      </div>

      {list.items.length === 0 ? (
        <EmptyState
          title="Aucune facture"
          description="Les réceptions validées apparaissent ici comme documents d'achat."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">BR</th>
                <th className="px-4 py-3 font-medium">Commande</th>
                <th className="px-4 py-3 font-medium">Fournisseur</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{item.reference}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {item.purchaseOrderReference}
                  </td>
                  <td className="px-4 py-3">{item.supplierName}</td>
                  <td className="px-4 py-3">{item.totalLabel}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/achats/factures/${item.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Voir
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
