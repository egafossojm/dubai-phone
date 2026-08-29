"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm";

type ProductVariantsPanelProps = {
  productId: string;
  showCost: boolean;
};

export function ProductVariantsPanel({
  productId,
  showCost,
}: ProductVariantsPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [sellingPriceXaf, setSellingPriceXaf] = useState("");
  const [costPriceXaf, setCostPriceXaf] = useState("0");
  const [warrantyMonths, setWarrantyMonths] = useState("0");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch(`/api/products/${productId}/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku,
        name,
        barcode,
        sellingPriceXaf,
        costPriceXaf: showCost ? costPriceXaf : "0",
        warrantyMonths: Number(warrantyMonths || 0),
      }),
    });
    const payload = (await response.json()) as {
      success: boolean;
      error?: { message: string };
    };
    setPending(false);
    if (!payload.success) {
      setError(payload.error?.message ?? "Création impossible.");
      return;
    }
    setOpen(false);
    setSku("");
    setName("");
    setBarcode("");
    setSellingPriceXaf("");
    router.refresh();
  }

  return (
    <div className="mt-4">
      {open ? (
        <form className="grid grid-cols-1 gap-3 md:grid-cols-3" onSubmit={onSubmit}>
          <input required value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU *" className={inputClass} />
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom variante *" className={inputClass} />
          <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Code-barres" className={inputClass} />
          <input required inputMode="numeric" value={sellingPriceXaf} onChange={(e) => setSellingPriceXaf(e.target.value)} placeholder="Prix TTC *" className={inputClass} />
          {showCost ? (
            <input inputMode="numeric" value={costPriceXaf} onChange={(e) => setCostPriceXaf(e.target.value)} placeholder="Coût" className={inputClass} />
          ) : null}
          <input inputMode="numeric" value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value)} placeholder="Garantie (mois)" className={inputClass} />
          <div className="flex gap-2 md:col-span-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Ajout…" : "Ajouter la variante"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-[var(--destructive)] md:col-span-3">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          Ajouter une variante
        </Button>
      )}
    </div>
  );
}
