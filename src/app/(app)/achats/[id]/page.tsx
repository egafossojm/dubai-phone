import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { getPurchaseOrderUseCase } from "@/modules/purchases/application/purchase-orders";
import { AppError } from "@/lib/errors/app-error";
import { StatusBadge } from "@/components/catalog/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { PurchaseOrderActions } from "@/components/purchases/purchase-order-actions";
import { ReceivePurchaseForm } from "@/components/purchases/receive-purchase-form";

type PageProps = { params: Promise<{ id: string }> };

export default async function PurchaseOrderDetailPage({ params }: PageProps) {
  const user = await requirePagePermission("purchases.read");
  const { id } = await params;
  let order;
  try {
    order = await getPurchaseOrderUseCase(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const canCreate = hasPermission(user.permissions, "purchases.create");
  const canReceive = hasPermission(user.permissions, "purchases.receive");
  const canShowReceive =
    canReceive &&
    (order.status === "ORDERED" || order.status === "PARTIALLY_RECEIVED");

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--muted-foreground)]">
            <Link href="/achats" className="hover:underline">
              Achats
            </Link>{" "}
            / {order.reference}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {order.reference}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {order.supplier.name} · {order.linesTotalLabel} · créé par{" "}
            {order.createdBy}
          </p>
        </div>
        <StatusBadge label={order.statusLabel} />
      </div>

      <PurchaseOrderActions
        purchaseOrderId={order.id}
        status={order.status}
        canCreate={canCreate}
      />

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-4 py-3 font-medium">
          Lignes de commande
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-2 font-medium">Produit</th>
              <th className="px-4 py-2 font-medium">Commandé</th>
              <th className="px-4 py-2 font-medium">Reçu</th>
              <th className="px-4 py-2 font-medium">Restant</th>
              <th className="px-4 py-2 font-medium">Coût</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-2">
                  <div className="font-medium">{item.productName}</div>
                  <div className="font-mono text-xs text-[var(--muted-foreground)]">
                    {item.sku}
                    {item.isSerialized ? " · IMEI" : ""}
                    {item.warrantyMonths
                      ? ` · garantie ${item.warrantyMonths} mois`
                      : ""}
                  </div>
                </td>
                <td className="px-4 py-2 tabular-nums">{item.quantityOrdered}</td>
                <td className="px-4 py-2 tabular-nums">{item.quantityReceived}</td>
                <td className="px-4 py-2 tabular-nums">{item.quantityRemaining}</td>
                <td className="px-4 py-2">{item.unitCostLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {order.receipts.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-4 py-3 font-medium">
            Réceptions
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-2 font-medium">Référence</th>
                <th className="px-4 py-2 font-medium">Statut</th>
                <th className="px-4 py-2 font-medium">Qté</th>
                <th className="px-4 py-2 font-medium">Par</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {order.receipts.map((receipt) => (
                <tr key={receipt.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2 font-mono text-xs">{receipt.reference}</td>
                  <td className="px-4 py-2">{receipt.statusLabel}</td>
                  <td className="px-4 py-2 tabular-nums">{receipt.quantityReceived}</td>
                  <td className="px-4 py-2">{receipt.postedBy ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/achats/factures/${receipt.id}`}
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
      ) : null}

      {canShowReceive ? (
        <ReceivePurchaseForm
          purchaseOrderId={order.id}
          items={order.items.map((item) => ({
            id: item.id,
            productName: item.productName,
            sku: item.sku,
            isSerialized: item.isSerialized,
            quantityRemaining: item.quantityRemaining,
            unitCostXaf: item.unitCostXaf,
          }))}
        />
      ) : null}
    </section>
  );
}
