"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type OrderItem = {
  id: string;
  productName: string;
  sku: string;
  isSerialized: boolean;
  quantityRemaining: number;
  unitCostXaf: string;
};

type SerialDraft = {
  imei1: string;
  imei2: string;
  serialNumber: string;
  condition: "NEW" | "DAMAGED";
};

type ReceivePurchaseFormProps = {
  purchaseOrderId: string;
  items: OrderItem[];
};

function emptySerial(): SerialDraft {
  return { imei1: "", imei2: "", serialNumber: "", condition: "NEW" };
}

export function ReceivePurchaseForm({
  purchaseOrderId,
  items,
}: ReceivePurchaseFormProps) {
  const router = useRouter();
  const receivable = useMemo(
    () => items.filter((item) => item.quantityRemaining > 0),
    [items],
  );
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      receivable.map((item) => [item.id, String(Math.min(1, item.quantityRemaining))]),
    ),
  );
  const [serials, setSerials] = useState<Record<string, SerialDraft[]>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useMemo(
    () => `recv-${purchaseOrderId}-${crypto.randomUUID()}`,
    [purchaseOrderId],
  );
  const submittingRef = useRef(false);

  function syncSerialRows(itemId: string, qty: number, isSerialized: boolean) {
    if (!isSerialized) {
      return;
    }
    setSerials((current) => {
      const existing = current[itemId] ?? [];
      const next = Array.from({ length: qty }, (_, index) => existing[index] ?? emptySerial());
      return { ...current, [itemId]: next };
    });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    setPending(true);
    setError(null);

    const lines = receivable
      .map((item) => {
        const quantityReceived = Number(quantities[item.id] ?? 0);
        if (!quantityReceived) {
          return null;
        }
        return {
          purchaseOrderItemId: item.id,
          quantityReceived,
          unitCostXaf: item.unitCostXaf,
          ...(item.isSerialized
            ? {
                serials: (serials[item.id] ?? []).slice(0, quantityReceived),
              }
            : {}),
        };
      })
      .filter(Boolean);

    if (lines.length === 0) {
      submittingRef.current = false;
      setPending(false);
      setError("Indiquez au moins une quantité à réceptionner.");
      return;
    }

    const response = await fetch("/api/purchases/receive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId,
        idempotencyKey,
        lines,
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: { message?: string };
    } | null;
    if (!response.ok || !payload?.success) {
      submittingRef.current = false;
      setPending(false);
      setError(payload?.error?.message ?? "Réception impossible.");
      return;
    }
    router.refresh();
  }

  if (receivable.length === 0) {
    return null;
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <div>
        <h2 className="text-lg font-semibold">Réceptionner la marchandise</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Les quantités créent des mouvements de stock. Sur-réception interdite.
          Un appareil endommagé reste traçable mais hors stock vendable.
        </p>
      </div>

      {receivable.map((item) => {
        const qty = Number(quantities[item.id] ?? 0);
        return (
          <div key={item.id} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-medium">{item.productName}</p>
                <p className="font-mono text-xs text-[var(--muted-foreground)]">
                  {item.sku} · restant {item.quantityRemaining}
                  {item.isSerialized ? " · sérialisé" : ""}
                </p>
              </div>
              <input
                type="number"
                min={0}
                max={item.quantityRemaining}
                value={quantities[item.id] ?? "0"}
                onChange={(event) => {
                  const value = event.target.value;
                  setQuantities((current) => ({ ...current, [item.id]: value }));
                  syncSerialRows(item.id, Number(value) || 0, item.isSerialized);
                }}
                className="h-10 w-28 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
              />
            </div>
            {item.isSerialized && qty > 0
              ? (serials[item.id] ?? Array.from({ length: qty }, () => emptySerial())).map(
                  (serial, index) => (
                    <div key={index} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <input
                        placeholder={`IMEI 1 #${index + 1}`}
                        value={serial.imei1}
                        onChange={(event) =>
                          setSerials((current) => {
                            const rows = [...(current[item.id] ?? [])];
                            rows[index] = { ...rows[index]!, imei1: event.target.value };
                            return { ...current, [item.id]: rows };
                          })
                        }
                        className="h-10 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
                        required
                      />
                      <input
                        placeholder="IMEI 2 (optionnel)"
                        value={serial.imei2}
                        onChange={(event) =>
                          setSerials((current) => {
                            const rows = [...(current[item.id] ?? [])];
                            rows[index] = { ...rows[index]!, imei2: event.target.value };
                            return { ...current, [item.id]: rows };
                          })
                        }
                        className="h-10 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
                      />
                      <input
                        placeholder="N° série (optionnel)"
                        value={serial.serialNumber}
                        onChange={(event) =>
                          setSerials((current) => {
                            const rows = [...(current[item.id] ?? [])];
                            rows[index] = {
                              ...rows[index]!,
                              serialNumber: event.target.value,
                            };
                            return { ...current, [item.id]: rows };
                          })
                        }
                        className="h-10 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
                      />
                      <select
                        value={serial.condition}
                        onChange={(event) =>
                          setSerials((current) => {
                            const rows = [...(current[item.id] ?? [])];
                            rows[index] = {
                              ...rows[index]!,
                              condition: event.target.value as "NEW" | "DAMAGED",
                            };
                            return { ...current, [item.id]: rows };
                          })
                        }
                        className="h-10 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
                        aria-label={`État appareil #${index + 1}`}
                      >
                        <option value="NEW">Neuf</option>
                        <option value="DAMAGED">Endommagé</option>
                      </select>
                    </div>
                  ),
                )
              : null}
          </div>
        );
      })}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Réception…" : "Valider la réception"}
      </Button>
    </form>
  );
}
