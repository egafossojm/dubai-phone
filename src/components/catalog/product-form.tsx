"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Option = { id: string; name: string };

export type ProductFormValues = {
  name: string;
  brandId: string;
  categoryId: string;
  isSerialized: boolean;
  status: "DRAFT" | "ACTIVE" | "INACTIVE";
  variantId?: string;
  variant: {
    sku: string;
    name: string;
    barcode: string;
    sellingPriceXaf: string;
    costPriceXaf: string;
    warrantyMonths: string;
  };
};

type ProductFormProps = {
  mode: "create" | "edit";
  productId?: string;
  initial: ProductFormValues;
  brands: Option[];
  categories: Option[];
  showCost: boolean;
  canCreateReferential: boolean;
};

const inputClass =
  "h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm";

async function readApiError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return payload?.error?.message ?? "Enregistrement impossible.";
}

export function ProductForm({
  mode,
  productId,
  initial,
  brands,
  categories,
  showCost,
  canCreateReferential,
}: ProductFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [brandOptions, setBrandOptions] = useState(brands);
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [newBrand, setNewBrand] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function updateVariant(field: keyof ProductFormValues["variant"], value: string) {
    setValues((current) => ({
      ...current,
      variant: { ...current.variant, [field]: value },
    }));
  }

  async function createReferential(
    kind: "brands" | "categories",
    name: string,
  ): Promise<Option | null> {
    const response = await fetch(`/api/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const payload = (await response.json()) as {
      success: boolean;
      data?: Option;
      error?: { message: string };
    };
    if (!payload.success || !payload.data) {
      setError(payload.error?.message ?? "Création impossible.");
      return null;
    }
    return payload.data;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const payload =
      mode === "create"
        ? {
            name: values.name,
            brandId: values.brandId,
            categoryId: values.categoryId,
            isSerialized: values.isSerialized,
            status: values.status,
            variant: {
              sku: values.variant.sku,
              name: values.variant.name,
              barcode: values.variant.barcode,
              sellingPriceXaf: values.variant.sellingPriceXaf,
              costPriceXaf: values.variant.costPriceXaf || "0",
              warrantyMonths: Number(values.variant.warrantyMonths || 0),
            },
          }
        : {
            name: values.name,
            brandId: values.brandId,
            categoryId: values.categoryId,
            isSerialized: values.isSerialized,
            ...(values.status === "INACTIVE"
              ? {}
              : { status: values.status }),
          };

    const url =
      mode === "create" ? "/api/products" : `/api/products/${productId}`;
    const response = await fetch(url, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setError(await readApiError(response));
      setPending(false);
      return;
    }

    const body = (await response.json()) as { data?: { id: string } };
    const id = body.data?.id ?? productId;
    if (mode === "edit" && values.variantId) {
      const variantResponse = await fetch(
        `/api/products/variants/${values.variantId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sku: values.variant.sku,
            name: values.variant.name,
            barcode: values.variant.barcode || null,
            sellingPriceXaf: values.variant.sellingPriceXaf,
            costPriceXaf: showCost ? values.variant.costPriceXaf || "0" : undefined,
            warrantyMonths: Number(values.variant.warrantyMonths || 0),
          }),
        },
      );
      if (!variantResponse.ok) {
        setError(await readApiError(variantResponse));
        setPending(false);
        return;
      }
    }

    setPending(false);
    router.push(`/produits/${id}`);
    router.refresh();
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Informations générales</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium" htmlFor="name">
              Nom du produit *
            </label>
            <input
              id="name"
              required
              value={values.name}
              onChange={(event) => setValues({ ...values, name: event.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="brandId">
              Marque *
            </label>
            <select
              id="brandId"
              required
              value={values.brandId}
              onChange={(event) => setValues({ ...values, brandId: event.target.value })}
              className={inputClass}
            >
              <option value="">Sélectionner une marque</option>
              {brandOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {canCreateReferential ? (
              <div className="mt-2 flex gap-2">
                <input
                  value={newBrand}
                  onChange={(event) => setNewBrand(event.target.value)}
                  placeholder="Nouvelle marque"
                  className={inputClass}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    const created = await createReferential("brands", newBrand);
                    if (created) {
                      setBrandOptions((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
                      setValues((current) => ({ ...current, brandId: created.id }));
                      setNewBrand("");
                    }
                  }}
                >
                  Ajouter
                </Button>
              </div>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="categoryId">
              Catégorie *
            </label>
            <select
              id="categoryId"
              required
              value={values.categoryId}
              onChange={(event) => setValues({ ...values, categoryId: event.target.value })}
              className={inputClass}
            >
              <option value="">Sélectionner une catégorie</option>
              {categoryOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {canCreateReferential ? (
              <div className="mt-2 flex gap-2">
                <input
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  placeholder="Nouvelle catégorie"
                  className={inputClass}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    const created = await createReferential("categories", newCategory);
                    if (created) {
                      setCategoryOptions((current) =>
                        [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
                      );
                      setValues((current) => ({ ...current, categoryId: created.id }));
                      setNewCategory("");
                    }
                  }}
                >
                  Ajouter
                </Button>
              </div>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="status">
              Statut
            </label>
            {values.status === "INACTIVE" ? (
              <p
                id="status"
                className="flex h-10 items-center rounded-md border border-[var(--border)] bg-[var(--muted)]/40 px-3 text-sm"
              >
                Inactif — utilisez l&apos;action Réactiver
              </p>
            ) : (
              <select
                id="status"
                value={values.status}
                onChange={(event) =>
                  setValues({
                    ...values,
                    status: event.target.value as ProductFormValues["status"],
                  })
                }
                className={inputClass}
              >
                <option value="ACTIVE">Actif</option>
                <option value="DRAFT">Brouillon</option>
              </select>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Tarification (TTC)</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {showCost ? (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="cost">
                Coût d&apos;achat (FCFA)
              </label>
              <input
                id="cost"
                inputMode="numeric"
                value={values.variant.costPriceXaf}
                onChange={(event) => updateVariant("costPriceXaf", event.target.value)}
                className={inputClass}
              />
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="price">
              Prix de vente TTC (FCFA) *
            </label>
            <input
              id="price"
              required
              inputMode="numeric"
              value={values.variant.sellingPriceXaf}
              onChange={(event) => updateVariant("sellingPriceXaf", event.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Variante et politique d&apos;inventaire</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="sku">
              SKU *
            </label>
            <input
              id="sku"
              required
              value={values.variant.sku}
              onChange={(event) => updateVariant("sku", event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="variantName">
              Nom de la variante *
            </label>
            <input
              id="variantName"
              required
              value={values.variant.name}
              onChange={(event) => updateVariant("name", event.target.value)}
              placeholder="Ex. Noir 128 Go"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="barcode">
              Code-barres (saisie manuelle)
            </label>
            <input
              id="barcode"
              value={values.variant.barcode}
              onChange={(event) => updateVariant("barcode", event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="warranty">
              Garantie (mois)
            </label>
            <input
              id="warranty"
              inputMode="numeric"
              value={values.variant.warrantyMonths}
              onChange={(event) => updateVariant("warrantyMonths", event.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <fieldset className="mt-4 space-y-2">
          <legend className="mb-2 text-sm font-medium">Suivi de stock</legend>
          <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] p-3">
            <input
              type="radio"
              name="serialized"
              checked={!values.isSerialized}
              onChange={() => setValues({ ...values, isSerialized: false })}
            />
            <span>
              <span className="block font-medium">Standard (quantité)</span>
              <span className="text-sm text-[var(--muted-foreground)]">
                Accessoires et articles non suivis à l&apos;unité.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] p-3">
            <input
              type="radio"
              name="serialized"
              checked={values.isSerialized}
              onChange={() => setValues({ ...values, isSerialized: true })}
            />
            <span>
              <span className="block font-medium">Sérialisé (IMEI / n° de série)</span>
              <span className="text-sm text-[var(--muted-foreground)]">
                Téléphones et appareils identifiés individuellement. Les IMEI
                s&apos;enregistrent à la réception de stock.
              </span>
            </span>
          </label>
        </fieldset>
      </section>

      {error ? (
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/produits")}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
