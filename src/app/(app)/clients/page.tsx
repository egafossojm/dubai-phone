import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { listCustomersQuerySchema } from "@/modules/customers/api/schemas";
import { listCustomersUseCase } from "@/modules/customers/application/customers";
import { CustomerCreateForm } from "@/components/customers/customer-create-form";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requirePagePermission("customers.read");
  const params = await searchParams;
  const parsed = listCustomersQuerySchema.safeParse({
    q: first(params.q),
    page: first(params.page),
    pageSize: first(params.pageSize),
  });
  const query = parsed.success
    ? parsed.data
    : listCustomersQuerySchema.parse({ page: 1, pageSize: 20 });
  const list = await listCustomersUseCase(query);
  const canCreate = hasPermission(user.permissions, "customers.create");

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Clients</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Fiches clients, historique d&apos;achats et soldes crédit.
        </p>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="Rechercher nom, téléphone…"
          className="h-10 min-w-[220px] flex-1 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
        />
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Filtrer
        </button>
      </form>

      {canCreate ? <CustomerCreateForm /> : null}

      {list.items.length === 0 ? (
        <EmptyState
          title="Aucun client"
          description="Ajoutez un client pour les ventes et le crédit."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium">Ventes</th>
                <th className="px-4 py-3 text-right font-medium">Solde crédit</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="px-4 py-3 font-medium">
                    {item.fullName}
                    {item.hasOverdue ? (
                      <span className="ml-2 text-xs font-normal text-amber-800">
                        Retard
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{item.phone}</td>
                  <td className="px-4 py-3 tabular-nums">{item.salesCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {item.outstandingLabel}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/clients/${item.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Profil
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
