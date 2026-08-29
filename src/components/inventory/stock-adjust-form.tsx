"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type SerialOption = {
  id: string;
  label: string;
};

type StockAdjustFormProps = {
  variantId: string;
  isSerialized: boolean;
  serials: SerialOption[];
};

export function StockAdjustForm({
  variantId,
  isSerialized,
  serials,
}: StockAdjustFormProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState("-1");
  const [type, setType] = useState<"STOCK_ADJUSTMENT" | "DAMAGED" | "LOST">(
    "STOCK_ADJUSTMENT",
  );
  const [reason, setReason] = useState("");
  const [productSerialId, setProductSerialId] = useState(serials[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/inventory/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variantId,
        quantity: Number(quantity),
        type,
        reason,
        ...(isSerialized && productSerialId ? { productSerialId } : {}),
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: { message?: string };
    } | null;

    setPending(false);
    if (!response.ok || !payload?.success) {
      setError(payload?.error?.message ?? "Ajustement impossible.");
      return;
    }

    setSuccess("Ajustement enregistré.");
    setReason("");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <div>
        <h2 className="text-lg font-semibold">Ajuster le stock</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Toute modification crée un mouvement audité. Motif obligatoire.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="qty">
            Quantité (+/-)
          </label>
          <input
            id="qty"
            type="number"
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="type">
            Type
          </label>
          <select
            id="type"
            value={type}
            onChange={(event) =>
              setType(event.target.value as typeof type)
            }
            className="h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          >
            <option value="STOCK_ADJUSTMENT">Ajustement</option>
            <option value="DAMAGED">Endommagé</option>
            <option value="LOST">Perte</option>
          </select>
        </div>
      </div>

      {isSerialized ? (
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="serial">
            Appareil
          </label>
          <select
            id="serial"
            value={productSerialId}
            onChange={(event) => setProductSerialId(event.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm"
            required
          >
            {serials.length === 0 ? (
              <option value="">Aucun appareil</option>
            ) : (
              serials.map((serial) => (
                <option key={serial.id} value={serial.id}>
                  {serial.label}
                </option>
              ))
            )}
          </select>
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="reason">
          Motif
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
          placeholder="Ex. inventaire physique — écart compté"
          required
          minLength={3}
        />
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-emerald-700" role="status">
          {success}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || (isSerialized && !productSerialId)}>
        {pending ? "Enregistrement…" : "Enregistrer l'ajustement"}
      </Button>
    </form>
  );
}
