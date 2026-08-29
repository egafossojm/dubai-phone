"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Option = { id: string; name: string };
type VariantOption = {
  id: string;
  label: string;
  costPriceXaf: string;
  isSerialized: boolean;
};

type Line = {
  variantId: string;
  quantityOrdered: string;
  unitCostXaf: string;
};

type PurchaseOrderFormProps = {
  suppliers: Option[];
  variants: VariantOption[];
};

export function PurchaseOrderForm({ suppliers, variants }: PurchaseOrderFormProps) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([
    {
      variantId: variants[0]?.id ?? "",
      quantityOrdered: "1",
      unitCostXaf: variants[0]?.costPriceXaf ?? "0",
    },
  ]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(asOrdered: boolean) {
    setPending(true);
    setError(null);
    const response = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        notes,
        submit: asOrdered,
        items: lines.map((line) => ({
          variantId: line.variantId,
          quantityOrdered: Number(line.quantityOrdered),
          unitCostXaf: line.unitCostXaf,
        })),
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: { message?: string };
      data?: { id: string };
    } | null;
    setPending(false);
    if (!response.ok || !payload?.success || !payload.data) {
      setError(payload?.error?.message ?? "Enregistrement impossible.");
      return;
    }
    router.push(`/achats/${payload.data.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="supplier">
            Fournisseur
          </label>
          <select
            id="supplier"
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm"
            required
          >
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="notes">
            Notes
          </label>
          <input
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-medium">Lignes</h2>
        {lines.map((line, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-3">
            <select
              value={line.variantId}
              onChange={(event) => {
                const variant = variants.find((item) => item.id === event.target.value);
                setLines((current) =>
                  current.map((row, rowIndex) =>
                    rowIndex === index
                      ? {
                          ...row,
                          variantId: event.target.value,
                          unitCostXaf: variant?.costPriceXaf ?? row.unitCostXaf,
                        }
                      : row,
                  ),
                );
              }}
              className="h-10 rounded-md border border-[var(--border)] bg-white px-3 text-sm sm:col-span-1"
            >
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={line.quantityOrdered}
              onChange={(event) =>
                setLines((current) =>
                  current.map((row, rowIndex) =>
                    rowIndex === index
                      ? { ...row, quantityOrdered: event.target.value }
                      : row,
                  ),
                )
              }
              className="h-10 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
              placeholder="Qté"
            />
            <input
              type="number"
              min={0}
              value={line.unitCostXaf}
              onChange={(event) =>
                setLines((current) =>
                  current.map((row, rowIndex) =>
                    rowIndex === index
                      ? { ...row, unitCostXaf: event.target.value }
                      : row,
                  ),
                )
              }
              className="h-10 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
              placeholder="Coût unitaire FCFA"
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setLines((current) => [
              ...current,
              {
                variantId: variants[0]?.id ?? "",
                quantityOrdered: "1",
                unitCostXaf: variants[0]?.costPriceXaf ?? "0",
              },
            ])
          }
        >
          Ajouter une ligne
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={() => submit(false)}>
          Enregistrer brouillon
        </Button>
        <Button type="button" disabled={pending || !supplierId} onClick={() => submit(true)}>
          Confirmer la commande
        </Button>
      </div>
    </div>
  );
}
