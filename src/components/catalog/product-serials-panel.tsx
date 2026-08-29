"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/catalog/status-badge";
import { deviceStatusLabel } from "@/modules/products/domain/policies";

const inputClass =
  "h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm";

type Serial = {
  id: string;
  imei1: string | null;
  imei2: string | null;
  serialNumber: string | null;
  status: string;
};

type Variant = {
  id: string;
  sku: string;
  name: string;
  serials: Serial[];
};

type ProductSerialsPanelProps = {
  variants: Variant[];
};

export function ProductSerialsPanel({ variants }: ProductSerialsPanelProps) {
  const [query, setQuery] = useState("");

  const serials = variants.flatMap((variant) =>
    variant.serials.map((serial) => ({ ...serial, variant })),
  );
  const filtered = serials.filter((item) => {
    const haystack =
      `${item.imei1 ?? ""} ${item.imei2 ?? ""} ${item.serialNumber ?? ""} ${item.variant.sku}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Inventaire sérialisé (IMEI)</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Consultation uniquement. Les IMEI et numéros de série s&apos;enregistrent
            à la réception de stock, pas ici.
          </p>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un IMEI ou n° de série…"
          className={`${inputClass} max-w-xs`}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          Aucun IMEI / numéro de série reçu pour ce produit.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs text-[var(--muted-foreground)]">
                <th className="py-2 pr-3 font-medium">IMEI 1</th>
                <th className="py-2 pr-3 font-medium">IMEI 2</th>
                <th className="py-2 pr-3 font-medium">N° de série</th>
                <th className="py-2 pr-3 font-medium">Variante</th>
                <th className="py-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 pr-3 font-mono text-xs">{item.imei1 ?? "—"}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{item.imei2 ?? "—"}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{item.serialNumber ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {item.variant.name} · {item.variant.sku}
                  </td>
                  <td className="py-2">
                    <StatusBadge label={deviceStatusLabel(item.status)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
