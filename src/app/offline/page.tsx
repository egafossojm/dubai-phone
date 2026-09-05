import Link from "next/link";

export default function OfflinePage() {
  return (
    <section className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-2xl font-semibold">Hors ligne</h1>
      <p className="max-w-md text-sm text-[var(--muted-foreground)]">
        Pas de réseau. Si le shell POS est déjà chargé, ouvrez la caisse pour
        vendre depuis le cache local — les ventes iront dans la file de
        synchronisation.
      </p>
      <Link href="/pos" className="text-sm underline-offset-2 hover:underline">
        Aller à la caisse
      </Link>
      <Link href="/sync" className="text-sm underline-offset-2 hover:underline">
        Centre de synchronisation
      </Link>
    </section>
  );
}
