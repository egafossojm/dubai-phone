"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Impossible d'afficher cette page"
      message="Une erreur s'est produite. Vous pouvez réessayer."
      onRetry={reset}
    />
  );
}
