import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getSupplierUseCase } from "@/modules/purchases/application/suppliers";
import { AppError } from "@/lib/errors/app-error";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/catalog/status-badge";
import { purchaseOrderStatusLabel } from "@/modules/purchases/domain/policies";

type PageProps = { params: Promise<{ id: string }> };

export default async function SupplierDetailPage({ params }: PageProps) {
  await requirePagePermission("purchases.read");
  const { id } = await params;
  let supplier;
  try {
    supplier = await getSupplierUseCase(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted-foreground)]">
          <Link href="/achats" className="hover:underline">
            Achats
          </Link>{" "}
          /{" "}
          <Link href="/achats/fournisseurs" className="hover:underline">
            Fournisseurs
          </Link>{" "}
          / Profil
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{supplier.name}</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {supplier.phone ?? "Pas de téléphone"} · {supplier.email ?? "Pas d'e-mail"}
        </p>
        {supplier.address ? (
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{supplier.address}</p>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-4 py-3 font-medium">
          Commandes récentes
        </div>
        {supplier.purchaseOrders.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--muted-foreground)]">
            Aucune commande pour ce fournisseur.
          </p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-2 font-medium">Référence</th>
                <th className="px-4 py-2 font-medium">Statut</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {supplier.purchaseOrders.map((order) => (
                <tr key={order.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2 font-mono text-xs">{order.reference}</td>
                  <td className="px-4 py-2">
                    <StatusBadge label={purchaseOrderStatusLabel(order.status)} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/achats/${order.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
