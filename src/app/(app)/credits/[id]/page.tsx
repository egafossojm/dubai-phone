import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors/app-error";
import { getCreditUseCase } from "@/modules/credit/application/payments";
import { CreditPaymentForm } from "@/components/credit/credit-payment-form";

export default async function CreditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePagePermission("credit.read");
  const { id } = await params;
  let credit;
  try {
    credit = await getCreditUseCase(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const canPay =
    hasPermission(user.permissions, "credit.payment") &&
    credit.status !== "PAID" &&
    credit.status !== "CANCELLED";

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted-foreground)]">
          <Link href="/credits" className="hover:underline">
            Crédits
          </Link>{" "}
          / {credit.reference}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Crédit {credit.reference}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          <Link href={`/clients/${credit.customerId}`} className="hover:underline">
            {credit.customerName}
          </Link>
          {" · "}
          Vente {credit.saleReference}
          {" · "}
          <span
            className={credit.status === "OVERDUE" ? "text-amber-800" : undefined}
          >
            {credit.statusLabel}
          </span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase text-[var(--muted-foreground)]">Total</p>
          <p className="mt-2 text-xl font-semibold tabular-nums">
            {credit.totalAmountLabel}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase text-[var(--muted-foreground)]">Acompte</p>
          <p className="mt-2 text-xl font-semibold tabular-nums">
            {credit.downPaymentLabel}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase text-[var(--muted-foreground)]">Reste dû</p>
          <p className="mt-2 text-xl font-semibold tabular-nums">
            {credit.remainingLabel}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase text-[var(--muted-foreground)]">Retards</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-amber-800">
            {credit.overdueInstallments}
          </p>
        </div>
      </div>

      {canPay ? (
        <CreditPaymentForm
          creditId={credit.id}
          remainingLabel={credit.remainingLabel}
          installments={credit.installments.map((row) => ({
            id: row.id,
            sequence: row.sequence,
            remainingLabel: row.remainingLabel,
            status: row.status,
          }))}
        />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Échéancier</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Échéance</th>
                <th className="px-4 py-3 text-right font-medium">Dû</th>
                <th className="px-4 py-3 text-right font-medium">Payé</th>
                <th className="px-4 py-3 text-right font-medium">Reste</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {credit.installments.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="px-4 py-3 tabular-nums">{row.sequence}</td>
                  <td className="px-4 py-3">
                    {new Date(row.dueDate).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.amountDueLabel}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.amountPaidLabel}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.remainingLabel}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.status === "OVERDUE" ? "text-amber-800" : undefined
                      }
                    >
                      {row.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Historique des paiements</h2>
        {credit.payments.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Aucun paiement d&apos;échéance enregistré (l&apos;acompte initial est
            sur la vente).
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Mode</th>
                  <th className="px-4 py-3 text-right font-medium">Montant</th>
                  <th className="px-4 py-3 font-medium">Imputation</th>
                  <th className="px-4 py-3 font-medium">Réf. opérateur</th>
                  <th className="px-4 py-3 font-medium">Saisi par</th>
                </tr>
              </thead>
              <tbody>
                {credit.payments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-4 py-3">
                      {new Date(payment.paidAt).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">{payment.methodLabel}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {payment.amountLabel}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {payment.allocations.length > 0
                        ? payment.allocations
                            .map(
                              (row) =>
                                `#${row.installmentSequence} (${row.amountLabel})`,
                            )
                            .join(" · ")
                        : payment.installmentSequence
                          ? `#${payment.installmentSequence}`
                          : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {payment.operatorReference ?? "—"}
                    </td>
                    <td className="px-4 py-3">{payment.recordedByName}</td>
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
