"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm";

type CustomerEditFormProps = {
  customerId: string;
  initial: {
    fullName: string;
    phone: string;
    email: string | null;
    address: string | null;
    notes: string | null;
  };
  canDeactivate: boolean;
};

export function CustomerEditForm({
  customerId,
  initial,
  canDeactivate,
}: CustomerEditFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.fullName);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);
    const response = await fetch(`/api/customers/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, phone, email, address, notes }),
    });
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: { message?: string };
    } | null;
    setPending(false);
    if (!response.ok || !payload?.success) {
      setError(payload?.error?.message ?? "Mise à jour impossible.");
      return;
    }
    setSuccess("Fiche mise à jour.");
    router.refresh();
  }

  async function onDeactivate() {
    if (!window.confirm("Désactiver ce client ?")) {
      return;
    }
    setPending(true);
    setError(null);
    const response = await fetch(`/api/customers/${customerId}`, {
      method: "DELETE",
    });
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: { message?: string };
    } | null;
    setPending(false);
    if (!response.ok || !payload?.success) {
      setError(payload?.error?.message ?? "Désactivation impossible.");
      return;
    }
    router.push("/clients");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSave}
      className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <h2 className="text-lg font-semibold">Modifier la fiche</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium" htmlFor="edit-name">
            Nom
          </label>
          <input
            id="edit-name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" htmlFor="edit-phone">
            Téléphone
          </label>
          <input
            id="edit-phone"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" htmlFor="edit-email">
            E-mail
          </label>
          <input
            id="edit-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" htmlFor="edit-address">
            Adresse
          </label>
          <input
            id="edit-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium" htmlFor="edit-notes">
            Notes
          </label>
          <textarea
            id="edit-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
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
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        {canDeactivate ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onDeactivate}
          >
            Désactiver
          </Button>
        ) : null}
      </div>
    </form>
  );
}
