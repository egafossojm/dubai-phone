"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type ImeiLookupFormProps = {
  defaultQuery: string;
};

export function ImeiLookupForm({ defaultQuery }: ImeiLookupFormProps) {
  const router = useRouter();
  const [q, setQ] = useState(defaultQuery);

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = q.trim();
        router.push(trimmed ? `/stock/imei?q=${encodeURIComponent(trimmed)}` : "/stock/imei");
      }}
    >
      <div className="min-w-0 flex-1">
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]" htmlFor="imei-q">
          IMEI ou numéro de série
        </label>
        <input
          id="imei-q"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          className="h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          placeholder="Ex. 350000000000001"
        />
      </div>
      <Button type="submit">Rechercher</Button>
    </form>
  );
}
