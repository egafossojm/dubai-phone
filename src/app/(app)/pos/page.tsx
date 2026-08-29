import { requirePagePermission } from "@/lib/auth/page-guard";
import { PosTerminal } from "@/components/sales/pos-terminal";

export default async function PosPage() {
  await requirePagePermission("sales.create");
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Point de vente</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Recherche SKU / IMEI, panier, paiement comptant ou crédit.
        </p>
      </div>
      <PosTerminal />
    </section>
  );
}
