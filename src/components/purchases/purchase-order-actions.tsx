"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type PurchaseOrderActionsProps = {
  purchaseOrderId: string;
  status: string;
  canCreate: boolean;
};

export function PurchaseOrderActions({
  purchaseOrderId,
  status,
  canCreate,
}: PurchaseOrderActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canCreate) {
    return null;
  }

  async function call(path: string, method = "POST") {
    setPending(true);
    setError(null);
    const response = await fetch(path, { method });
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: { message?: string };
    } | null;
    setPending(false);
    if (!response.ok || !payload?.success) {
      setError(payload?.error?.message ?? "Action impossible.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" ? (
        <Button
          type="button"
          disabled={pending}
          onClick={() => call(`/api/purchases/${purchaseOrderId}/submit`)}
        >
          Confirmer la commande
        </Button>
      ) : null}
      {status === "DRAFT" || status === "ORDERED" ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => call(`/api/purchases/${purchaseOrderId}`, "DELETE")}
        >
          Annuler
        </Button>
      ) : null}
      {status === "PARTIALLY_RECEIVED" ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => call(`/api/purchases/${purchaseOrderId}/close`)}
        >
          Clôturer le reste
        </Button>
      ) : null}
      {error ? <p className="basis-full text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
