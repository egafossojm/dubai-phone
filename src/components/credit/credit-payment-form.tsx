"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm";

type InstallmentOption = {
  id: string;
  sequence: number;
  remainingLabel: string;
  status: string;
};

type CreditPaymentFormProps = {
  creditId: string;
  remainingLabel: string;
  installments: InstallmentOption[];
};

function newIdempotencyKey(creditId: string) {
  return `credit-pay-${creditId}-${crypto.randomUUID()}`;
}

export function CreditPaymentForm({
  creditId,
  remainingLabel,
  installments,
}: CreditPaymentFormProps) {
  const router = useRouter();
  const openInstallments = installments.filter((row) => row.status !== "PAID");
  const [amountXaf, setAmountXaf] = useState("");
  const [method, setMethod] = useState<"CASH" | "ORANGE_MONEY" | "MTN_MOBILE_MONEY">(
    "CASH",
  );
  const [installmentId, setInstallmentId] = useState("");
  const [operatorReference, setOperatorReference] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    newIdempotencyKey(creditId),
  );
  const submittingRef = useRef(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    setPending(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/credit/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creditId,
        amountXaf,
        method,
        idempotencyKey,
        installmentId: installmentId || undefined,
        operatorReference: operatorReference || undefined,
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: { message?: string };
      data?: { replayed?: boolean };
    } | null;

    if (!response.ok || !payload?.success) {
      submittingRef.current = false;
      setPending(false);
      setError(payload?.error?.message ?? "Paiement impossible.");
      return;
    }

    setPending(false);
    submittingRef.current = false;
    setSuccess(
      payload.data?.replayed
        ? "Paiement déjà enregistré (rejeu)."
        : "Paiement enregistré.",
    );
    setAmountXaf("");
    setOperatorReference("");
    setInstallmentId("");
    setIdempotencyKey(newIdempotencyKey(creditId));
    router.refresh();
  }

  if (openInstallments.length === 0) {
    return null;
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <div>
        <h2 className="text-lg font-semibold">Enregistrer un paiement</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Reste dû : {remainingLabel}. Surpaiement refusé.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium" htmlFor="amount">
            Montant (FCFA)
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
          <label className="mb-1 block text-xs font-medium" htmlFor="installment">
            Échéance (optionnel)
          </label>
          <select
            id="installment"
            value={installmentId}
            onChange={(e) => setInstallmentId(e.target.value)}
            className={inputClass}
          >
            <option value="">Imputation automatique</option>
            {openInstallments.map((row) => (
              <option key={row.id} value={row.id}>
                #{row.sequence} — reste {row.remainingLabel}
              </option>
            ))}
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

      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Valider le paiement"}
      </Button>
    </form>
  );
}
