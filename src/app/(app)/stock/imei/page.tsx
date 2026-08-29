import Link from "next/link";
import { Suspense } from "react";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { listSerialsQuerySchema } from "@/modules/inventory/api/schemas";
import {
  getSerialHistoryUseCase,
  listSerialsUseCase,
} from "@/modules/inventory/application/queries";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/catalog/status-badge";
import { movementTypeLabel } from "@/modules/inventory/domain/policies";
import { AppError } from "@/lib/errors/app-error";
import { ImeiLookupForm } from "@/components/inventory/imei-lookup-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function StockImeiPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePagePermission("inventory.read");
  const params = await searchParams;
  const lookup = first(params.q)?.trim();

  let history: Awaited<ReturnType<typeof getSerialHistoryUseCase>> | null = null;
  let lookupError: string | null = null;
  if (lookup) {
    try {
      history = await getSerialHistoryUseCase(lookup);
    } catch (error) {
      if (error instanceof AppError && error.code === "NOT_FOUND") {
        lookupError = "Aucun appareil trouvé pour cette recherche.";
      } else {
        throw error;
      }
    }
  }

  const parsed = listSerialsQuerySchema.safeParse({
    q: lookup || undefined,
    status: first(params.status) || undefined,
    page: first(params.page),
    pageSize: first(params.pageSize),
  });
  const query = parsed.success
    ? parsed.data
    : listSerialsQuerySchema.parse({ page: 1, pageSize: 20 });
  const list = history
    ? { items: [], total: 0, page: 1, pageSize: 20 }
    : await listSerialsUseCase(query);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted-foreground)]">
          <Link href="/stock" className="hover:underline">
            Stock
          </Link>{" "}
          / IMEI
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Stock sérialisé & traçabilité
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Recherchez un IMEI ou un numéro de série pour voir son historique.
        </p>
      </div>

      <Suspense fallback={null}>
        <ImeiLookupForm defaultQuery={lookup ?? ""} />
      </Suspense>

      {lookupError ? (
        <p className="text-sm text-red-700" role="alert">
          {lookupError}
        </p>
      ) : null}

      {history ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{history.productName}</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {history.sku} · {history.variantName}
                </p>
                <p className="mt-2 font-mono text-sm">
                  IMEI : {history.imei1 ?? "—"}
                  {history.serialNumber ? ` · Série : ${history.serialNumber}` : ""}
                </p>
              </div>
              <StatusBadge label={history.statusLabel} />
            </div>
            <div className="mt-4">
              <Link
                href={`/stock/${history.variantId}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Fiche stock
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-b border-[var(--border)] px-4 py-3 font-medium">
              Historique IMEI
            </div>
            {history.movements.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[var(--muted-foreground)]">
                Aucun mouvement lié à cet appareil.
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
                  {history.movements.map((movement) => (
                    <tr key={movement.id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-2 whitespace-nowrap">
                        {new Date(movement.createdAt).toLocaleString("fr-FR")}
                      </td>
                      <td className="px-4 py-2">
                        {movementTypeLabel(movement.type)}
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {movement.quantity > 0
                          ? `+${movement.quantity}`
                          : movement.quantity}
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
        </div>
      ) : list.items.length === 0 ? (
        <EmptyState
          title="Aucun appareil sérialisé"
          description="Les IMEI apparaissent à la réception des produits sérialisés."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">Produit</th>
                <th className="px-4 py-3 font-medium">IMEI</th>
                <th className="px-4 py-3 font-medium">Série</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.productName}</div>
                    <div className="font-mono text-xs text-[var(--muted-foreground)]">
                      {item.sku}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{item.imei1 ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {item.serialNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge label={item.statusLabel} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/stock/imei?q=${encodeURIComponent(item.imei1 ?? item.serialNumber ?? item.id)}`}
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
      )}
    </section>
  );
}
