import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getPurchaseInvoiceUseCase } from "@/modules/purchases/application/receive";
import { AppError } from "@/lib/errors/app-error";
import { buttonVariants } from "@/components/ui/button";

type PageProps = { params: Promise<{ id: string }> };

export default async function PurchaseInvoiceDetailPage({ params }: PageProps) {
  await requirePagePermission("purchases.read");
  const { id } = await params;
  let invoice;
  try {
    invoice = await getPurchaseInvoiceUseCase(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted-foreground)]">
          <Link href="/achats" className="hover:underline">
            Achats
          </Link>{" "}
          /{" "}
          <Link href="/achats/factures" className="hover:underline">
            Factures
          </Link>{" "}
          / {invoice.reference}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {invoice.reference}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {invoice.supplier.name} · commande {invoice.purchaseOrderReference} ·{" "}
          {invoice.totalLabel}
        </p>
      </div>

      <div className="flex gap-2">
        <Link
          href={`/achats/${invoice.purchaseOrderId}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Voir la commande
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-3 font-medium">Produit</th>
              <th className="px-4 py-3 font-medium">Qté</th>
              <th className="px-4 py-3 font-medium">Coût unit.</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">IMEI</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{item.productName}</div>
                  <div className="font-mono text-xs text-[var(--muted-foreground)]">
                    {item.sku}
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums">{item.quantityReceived}</td>
                <td className="px-4 py-3">{item.unitCostLabel}</td>
                <td className="px-4 py-3">{item.lineTotalLabel}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {item.serials.length === 0
                    ? "—"
                    : item.serials
                        .map((serial) => serial.imei1 ?? serial.serialNumber)
                        .filter(Boolean)
                        .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
