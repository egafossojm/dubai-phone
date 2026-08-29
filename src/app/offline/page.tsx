export default function OfflinePage() {
  return (
    <section className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-2xl font-semibold">Hors ligne</h1>
      <p className="max-w-md text-sm text-[var(--muted-foreground)]">
        Aucune connexion réseau. Le mode POS hors ligne sera disponible dans une
        phase ultérieure.
      </p>
    </section>
  );
}
