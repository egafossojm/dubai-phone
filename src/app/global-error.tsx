"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "client_global_error",
        time: new Date().toISOString(),
        digest: error.digest,
        name: error.name,
        message: error.message,
      }),
    );
  }, [error]);

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
