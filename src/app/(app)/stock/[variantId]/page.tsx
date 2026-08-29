import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { getInventoryDetailUseCase } from "@/modules/inventory/application/queries";
import { listMovementsUseCase } from "@/modules/inventory/application/queries";
import { StockAdjustForm } from "@/components/inventory/stock-adjust-form";
import { StatusBadge, stockTone } from "@/components/catalog/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { AppError } from "@/lib/errors/app-error";
import { movementTypeLabel } from "@/modules/inventory/domain/policies";

type PageProps = { params: Promise<{ variantId: string }> };

export default async function StockDetailPage({ params }: PageProps) {
  const user = await requirePagePermission("inventory.read");
  const { variantId } = await params;

  let detail;
  try {
    detail = await getInventoryDetailUseCase(variantId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const movements = await listMovementsUseCase({
    variantId,
    page: 1,
    pageSize: 15,
  });
  const canAdjust = hasPermission(user.permissions, "inventory.adjust");

  const adjustableSerials = detail.serials
    .filter((serial) => serial.status === "IN_STOCK" || serial.status === "RESERVED")
    .map((serial) => ({
      id: serial.id,
      label:
        serial.imei1 ??
        serial.serialNumber ??
        serial.id.slice(0, 8),
    }));

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted-foreground)]">
          <Link href="/stock" className="hover:underline">
            Stock
          </Link>{" "}
          / Détail
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {detail.productName}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {detail.brandName} · {detail.variantName} ·{" "}
              <span className="font-mono">{detail.sku}</span>
            </p>
          </div>
          <StatusBadge
            label={detail.stockStatusLabel}
            tone={stockTone(detail.stockStatus)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase text-[var(--muted-foreground)]">Quantité</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {detail.quantityOnHand}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase text-[var(--muted-foreground)]">Suivi</p>
          <p className="mt-1 text-lg font-medium">
            {detail.isSerialized ? "Sérialisé (IMEI)" : "Par quantité"}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase text-[var(--muted-foreground)]">Catalogue</p>
          <Link
            href={`/produits/${detail.productId}`}
            className="mt-1 inline-block text-lg font-medium hover:underline"
          >
            Voir le produit
          </Link>
        </div>
      </div>

      {detail.isSerialized && detail.serials.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-4 py-3 font-medium">
            Unités sérialisées
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-2 font-medium">IMEI 1</th>
                <th className="px-4 py-2 font-medium">Série</th>
                <th className="px-4 py-2 font-medium">Statut</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {detail.serials.map((serial) => (
                <tr key={serial.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2 font-mono text-xs">{serial.imei1 ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {serial.serialNumber ?? "—"}
                  </td>
                  <td className="px-4 py-2">{serial.statusLabel}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/stock/imei?q=${encodeURIComponent(serial.imei1 ?? serial.serialNumber ?? serial.id)}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Historique
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <span className="font-medium">Derniers mouvements</span>
          <Link
            href={`/stock/mouvements?variantId=${variantId}`}
            className="text-sm text-[var(--muted-foreground)] hover:underline"
          >
            Tout voir
          </Link>
        </div>
        {movements.items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--muted-foreground)]">
            Aucun mouvement pour cette variante.
          </p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Qté</th>
                <th className="px-4 py-2 font-medium">Par</th>
                <th className="px-4 py-2 font-medium">Motif</th>
              </tr>
            </thead>
            <tbody>
              {movements.items.map((movement) => (
                <tr key={movement.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2 whitespace-nowrap">
                    {new Date(movement.createdAt).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-2">
                    {movement.typeLabel ?? movementTypeLabel(movement.type)}
                  </td>
                  <td className="px-4 py-2 tabular-nums font-medium">
                    {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                  </td>
                  <td className="px-4 py-2">{movement.recordedBy}</td>
                  <td className="px-4 py-2 text-[var(--muted-foreground)]">
                    {movement.reason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canAdjust ? (
        <StockAdjustForm
          variantId={variantId}
          isSerialized={detail.isSerialized}
          serials={adjustableSerials}
        />
      ) : null}
    </section>
  );
}
