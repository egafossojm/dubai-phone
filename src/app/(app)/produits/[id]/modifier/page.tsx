import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { listCatalogOptions } from "@/modules/products/application/catalog";
import { getProductUseCase } from "@/modules/products/application/list-products";
import { ProductForm } from "@/components/catalog/product-form";
import { canSeeCostPrice } from "@/modules/products/domain/policies";
import { AppError } from "@/lib/errors/app-error";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePagePermission("products.update");
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
  const options = await listCatalogOptions();
  const primary = product.variants[0];

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted-foreground)]">
          <Link href={`/produits/${product.id}`} className="hover:underline">
            {product.name}
          </Link>
          {" / "}Modifier
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Modifier le produit</h1>
      </div>
      <ProductForm
        mode="edit"
        productId={product.id}
        brands={options.brands}
        categories={options.categories}
        showCost={canSeeCostPrice(user.permissions)}
        canCreateReferential={hasPermission(user.permissions, "products.create")}
        initial={{
          name: product.name,
          brandId: product.brand.id,
          categoryId: product.category.id,
          isSerialized: product.isSerialized,
          status: product.status,
          variantId: primary?.id,
          variant: {
            sku: primary?.sku ?? "",
            name: primary?.name ?? "",
            barcode: primary?.barcode ?? "",
            sellingPriceXaf: primary?.sellingPriceXaf ?? "",
            costPriceXaf: primary?.costPriceXaf ?? "0",
            warrantyMonths: String(primary?.warrantyMonths ?? 0),
          },
        }}
      />
    </section>
  );
}
