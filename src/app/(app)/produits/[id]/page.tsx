import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { getProductUseCase } from "@/modules/products/application/list-products";
import { AppError } from "@/lib/errors/app-error";
import { formatXaf, xaf } from "@/lib/money";
import {
  canChangeProductPrices,
  canSeeCostPrice,
  productStatusLabel,
} from "@/modules/products/domain/policies";
import { StatusBadge, productTone, stockTone } from "@/components/catalog/status-badge";
import { ProductSerialsPanel } from "@/components/catalog/product-serials-panel";
import { ProductVariantsPanel } from "@/components/catalog/product-variants-panel";
import { ProductStatusActions } from "@/components/catalog/product-status-actions";
import { buttonVariants } from "@/components/ui/button";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePagePermission("products.read");
  const { id } = await params;
  let product;
  try {
    product = await getProductUseCase(user, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const canUpdate = hasPermission(user.permissions, "products.update");
  const canDelete = hasPermission(user.permissions, "products.delete");
  const showCost = canSeeCostPrice(user.permissions);
  const canAddVariant = canUpdate && canChangeProductPrices(user.permissions);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-[var(--muted-foreground)]">
            <Link href="/produits" className="hover:underline">
              Produits
            </Link>
            {" / "}Détail
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{product.name}</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {product.brand.name} · {product.category.name}
            {product.isSerialized ? " · Sérialisé" : " · Standard"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUpdate ? (
            <Link href={`/produits/${product.id}/modifier`} className={buttonVariants()}>
              Modifier
            </Link>
          ) : null}
          {canDelete ? (
            <ProductStatusActions
              productId={product.id}
              status={product.status}
              canDeactivate={canDelete}
              canReactivate={canDelete}
            />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Stock (cache)</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{product.quantityOnHand}</p>
          <StatusBadge className="mt-2" label={product.stockLabel} tone={stockTone(product.stockStatus)} />
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Statut</p>
          <div className="mt-2">
            <StatusBadge label={productStatusLabel(product.status)} tone={productTone(product.status)} />
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Garantie & politique</p>
          <p className="mt-2 text-sm">
            {product.variants[0]
              ? `${product.variants[0].warrantyMonths} mois`
              : "—"}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Variantes</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs text-[var(--muted-foreground)]">
                <th className="py-2 pr-3 font-medium">SKU</th>
                <th className="py-2 pr-3 font-medium">Variante</th>
                <th className="py-2 pr-3 text-right font-medium">Prix TTC</th>
                {showCost ? (
                  <th className="py-2 pr-3 text-right font-medium">Coût</th>
                ) : null}
                <th className="py-2 pr-3 font-medium">Stock</th>
                <th className="py-2 font-medium">Garantie</th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((variant) => (
                <tr key={variant.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 pr-3 font-mono text-xs">{variant.sku}</td>
                  <td className="py-2 pr-3">{variant.name}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatXaf(xaf(variant.sellingPriceXaf))}
                  </td>
                  {showCost && variant.costPriceXaf ? (
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatXaf(xaf(variant.costPriceXaf))}
                    </td>
                  ) : showCost ? (
                    <td className="py-2 pr-3 text-right">—</td>
                  ) : null}
                  <td className="py-2 pr-3 tabular-nums">{variant.quantityOnHand}</td>
                  <td className="py-2">{variant.warrantyMonths} mois</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canAddVariant ? (
          <ProductVariantsPanel productId={product.id} showCost={showCost} />
        ) : null}
      </section>

      {product.isSerialized ? (
        <ProductSerialsPanel variants={product.variants} />
      ) : null}
    </section>
  );
}
