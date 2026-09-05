import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors/app-error";
import { getReturnUseCase } from "@/modules/returns/application/returns";
import { ReturnActions } from "@/components/returns/return-actions";

export default async function RetourDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePagePermission("sales.read");
  const { id } = await params;
  let ret;
  try {
    ret = await getReturnUseCase(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const canManage = hasPermission(user.permissions, "sales.refund");

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted-foreground)]">
          <Link href="/retours" className="hover:underline">
            Retours
          </Link>{" "}
          / {ret.reference}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Retour {ret.reference}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Vente{" "}
          <Link href={`/ventes/${ret.saleId}`} className="hover:underline">
            {ret.saleReference}
          </Link>
          {" · "}
          {ret.statusLabel}
          {" · "}
          {ret.resolutionLabel}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase text-[var(--muted-foreground)]">
            Client
          </p>
          <p className="mt-2 text-sm">
            {ret.customerId ? (
              <Link
                href={`/clients/${ret.customerId}`}
                className="hover:underline"
              >
                {ret.customerName}
              </Link>
            ) : (
              "—"
            )}
            {ret.customerPhone ? (
              <span className="block font-mono text-xs text-[var(--muted-foreground)]">
                {ret.customerPhone}
              </span>
            ) : null}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase text-[var(--muted-foreground)]">
            Total vente
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums">
            {ret.saleTotalLabel}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase text-[var(--muted-foreground)]">
            Remboursable
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums">
            {ret.refundableLabel}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase text-[var(--muted-foreground)]">
            Demandé par
          </p>
          <p className="mt-2 text-sm">{ret.requestedByName}</p>
        </div>
      </div>

      {ret.reason ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm whitespace-pre-wrap">
          {ret.reason}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Lignes</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">Article</th>
                <th className="px-4 py-3 font-medium">Qté</th>
                <th className="px-4 py-3 text-right font-medium">Ligne vente</th>
              </tr>
            </thead>
            <tbody>
              {ret.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="px-4 py-3">
                    <p>{item.name}</p>
                    <p className="font-mono text-xs text-[var(--muted-foreground)]">
                      {item.sku}
                      {item.imei1 ? ` · IMEI ${item.imei1}` : ""}
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

      {ret.refunds.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Remboursements</h2>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Mode</th>
                  <th className="px-4 py-3 text-right font-medium">Montant</th>
                  <th className="px-4 py-3 font-medium">Par</th>
                </tr>
              </thead>
              <tbody>
                {ret.refunds.map((refund) => (
                  <tr
                    key={refund.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-4 py-3">
                      {new Date(refund.refundedAt).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">{refund.method}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {refund.amountLabel}
                    </td>
                    <td className="px-4 py-3">{refund.recordedByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {canManage ? (
        <ReturnActions
          returnId={ret.id}
          status={ret.status}
          resolution={ret.resolution}
          refundableLabel={ret.refundableLabel}
          refundableXaf={ret.refundableXaf}
          items={ret.items.map((item) => ({
            id: item.id,
            sku: item.sku,
            name: item.name,
            quantity: item.quantity,
            variantId: item.variantId,
            productSerialId: item.productSerialId,
            imei1: item.imei1,
          }))}
        />
      ) : (
        <p className="text-sm text-[var(--muted-foreground)]">
          Inspection, acceptation et remboursement réservés au manager.
        </p>
      )}
    </section>
  );
}
