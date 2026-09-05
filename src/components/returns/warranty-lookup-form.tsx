"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm";

type WarrantyHit = {
  id: string;
  reference: string;
  status: string;
  statusLabel: string;
  startsAt: string;
  endsAt: string;
  saleId: string;
  saleReference: string;
  customerName: string | null;
  customerPhone: string | null;
  imei1: string | null;
  serialNumber: string | null;
  sku: string | null;
  productName: string | null;
};

export function WarrantyLookupForm() {
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<WarrantyHit[]>([]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch(
      `/api/warranties/lookup?q=${encodeURIComponent(q.trim())}`,
    );
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: { message?: string };
      data?: { items: WarrantyHit[] };
    } | null;
    setPending(false);
    if (!response.ok || !payload?.success) {
      setError(payload?.error?.message ?? "Recherche impossible.");
      setItems([]);
      return;
    }
    setItems(payload.data?.items ?? []);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <input
          required
          minLength={2}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="IMEI, N° série, réf. garantie ou vente…"
          className={inputClass + " min-w-[240px] flex-1"}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Recherche…" : "Chercher"}
        </Button>
      </form>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {items.length === 0 && !error && !pending ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          Aucun résultat pour le moment.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">Garantie</th>
                <th className="px-4 py-3 font-medium">Appareil</th>
                <th className="px-4 py-3 font-medium">Début</th>
                <th className="px-4 py-3 font-medium">Fin</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Vente</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">{row.reference}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {row.customerName ?? "—"}
                      {row.customerPhone ? ` · ${row.customerPhone}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{row.productName ?? "—"}</p>
                    <p className="font-mono text-xs text-[var(--muted-foreground)]">
                      {row.sku ?? ""}
                      {row.imei1 ? ` · IMEI ${row.imei1}` : ""}
                      {row.serialNumber ? ` · SN ${row.serialNumber}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {new Date(row.startsAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    {new Date(row.endsAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.status === "EXPIRED" ? "text-amber-800" : undefined
                      }
                    >
                      {row.statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/ventes/${row.saleId}`}
                      className="font-mono text-xs hover:underline"
                    >
                      {row.saleReference}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
