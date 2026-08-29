import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { listSuppliersQuerySchema } from "@/modules/purchases/api/schemas";
import { listSuppliersUseCase } from "@/modules/purchases/application/suppliers";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { SupplierCreateForm } from "@/components/purchases/supplier-create-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requirePagePermission("purchases.read");
  const params = await searchParams;
  const parsed = listSuppliersQuerySchema.safeParse({
    q: first(params.q),
    page: first(params.page),
    pageSize: first(params.pageSize),
  });
  const query = parsed.success
    ? parsed.data
    : listSuppliersQuerySchema.parse({ page: 1, pageSize: 20 });
  const list = await listSuppliersUseCase(query);
  const canCreate = hasPermission(user.permissions, "purchases.create");

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted-foreground)]">
          <Link href="/achats" className="hover:underline">
            Achats
          </Link>{" "}
          / Fournisseurs
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Fournisseurs</h1>
      </div>

      {canCreate ? <SupplierCreateForm /> : null}

      {list.items.length === 0 ? (
        <EmptyState title="Aucun fournisseur" description="Ajoutez un fournisseur pour créer des commandes." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3">{item.phone ?? "—"}</td>
                  <td className="px-4 py-3">{item.email ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/achats/fournisseurs/${item.id}`}
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
