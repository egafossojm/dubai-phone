import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { listCatalogOptions } from "@/modules/products/application/catalog";
import { ProductForm } from "@/components/catalog/product-form";
import {
  canChangeProductPrices,
  canSeeCostPrice,
} from "@/modules/products/domain/policies";

export default async function NewProductPage() {
  const user = await requirePagePermission("products.create");
  if (!canChangeProductPrices(user.permissions)) {
    redirect("/produits");
  }
  const options = await listCatalogOptions();

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted-foreground)]">
          <Link href="/produits" className="hover:underline">
            Produits
          </Link>
          {" / "}Nouveau
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Ajouter un produit</h1>
      </div>
      <ProductForm
        mode="create"
        brands={options.brands}
        categories={options.categories}
        showCost={canSeeCostPrice(user.permissions)}
        canCreateReferential={hasPermission(user.permissions, "products.create")}
        initial={{
          name: "",
          brandId: "",
          categoryId: "",
          isSerialized: false,
          status: "ACTIVE",
          variant: {
            sku: "",
            name: "Standard",
            barcode: "",
            sellingPriceXaf: "",
            costPriceXaf: "0",
            warrantyMonths: "0",
          },
        }}
      />
    </section>
  );
}
