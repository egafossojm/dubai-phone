import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { AppError } from "@/lib/errors/app-error";
import { getSaleUseCase } from "@/modules/sales/application/complete-sale";
import { buttonVariants } from "@/components/ui/button";

export default async function VenteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("sales.read");
  const { id } = await params;
  let sale;
  try {
    sale = await getSaleUseCase(id);
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
          <Link href="/ventes" className="hover:underline">
            Ventes
          </Link>{" "}
          / {sale.reference}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {sale.reference}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {sale.kindLabel} · {sale.statusLabel}
          {sale.receiptReference ? ` · Reçu ${sale.receiptReference}` : ""}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            Total
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {sale.totalLabel}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            Client
          </p>
          <p className="mt-2 text-sm">
            {sale.customer
              ? `${sale.customer.fullName} · ${sale.customer.phone}`
              : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            Crédit
          </p>
          <p className="mt-2 text-sm">
            {sale.creditReference ? (
              <Link
                href={`/credits/${sale.creditId}`}
                className="hover:underline"
              >
                {sale.creditReference} ({sale.creditRemainingLabel})
              </Link>
            ) : (
              "—"
            )}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Lignes</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">Article</th>
                <th className="px-4 py-3 font-medium">Qté</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="px-4 py-3">
                    <p>{item.name}</p>
                    <p className="font-mono text-xs text-[var(--muted-foreground)]">
                      {item.sku}
                      {item.serial?.imei1
                        ? ` · IMEI ${item.serial.imei1}`
                        : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">{item.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {item.lineTotalLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Link href="/pos" className={buttonVariants({ variant: "outline" })}>
        Retour caisse
      </Link>
    </section>
  );
}
