import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";

export default function NotFound() {
  return (
    <EmptyState
      title="Page introuvable"
      description="La ressource demandée n'existe pas ou a été déplacée."
      action={
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 text-sm font-medium transition-colors hover:bg-[var(--muted)]"
        >
          Retour au tableau de bord
        </Link>
      }
    />
  );
}
