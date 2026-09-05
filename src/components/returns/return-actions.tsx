"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm";

type ReturnItem = {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  variantId: string;
  productSerialId: string | null;
  imei1: string | null;
};

type ReturnActionsProps = {
  returnId: string;
  status: string;
  resolution: string | null;
  refundableLabel: string;
  refundableXaf: string;
  items: ReturnItem[];
};

function newKey(prefix: string, returnId: string) {
  return `${prefix}-${returnId}-${crypto.randomUUID()}`;
}

export function ReturnActions({
  returnId,
  status,
  resolution,
  refundableLabel,
  refundableXaf,
  items,
}: ReturnActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [acceptResolution, setAcceptResolution] = useState<"REFUND" | "EXCHANGE">(
    "REFUND",
  );
  const [amountXaf, setAmountXaf] = useState(refundableXaf);
  const [method, setMethod] = useState<"CASH" | "ORANGE_MONEY" | "MTN_MOBILE_MONEY">(
    "CASH",
  );
  const [operatorReference, setOperatorReference] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    newKey("refund", returnId),
  );
  const [exchangeKey, setExchangeKey] = useState(() =>
    newKey("exchange", returnId),
  );
  const [replacementImei, setReplacementImei] = useState<Record<string, string>>(
    {},
  );
  const submittingRef = useRef(false);

  useEffect(() => {
    setAmountXaf(refundableXaf);
  }, [refundableXaf]);

  async function post(path: string, body?: unknown) {
    if (submittingRef.current) {
      return false;
    }
    submittingRef.current = true;
    setPending(true);
    setError(null);
    setSuccess(null);

    const response = await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: { message?: string };
    } | null;

    submittingRef.current = false;
    setPending(false);

    if (!response.ok || !payload?.success) {
      setError(payload?.error?.message ?? "Action impossible.");
      return false;
    }

    setSuccess("Action enregistrée.");
    router.refresh();
    return true;
  }

  async function resolveReplacementSerialId(
    item: ReturnItem,
  ): Promise<string | undefined> {
    const q = replacementImei[item.id]?.trim();
    if (!q) {
      return undefined;
    }
    const response = await fetch(
      `/api/inventory/serials/lookup?q=${encodeURIComponent(q)}`,
    );
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: { message?: string };
      data?: { id: string; status: string; variantId: string };
    } | null;
    if (!response.ok || !payload?.success || !payload.data) {
      throw new Error(payload?.error?.message ?? `IMEI introuvable : ${q}`);
    }
    if (payload.data.status !== "IN_STOCK") {
      throw new Error(`Appareil non disponible (${payload.data.status}).`);
    }
    if (payload.data.variantId !== item.variantId) {
      throw new Error("L'IMEI ne correspond pas à la variante retournée.");
    }
    return payload.data.id;
  }

  if (status === "COMPLETED" || status === "REJECTED") {
    return null;
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-lg font-semibold">Actions SAV</h2>

      {status === "REQUESTED" ? (
        <Button
          type="button"
          disabled={pending}
          onClick={() => void post(`/api/returns/${returnId}/inspect`)}
        >
          Démarrer l&apos;inspection
        </Button>
      ) : null}

      {status === "INSPECTING" ? (
        <div className="flex flex-wrap gap-2">
          <select
            value={acceptResolution}
            onChange={(e) =>
              setAcceptResolution(e.target.value as "REFUND" | "EXCHANGE")
            }
            className={inputClass + " max-w-xs"}
          >
            <option value="REFUND">Accepter → remboursement</option>
            <option value="EXCHANGE">Accepter → échange</option>
          </select>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              void post(`/api/returns/${returnId}/accept`, {
                resolution: acceptResolution,
              })
            }
          >
            Accepter
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              void post(`/api/returns/${returnId}/reject`, {
                reason: "Non conforme à l'inspection",
              })
            }
          >
            Rejeter
          </Button>
        </div>
      ) : null}

      {status === "ACCEPTED" &&
      resolution === "REFUND" &&
      BigInt(refundableXaf || "0") > BigInt(0) ? (
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => {
              const ok = await post(`/api/returns/${returnId}/refund`, {
                amountXaf,
                method,
                idempotencyKey,
                operatorReference: operatorReference || undefined,
              });
              if (ok) {
                setIdempotencyKey(newKey("refund", returnId));
                setOperatorReference("");
              }
            })();
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="amount">
              Montant (reste {refundableLabel})
            </label>
            <input
              id="amount"
              required
              inputMode="numeric"
              value={amountXaf}
              onChange={(e) => setAmountXaf(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="method">
              Mode
            </label>
            <select
              id="method"
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
              className={inputClass}
            >
              <option value="CASH">Espèces</option>
              <option value="ORANGE_MONEY">Orange Money</option>
              <option value="MTN_MOBILE_MONEY">MTN MoMo</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="opRef">
              Réf. opérateur
            </label>
            <input
              id="opRef"
              value={operatorReference}
              onChange={(e) => setOperatorReference(e.target.value)}
              className={inputClass}
              placeholder="OM / MoMo"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Remboursement…" : "Enregistrer le remboursement"}
            </Button>
          </div>
        </form>
      ) : null}

      {status === "ACCEPTED" && resolution === "EXCHANGE" ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => {
              try {
                setError(null);
                const mapped = [];
                for (const item of items) {
                  const replacementProductSerialId =
                    await resolveReplacementSerialId(item);
                  mapped.push({
                    returnItemId: item.id,
                    replacementProductSerialId,
                  });
                }
                const ok = await post(`/api/returns/${returnId}/exchange`, {
                  items: mapped,
                  idempotencyKey: exchangeKey,
                });
                if (ok) {
                  setExchangeKey(newKey("exchange", returnId));
                }
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Échange impossible.",
                );
              }
            })();
          }}
        >
          <p className="text-sm text-[var(--muted-foreground)]">
            Pour un produit sérialisé, saisissez l&apos;IMEI du nouvel appareil
            en stock. Sinon laissez vide (même SKU).
          </p>
          {items.map((item) => (
            <div key={item.id} className="grid gap-2 sm:grid-cols-[1fr_1fr]">
              <p className="text-sm">
                {item.name}{" "}
                <span className="font-mono text-xs text-[var(--muted-foreground)]">
                  {item.sku}
                  {item.imei1 ? ` · IMEI ${item.imei1}` : ""}
                </span>
              </p>
              <input
                placeholder="IMEI de remplacement (si sérialisé)"
                value={replacementImei[item.id] ?? ""}
                onChange={(e) =>
                  setReplacementImei((prev) => ({
                    ...prev,
                    [item.id]: e.target.value,
                  }))
                }
                className={inputClass}
              />
            </div>
          ))}
          <Button type="submit" disabled={pending}>
            {pending ? "Échange…" : "Finaliser l'échange"}
          </Button>
        </form>
      ) : null}

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
    </div>
  );
}
