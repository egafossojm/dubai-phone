import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { AppError } from "@/lib/errors/app-error";
import { getSaleUseCase } from "@/modules/sales/application/complete-sale";
import { CreateReturnForm } from "@/components/returns/create-return-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function NouveauRetourPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePagePermission("sales.create");
  const params = await searchParams;
  const saleId = first(params.saleId);
  if (!saleId) {
    redirect("/ventes");
  }

  let sale;
  try {
    sale = await getSaleUseCase(saleId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  if (sale.status === "DRAFT" || sale.status === "CANCELLED" || sale.status === "RETURNED") {
    redirect(`/ventes/${sale.id}`);
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-[var(--muted-foreground)]">
          <Link href="/retours" className="hover:underline">
            Retours
          </Link>{" "}
          / Nouveau
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Nouveau retour
        </h1>
      </div>

      <CreateReturnForm
        saleId={sale.id}
        saleReference={sale.reference}
        items={sale.items.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          isSerialized: item.isSerialized,
          serial: item.serial,
          lineTotalLabel: item.lineTotalLabel,
        }))}
      />
    </section>
  );
}
