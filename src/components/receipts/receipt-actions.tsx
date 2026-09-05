"use client";

import { useTransition } from "react";
import { buttonVariants } from "@/components/ui/button";

type Props = {
  saleId: string;
};

export function ReceiptActions({ saleId }: Props) {
  const [pending, startTransition] = useTransition();

  function handlePrint() {
    startTransition(async () => {
      try {
        await fetch(`/api/receipts/${saleId}/print`, { method: "POST" });
      } catch {
        // Print still proceeds even if mark-printed fails.
      }
      window.print();
    });
  }

  return (
    <div className="no-print flex flex-wrap gap-2">
      <button
        type="button"
        onClick={handlePrint}
        disabled={pending}
        className={buttonVariants()}
      >
        Imprimer
      </button>
      <a
        href={`/api/receipts/${saleId}/pdf`}
        className={buttonVariants({ variant: "outline" })}
        download
      >
        Télécharger PDF
      </a>
      <a
        href={`/api/receipts/${saleId}/html`}
        className={buttonVariants({ variant: "outline" })}
        download
      >
        Télécharger HTML
      </a>
    </div>
  );
}
