import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { listRecentSalesUseCase } from "@/modules/sales/application/complete-sale";
import { buttonVariants } from "@/components/ui/button";

export default async function VentesPage() {
  await requirePagePermission("sales.read");
  const sales = await listRecentSalesUseCase();

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Ventes</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            50 dernières ventes complétées.
          </p>
        </div>
        <Link
          href="/pos"
          className={buttonVariants({ variant: "default" })}
        >
          Nouvelle vente
        </Link>
      </div>

      {sales.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">Aucune vente.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">Référence</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Reçu</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr
                  key={sale.id}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      href={`/ventes/${sale.id}`}
                      className="hover:underline"
                    >
                      {sale.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{sale.kindLabel}</td>
                  <td className="px-4 py-3">
                    {sale.customer?.fullName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {sale.totalLabel}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {sale.receiptReference ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {sale.completedAt
                      ? new Date(sale.completedAt).toLocaleString("fr-FR")
                      : "—"}
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
