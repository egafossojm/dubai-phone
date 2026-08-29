export default function HomePage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="max-w-2xl text-[var(--muted-foreground)]">
          Application de gestion retail Dubai Phone. Les modules métier (POS,
          stock, crédits) seront ajoutés progressivement.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          Authentification
        </h2>
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          Vous êtes connecté. Les actions visibles dépendent de votre rôle ;
          le serveur refuse toute opération non autorisée.
        </p>
      </div>
    </section>
  );
}
