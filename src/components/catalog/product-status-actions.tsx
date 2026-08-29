"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type ProductStatusActionsProps = {
  productId: string;
  status: string;
  canDeactivate: boolean;
  canReactivate: boolean;
};

export function ProductStatusActions({
  productId,
  status,
  canDeactivate,
  canReactivate,
}: ProductStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(path: string, method: string, confirmMessage: string) {
    if (!window.confirm(confirmMessage)) {
      return;
    }
    setPending(true);
    setError(null);
    const response = await fetch(path, { method });
    const payload = (await response.json()) as {
      success: boolean;
      error?: { message: string };
    };
    setPending(false);
    if (!payload.success) {
      setError(payload.error?.message ?? "Action impossible.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "INACTIVE" && canDeactivate ? (
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() =>
            run(
              `/api/products/${productId}`,
              "DELETE",
              "Désactiver ce produit ? Vous pourrez le réactiver ensuite.",
            )
          }
        >
          {pending ? "…" : "Désactiver"}
        </Button>
      ) : null}
      {status === "INACTIVE" && canReactivate ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(
              `/api/products/${productId}/reactivate`,
              "POST",
              "Réactiver ce produit dans le catalogue ?",
            )
          }
        >
          {pending ? "…" : "Réactiver"}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="w-full text-sm text-[var(--destructive)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
