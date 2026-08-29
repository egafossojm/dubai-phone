import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { listPurchaseCatalogVariantsUseCase } from "@/modules/purchases/application/purchase-orders";
import { listSuppliersUseCase } from "@/modules/purchases/application/suppliers";
import { PurchaseOrderForm } from "@/components/purchases/purchase-order-form";

export default async function NewPurchaseOrderPage() {
  await requirePagePermission("purchases.create");
  const [suppliers, variants] = await Promise.all([
    listSuppliersUseCase({ page: 1, pageSize: 100 }),
    listPurchaseCatalogVariantsUseCase(),
  ]);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted-foreground)]">
          <Link href="/achats" className="hover:underline">
            Achats
          </Link>{" "}
          / Nouvelle commande
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Créer une commande d&apos;achat
        </h1>
      </div>

      <PurchaseOrderForm
        suppliers={suppliers.items.map((item) => ({
          id: item.id,
          name: item.name,
        }))}
        variants={variants}
      />
    </section>
  );
}
