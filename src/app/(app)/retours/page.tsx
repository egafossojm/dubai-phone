import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { listReturnsQuerySchema } from "@/modules/returns/api/schemas";
import { listReturnsUseCase } from "@/modules/returns/application/returns";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { WarrantyLookupForm } from "@/components/returns/warranty-lookup-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function RetoursPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePagePermission("sales.read");
  const params = await searchParams;
  const parsed = listReturnsQuerySchema.safeParse({
    q: first(params.q),
    status: first(params.status),
    page: first(params.page),
    pageSize: first(params.pageSize),
  });
  const query = parsed.success
    ? parsed.data
    : listReturnsQuerySchema.parse({ page: 1, pageSize: 20 });
  const list = await listReturnsUseCase(query);

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Retours & garanties
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Demandes de retour, remboursements, échanges et consultation garantie.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recherche garantie</h2>
        <WarrantyLookupForm />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold">Retours</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Créer un retour depuis le détail d&apos;une vente.
          </p>
        </div>

        <form className="flex flex-wrap gap-2" method="get">
          <input
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="Référence retour, vente, client…"
            className="h-10 min-w-[200px] flex-1 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          />
          <select
            name="status"
            defaultValue={query.status ?? ""}
            className="h-10 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          >
            <option value="">Tous les statuts</option>
            <option value="REQUESTED">Demandé</option>
            <option value="INSPECTING">Inspection</option>
            <option value="ACCEPTED">Accepté</option>
            <option value="REJECTED">Rejeté</option>
            <option value="COMPLETED">Terminé</option>
          </select>
          <button
            type="submit"
            className={buttonVariants({ variant: "outline" })}
          >
            Filtrer
          </button>
        </form>

        {list.items.length === 0 ? (
          <EmptyState
            title="Aucun retour"
            description="Les retours apparaissent après une demande depuis une vente."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Retour</th>
                  <th className="px-4 py-3 font-medium">Vente</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Résolution</th>
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
                        {new Date(item.createdAt).toLocaleString("fr-FR")}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        href={`/ventes/${item.saleId}`}
                        className="hover:underline"
                      >
                        {item.saleReference}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {item.customerId ? (
                        <Link
                          href={`/clients/${item.customerId}`}
                          className="hover:underline"
                        >
                          {item.customerName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">{item.statusLabel}</td>
                    <td className="px-4 py-3">{item.resolutionLabel}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/retours/${item.id}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
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
    </section>
  );
}
