"use client";

import { ErrorState } from "@/components/shared/error-state";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  console.error(error);

  return (
    <html lang="fr">
      <body>
        <ErrorState
          title="Erreur critique"
          message="L'application a rencontré un problème inattendu."
          onRetry={reset}
          className="min-h-screen"
        />
      </body>
    </html>
  );
}
