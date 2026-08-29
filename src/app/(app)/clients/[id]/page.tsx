import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors/app-error";
import { getCustomerUseCase } from "@/modules/customers/application/customers";
import { CustomerEditForm } from "@/components/customers/customer-edit-form";
import { buttonVariants } from "@/components/ui/button";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePagePermission("customers.read");
  const { id } = await params;
  let customer;
  try {
    customer = await getCustomerUseCase(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const canEdit = hasPermission(user.permissions, "customers.create");

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted-foreground)]">
          <Link href="/clients" className="hover:underline">
            Clients
          </Link>{" "}
          / Profil
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {customer.fullName}
        </h1>
        <p className="mt-1 font-mono text-sm text-[var(--muted-foreground)]">
          {customer.phone}
          {customer.email ? ` · ${customer.email}` : ""}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            Adresse
          </p>
          <p className="mt-2 text-sm">{customer.address ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            Achats complétés
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {customer.sales.length}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            Solde crédit
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {customer.outstandingLabel}
          </p>
        </div>
      </div>

      {canEdit ? (
        <CustomerEditForm
          customerId={customer.id}
          canDeactivate={canEdit}
          initial={{
            fullName: customer.fullName,
            phone: customer.phone,
            email: customer.email,
            address: customer.address,
            notes: customer.notes,
          }}
        />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Crédits</h2>
        {customer.credits.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">Aucun crédit.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Référence</th>
                  <th className="px-4 py-3 font-medium">Vente</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 text-right font-medium">Reste</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {customer.credits.map((credit) => (
                  <tr
                    key={credit.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {credit.reference}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {credit.saleReference}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          credit.status === "OVERDUE"
                            ? "text-amber-800"
                            : undefined
                        }
                      >
                        {credit.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {credit.remainingLabel}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/credits/${credit.id}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        Échéancier
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Historique d&apos;achats</h2>
        {customer.sales.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Aucune vente complétée.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Référence</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {customer.sales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {sale.reference}
                    </td>
                    <td className="px-4 py-3">
                      {sale.kind === "INSTALLMENT" ? "Crédit" : "Comptant"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {sale.totalLabel}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">
                      {sale.completedAt
                        ? new Date(sale.completedAt).toLocaleDateString("fr-FR")
                        : "—"}
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
