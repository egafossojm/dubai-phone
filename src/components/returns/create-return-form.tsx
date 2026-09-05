"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm";

type SaleLine = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  isSerialized: boolean;
  serial: { id: string; imei1: string | null } | null;
  lineTotalLabel: string;
};

type CreateReturnFormProps = {
  saleId: string;
  saleReference: string;
  items: SaleLine[];
};

export function CreateReturnForm({
  saleId,
  saleReference,
  items,
}: CreateReturnFormProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((item) => [item.id, true])),
  );
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.quantity])),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const payloadItems = items
      .filter((item) => selected[item.id])
      .map((item) => ({
        saleItemId: item.id,
        quantity: item.isSerialized ? 1 : quantities[item.id] ?? item.quantity,
        productSerialId: item.serial?.id,
      }));

    if (payloadItems.length === 0) {
      setPending(false);
      setError("Sélectionnez au moins une ligne.");
      return;
    }

    const response = await fetch("/api/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saleId,
        reason,
        items: payloadItems,
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: { message?: string };
      data?: { id: string };
    } | null;

    setPending(false);
    if (!response.ok || !payload?.success || !payload.data?.id) {
      setError(payload?.error?.message ?? "Création du retour impossible.");
      return;
    }
    router.push(`/retours/${payload.data.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <div>
        <h2 className="text-lg font-semibold">Demande de retour</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Vente {saleReference}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium" htmlFor="reason">
          Motif
        </label>
        <textarea
          id="reason"
          required
          minLength={3}
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
          placeholder="Défaut, erreur client, échange…"
        />
      </div>

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] pb-3 last:border-0"
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected[item.id] ?? false}
                onChange={(e) =>
                  setSelected((prev) => ({
                    ...prev,
                    [item.id]: e.target.checked,
                  }))
                }
              />
              <span>
                {item.name}
                <span className="ml-2 font-mono text-xs text-[var(--muted-foreground)]">
                  {item.sku}
                  {item.serial?.imei1 ? ` · IMEI ${item.serial.imei1}` : ""}
                </span>
              </span>
            </label>
            {!item.isSerialized ? (
              <input
                type="number"
                min={1}
                max={item.quantity}
                value={quantities[item.id] ?? item.quantity}
                onChange={(e) =>
                  setQuantities((prev) => ({
                    ...prev,
                    [item.id]: Number(e.target.value),
                  }))
                }
                className={inputClass + " w-24"}
                disabled={!selected[item.id]}
              />
            ) : (
              <span className="text-xs text-[var(--muted-foreground)]">×1</span>
            )}
            <span className="ml-auto text-sm tabular-nums">
              {item.lineTotalLabel}
            </span>
          </li>
        ))}
      </ul>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Envoi…" : "Créer le retour"}
      </Button>
    </form>
  );
}
