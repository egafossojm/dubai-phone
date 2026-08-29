import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { listCreditsQuerySchema } from "@/modules/credit/api/schemas";
import { listCreditsUseCase } from "@/modules/credit/application/payments";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePagePermission("credit.read");
  const params = await searchParams;
  const parsed = listCreditsQuerySchema.safeParse({
    q: first(params.q),
    status: first(params.status),
    page: first(params.page),
    pageSize: first(params.pageSize),
  });
  const query = parsed.success
    ? parsed.data
    : listCreditsQuerySchema.parse({ page: 1, pageSize: 20 });
  const list = await listCreditsUseCase(query);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Crédits clients</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Soldes, échéanciers et retards de paiement.
        </p>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="Référence, client…"
          className="h-10 min-w-[200px] flex-1 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
        />
        <select
          name="status"
          defaultValue={query.status ?? ""}
          className="h-10 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
        >
          <option value="">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="PARTIALLY_PAID">Partiellement payé</option>
          <option value="OVERDUE">En retard</option>
          <option value="PAID">Payé</option>
        </select>
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Filtrer
        </button>
      </form>

      {list.items.length === 0 ? (
        <EmptyState
          title="Aucun crédit"
          description="Les crédits apparaissent après une vente à tempérament (POS)."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">Crédit</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Reste</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">{item.reference}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Vente {item.saleReference}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${item.customerId}`}
                      className="font-medium hover:underline"
                    >
                      {item.customerName}
                    </Link>
                    <p className="font-mono text-xs text-[var(--muted-foreground)]">
                      {item.customerPhone}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        item.status === "OVERDUE" || item.overdueInstallments > 0
                          ? "text-amber-800"
                          : undefined
                      }
                    >
                      {item.statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {item.totalAmountLabel}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {item.remainingLabel}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/credits/${item.id}`}
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
    </section>
  );
}
