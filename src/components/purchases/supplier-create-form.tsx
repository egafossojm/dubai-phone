"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SupplierCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: { message?: string };
      data?: { id: string };
    } | null;
    setPending(false);
    if (!response.ok || !payload?.success || !payload.data) {
      setError(payload?.error?.message ?? "Création impossible.");
      return;
    }
    setName("");
    setPhone("");
    router.push(`/achats/fournisseurs/${payload.data.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]" htmlFor="name">
          Nouveau fournisseur
        </label>
        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          required
          minLength={2}
        />
      </div>
      <div className="sm:w-40">
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]" htmlFor="phone">
          Téléphone
        </label>
        <input
          id="phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm"
        />
      </div>
      <Button type="submit" disabled={pending}>
        Ajouter
      </Button>
      {error ? <p className="text-sm text-red-700 sm:basis-full">{error}</p> : null}
    </form>
  );
}
