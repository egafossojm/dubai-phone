import { requirePagePermission } from "@/lib/auth/page-guard";
import { SyncCenter } from "@/components/sales/sync-center";

export default async function SyncPage() {
  await requirePagePermission("sales.create");
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Synchronisation POS
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          File des ventes hors ligne, conflits et cache local. Une vente locale
          n&apos;est définitive qu&apos;après statut Synchronisé.
        </p>
      </div>
      <SyncCenter />
    </section>
  );
}
