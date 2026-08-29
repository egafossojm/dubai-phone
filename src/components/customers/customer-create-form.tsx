"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm";

export function CustomerCreateForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, phone, email, address }),
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
    setFullName("");
    setPhone("");
    setEmail("");
    setAddress("");
    router.push(`/clients/${payload.data.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2 lg:grid-cols-5"
    >
      <div className="lg:col-span-2">
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]" htmlFor="fullName">
          Nouveau client
        </label>
        <input
          id="fullName"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nom complet"
          className={inputClass}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]" htmlFor="phone">
          Téléphone
        </label>
        <input
          id="phone"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="6XX XXX XXX"
          className={inputClass}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="optionnel"
          className={inputClass}
        />
      </div>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Création…" : "Ajouter"}
        </Button>
      </div>
      <div className="sm:col-span-2 lg:col-span-5">
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]" htmlFor="address">
          Adresse
        </label>
        <input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Quartier, ville…"
          className={inputClass}
        />
      </div>
      {error ? (
        <p className="text-sm text-red-700 sm:col-span-2 lg:col-span-5" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
