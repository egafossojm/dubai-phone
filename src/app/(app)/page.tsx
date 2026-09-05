import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { dashboardQuerySchema } from "@/modules/dashboard/api/schemas";
import { getDashboardUseCase } from "@/modules/dashboard/application/dashboard";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requirePagePermission("dashboard.read");
  const params = await searchParams;
  const parsed = dashboardQuerySchema.safeParse({
    period: first(params.period) ?? "today",
    from: first(params.from),
    to: first(params.to),
  });
  const filterError = parsed.success
    ? null
    : Object.values(parsed.error.flatten().fieldErrors)
        .flat()
        .filter(Boolean)[0] ?? "Filtres invalides.";
  const query = parsed.success
    ? parsed.data
    : dashboardQuerySchema.parse({ period: "today" });
  const dash = await getDashboardUseCase(user, query);
  const canFinance = dash.canReadFinancials;
  const canOwnCa = dash.canReadOwnCa && dash.ownCa;
  const canStock = hasPermission(user.permissions, "inventory.read");

  const periodLinks = [
    { period: "today", label: "Aujourd'hui" },
    { period: "week", label: "Semaine" },
    { period: "month", label: "Mois" },
  ] as const;

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Tableau de bord
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {dash.periodLabel}
            {canFinance
              ? " · CA net = encaissements − remboursements (Afrique/Douala)"
              : canOwnCa
                ? " · votre CA personnel (marge magasin masquée)"
                : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {periodLinks.map((link) => (
            <Link
              key={link.period}
              href={`/?period=${link.period}`}
              className={buttonVariants({
                variant: query.period === link.period ? "default" : "outline",
                size: "sm",
              })}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <input type="hidden" name="period" value="custom" />
        <div>
          <label className="mb-1 block text-xs font-medium" htmlFor="from">
            Du
          </label>
          <input
            id="from"
            name="from"
            type="date"
            required
            defaultValue={
              first(params.period) === "custom" ? (first(params.from) ?? "") : ""
            }
            className="h-10 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" htmlFor="to">
            Au
          </label>
          <input
            id="to"
            name="to"
            type="date"
            required
            defaultValue={
              first(params.period) === "custom" ? (first(params.to) ?? "") : ""
            }
            className="h-10 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          />
        </div>
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Période perso.
        </button>
        {filterError ? (
          <p className="w-full text-sm text-red-700" role="alert">
            {filterError} Affichage : aujourd&apos;hui.
          </p>
        ) : null}
      </form>

      {canFinance && dash.financials ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi title="CA période (net)" value={dash.financials.caPeriodLabel} />
          <Kpi title="CA du jour (net)" value={dash.financials.caTodayLabel} />
          <Kpi title="CA du mois (net)" value={dash.financials.caMonthLabel} />
          <Kpi
            title="Remboursements période"
            value={dash.financials.refundsPeriodLabel}
          />
          <Kpi title="Marge brute estimée" value={dash.financials.marginLabel} />
          <Kpi title="Panier moyen" value={dash.financials.averageBasketLabel} />
          <Kpi
            title="Créances clients"
            value={dash.financials.creditOutstandingLabel}
          />
          <Kpi title="Nombre de ventes" value={String(dash.saleCount)} />
        </div>
      ) : canOwnCa && dash.ownCa ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi title="Mon CA période" value={dash.ownCa.caPeriodLabel} />
          <Kpi title="Mes ventes" value={String(dash.ownCa.saleCount)} />
          <Kpi title="Mon panier moyen" value={dash.ownCa.averageBasketLabel} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi title="Nombre de ventes" value={String(dash.saleCount)} />
          <Kpi title="Stock faible" value={String(dash.lowStock.length)} />
          <Kpi
            title="Vendeurs actifs"
            value={String(dash.salesBySeller.length)}
          />
        </div>
      )}

      {canFinance && dash.financials && dash.financials.paymentsByMethod.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            Encaissements par mode (bruts)
          </h2>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Mode</th>
                  <th className="px-4 py-3 text-right font-medium">Nb</th>
                  <th className="px-4 py-3 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody>
                {dash.financials.paymentsByMethod.map((row) => (
                  <tr
                    key={row.method}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-4 py-3">{row.methodLabel}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.count}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.amountLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Top produits</h2>
          </div>
          {dash.topProducts.length === 0 ? (
            <EmptyState
              title="Aucune vente"
              description="Pas de lignes vendues sur cette période."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Produit</th>
                    <th className="px-4 py-3 text-right font-medium">Qté</th>
                    {canFinance ? (
                      <th className="px-4 py-3 text-right font-medium">CA</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {dash.topProducts.map((row) => (
                    <tr
                      key={row.variantId}
                      className="border-b border-[var(--border)] last:border-0"
                    >
                      <td className="px-4 py-3">
                        <p>{row.name}</p>
                        <p className="font-mono text-xs text-[var(--muted-foreground)]">
                          {row.sku}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.quantity}
                      </td>
                      {canFinance && "revenueLabel" in row ? (
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.revenueLabel as string}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Stock faible (≤ {dash.lowStockThreshold})
            </h2>
            {canStock ? (
              <Link
                href="/stock"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Stock
              </Link>
            ) : null}
          </div>
          {dash.lowStock.length === 0 ? (
            <EmptyState
              title="Stock OK"
              description="Aucune variante sous le seuil."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Variante</th>
                    <th className="px-4 py-3 text-right font-medium">Qté</th>
                  </tr>
                </thead>
                <tbody>
                  {dash.lowStock.map((row) => (
                    <tr
                      key={row.variantId}
                      className="border-b border-[var(--border)] last:border-0"
                    >
                      <td className="px-4 py-3">
                        {canStock ? (
                          <Link
                            href={`/stock/${row.variantId}`}
                            className="hover:underline"
                          >
                            {row.name}
                          </Link>
                        ) : (
                          row.name
                        )}
                        <p className="font-mono text-xs text-[var(--muted-foreground)]">
                          {row.sku}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-800">
                        {row.quantityOnHand}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Ventes par vendeur</h2>
          {dash.salesBySeller.length === 0 ? (
            <EmptyState
              title="Aucun vendeur"
              description="Pas de ventes sur la période."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Vendeur</th>
                    <th className="px-4 py-3 text-right font-medium">Ventes</th>
                    {canFinance ? (
                      <th className="px-4 py-3 text-right font-medium">CA</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {dash.salesBySeller.map((row) => (
                    <tr
                      key={row.userId}
                      className="border-b border-[var(--border)] last:border-0"
                    >
                      <td className="px-4 py-3">{row.fullName}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.saleCount}
                      </td>
                      {canFinance && "revenueLabel" in row ? (
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.revenueLabel as string}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ventes récentes</h2>
            {hasPermission(user.permissions, "sales.read") ? (
              <Link
                href="/ventes"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Toutes
              </Link>
            ) : null}
          </div>
          {dash.recentSales.length === 0 ? (
            <EmptyState
              title="Aucune vente récente"
              description="Les ventes de la période apparaîtront ici."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Réf.</th>
                    <th className="px-4 py-3 font-medium">Vendeur</th>
                    {canFinance || canOwnCa ? (
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {dash.recentSales.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--border)] last:border-0"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/ventes/${row.id}`}
                          className="font-mono text-xs hover:underline"
                        >
                          {row.reference}
                        </Link>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {row.customerName ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">{row.soldByName}</td>
                      {(canFinance || canOwnCa) && "totalLabel" in row ? (
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.totalLabel as string}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
        {title}
      </p>
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
