"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

type InventoryFiltersProps = {
  canAdjust: boolean;
};

export function InventoryFilters({ canAdjust }: InventoryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function apply(patch: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    next.delete("page");
    router.push(`/stock?${next.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-[180px] flex-1">
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]" htmlFor="q">
          Recherche
        </label>
        <input
          id="q"
          className="h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="SKU, nom, code-barres…"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              apply({ q: (event.target as HTMLInputElement).value.trim() });
            }
          }}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]" htmlFor="stock">
          Niveau
        </label>
        <select
          id="stock"
          className="h-10 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          defaultValue={searchParams.get("stock") ?? ""}
          onChange={(event) => apply({ stock: event.target.value })}
        >
          <option value="">Tous</option>
          <option value="IN_STOCK">En stock</option>
          <option value="LOW_STOCK">Stock faible</option>
          <option value="OUT_OF_STOCK">Rupture</option>
        </select>
      </div>
      <div>
        <label
          className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]"
          htmlFor="serialized"
        >
          Sérialisé
        </label>
        <select
          id="serialized"
          className="h-10 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          defaultValue={searchParams.get("serialized") ?? ""}
          onChange={(event) => apply({ serialized: event.target.value })}
        >
          <option value="">Tous</option>
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/stock/mouvements")}>
          Mouvements
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/stock/imei")}>
          IMEI
        </Button>
        {canAdjust ? (
          <span className="sr-only">Ajustement disponible sur la fiche détail</span>
        ) : null}
      </div>
    </div>
  );
}
