"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type Option = { id: string; name: string };

type ProductFiltersProps = {
  brands: Option[];
  categories: Option[];
  canCreate: boolean;
};

export function ProductFilters({
  brands,
  categories,
  canCreate,
}: ProductFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function apply(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", "1");
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    startTransition(() => {
      router.push(`/produits?${next.toString()}`);
    });
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <form
        className="grid grid-cols-1 gap-4 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          apply({ q });
        }}
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]" htmlFor="q">
            Recherche
          </label>
          <input
            id="q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Nom, SKU, IMEI…"
            className="h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]" htmlFor="categoryId">
            Catégorie
          </label>
          <select
            id="categoryId"
            defaultValue={searchParams.get("categoryId") ?? ""}
            onChange={(event) => apply({ categoryId: event.target.value })}
            className="h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          >
            <option value="">Toutes les catégories</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]" htmlFor="brandId">
            Marque
          </label>
          <select
            id="brandId"
            defaultValue={searchParams.get("brandId") ?? ""}
            onChange={(event) => apply({ brandId: event.target.value })}
            className="h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          >
            <option value="">Toutes les marques</option>
            {brands.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]" htmlFor="stock">
            Statut de stock
          </label>
          <select
            id="stock"
            defaultValue={searchParams.get("stock") ?? ""}
            onChange={(event) => apply({ stock: event.target.value })}
            className="h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          >
            <option value="">Tous les statuts de stock</option>
            <option value="IN_STOCK">En stock</option>
            <option value="LOW_STOCK">Stock faible</option>
            <option value="OUT_OF_STOCK">Rupture</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]" htmlFor="status">
            Statut produit
          </label>
          <select
            id="status"
            defaultValue={searchParams.get("status") ?? ""}
            onChange={(event) => apply({ status: event.target.value })}
            className="h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          >
            <option value="">Tous</option>
            <option value="ACTIVE">Actif</option>
            <option value="DRAFT">Brouillon</option>
            <option value="INACTIVE">Inactif</option>
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-2 md:col-span-4">
          <Button type="submit" variant="outline" disabled={pending}>
            Rechercher
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => apply({ serialized: searchParams.get("serialized") === "true" ? "" : "true" })}
          >
            {searchParams.get("serialized") === "true"
              ? "Tous les produits"
              : "Sérialisés uniquement"}
          </Button>
          <select
            aria-label="Trier"
            defaultValue={searchParams.get("sort") ?? "name"}
            onChange={(event) => apply({ sort: event.target.value })}
            className="h-10 rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          >
            <option value="name">Trier par nom</option>
            <option value="recent">Plus récents</option>
            <option value="price">Prix décroissant</option>
          </select>
          {canCreate ? (
            <Button type="button" className="ml-auto" onClick={() => router.push("/produits/nouveau")}>
              Ajouter un produit
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
