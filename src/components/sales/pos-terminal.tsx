"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import {
  describeSnapshotFreshness,
  getSnapshotMeta,
  searchLocalCatalog,
  searchLocalCustomers,
} from "@/lib/offline/repository";
import {
  buildOfflineSalePayload,
  sumPaymentLineDrafts,
} from "@/lib/offline/sale-draft";
import { lockSerial, releaseSerial } from "@/lib/offline/serial-locks";
import { listPendingOutboxSerialIds } from "@/lib/offline/stock-reservation";
import {
  enqueueOfflineSale,
  flushOutbox,
  pullOfflineSnapshot,
} from "@/lib/offline/sync-engine";
import { formatXaf, normalizeMoneyInput, xaf, type Xaf } from "@/lib/money";

const inputClass =
  "h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm";

type CatalogHit = {
  kind: string;
  variantId: string;
  productSerialId: string | null;
  sku: string;
  name: string;
  sellingPriceXaf: string;
  sellingPriceLabel: string;
  isSerialized: boolean;
  quantityAvailable: number;
  imei1: string | null;
  serialNumber: string | null;
};

type CartLine = {
  key: string;
  variantId: string;
  productSerialId?: string;
  name: string;
  sku: string;
  unitPriceXaf: number;
  quantity: number;
  quantityAvailable: number;
  discountXaf: number;
  isSerialized: boolean;
  imeiLabel?: string;
};

type CustomerHit = {
  id: string;
  fullName: string;
  phone: string;
};

type PaymentDraft = {
  method: "CASH" | "ORANGE_MONEY" | "MTN_MOBILE_MONEY";
  amountXaf: string;
  operatorReference: string;
  idempotencyKey: string;
};

function newKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function lineTotal(line: CartLine) {
  return line.unitPriceXaf * line.quantity - line.discountXaf;
}

function sumPaymentDrafts(rows: PaymentDraft[]): Xaf {
  return sumPaymentLineDrafts(rows);
}

export function PosTerminal() {
  const router = useRouter();
  const online = useOnlineStatus();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CatalogHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [globalDiscount, setGlobalDiscount] = useState("0");
  const [kind, setKind] = useState<"IMMEDIATE" | "INSTALLMENT">("IMMEDIATE");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerHit[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerLabel, setCustomerLabel] = useState<string | null>(null);
  const [installmentCount, setInstallmentCount] = useState("3");
  const [intervalDays, setIntervalDays] = useState("30");
  const [firstDueDate, setFirstDueDate] = useState("");
  const [payments, setPayments] = useState<PaymentDraft[]>([
    {
      method: "CASH",
      amountXaf: "",
      operatorReference: "",
      idempotencyKey: newKey("pay"),
    },
  ]);
  const [clientTxnId, setClientTxnId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cacheHint, setCacheHint] = useState<string | null>(null);

  const subtotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.unitPriceXaf * line.quantity, 0),
    [cart],
  );
  const lineDiscounts = useMemo(
    () => cart.reduce((sum, line) => sum + line.discountXaf, 0),
    [cart],
  );
  const globalDiscountNum = Number(normalizeMoneyInput(globalDiscount));
  const total = Math.max(0, subtotal - lineDiscounts - globalDiscountNum);
  const totalXaf = useMemo(
    () =>
      cart.reduce(
        (sum, line) =>
          sum +
          xaf(String(line.unitPriceXaf)) * BigInt(line.quantity) -
          xaf(String(line.discountXaf)),
        BigInt(0),
      ) - xaf(normalizeMoneyInput(globalDiscount)),
    [cart, globalDiscount],
  );

  useEffect(() => {
    void (async () => {
      const meta = await getSnapshotMeta();
      if (!meta) {
        return;
      }
      const warning = describeSnapshotFreshness(meta);
      if (warning) {
        setCacheHint(`Cache : ${warning}.`);
      }
    })();
  }, []);

  useEffect(() => {
    if (!online) {
      return;
    }
    void (async () => {
      try {
        await pullOfflineSnapshot();
        const meta = await getSnapshotMeta();
        const warning = meta ? describeSnapshotFreshness(meta) : null;
        setCacheHint(
          warning ? `Cache à jour — ${warning}.` : "Cache local à jour.",
        );
        const result = await flushOutbox();
        if (result.processed > 0) {
          setCacheHint(
            `Sync : ${result.synced} ok, ${result.failed} échec, ${result.conflicted} conflit(s).`,
          );
        }
      } catch {
        setCacheHint("Cache local non rafraîchi.");
      }
    })();
  }, [online]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setSearching(true);
      if (!online) {
        const allowSerialIds = cart
          .map((line) => line.productSerialId)
          .filter((id): id is string => Boolean(id));
        const items = await searchLocalCatalog(query.trim(), 15, {
          allowSerialIds,
        });
        setHits(items);
        setSearching(false);
        return;
      }
      const response = await fetch(
        `/api/sales/catalog?q=${encodeURIComponent(query.trim())}`,
      );
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        data?: { items: CatalogHit[] };
      } | null;
      setSearching(false);
      if (response.ok && payload?.success) {
        setHits(payload.data?.items ?? []);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, online, cart]);

  const cartSerialsRef = useRef<string[]>([]);
  useEffect(() => {
    cartSerialsRef.current = cart
      .map((line) => line.productSerialId)
      .filter((id): id is string => Boolean(id));
  }, [cart]);

  useEffect(() => {
    return () => {
      void (async () => {
        const pending = await listPendingOutboxSerialIds();
        for (const id of cartSerialsRef.current) {
          if (!pending.has(id)) {
            await releaseSerial(id);
          }
        }
      })();
    };
  }, []);

  useEffect(() => {
    if (customerQuery.trim().length < 2) {
      setCustomers([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      if (!online) {
        setCustomers(await searchLocalCustomers(customerQuery.trim()));
        return;
      }
      const response = await fetch(
        `/api/customers?q=${encodeURIComponent(customerQuery.trim())}`,
      );
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        data?: { items: CustomerHit[] };
      } | null;
      if (response.ok && payload?.success) {
        setCustomers(payload.data?.items ?? []);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [customerQuery, online]);

  async function addHit(hit: CatalogHit) {
    setError(null);
    if (hit.isSerialized) {
      if (!hit.productSerialId) {
        setError("Pour un produit sérialisé, cherchez l'IMEI exact.");
        return;
      }
      if (cart.some((line) => line.productSerialId === hit.productSerialId)) {
        setError("Cet appareil est déjà dans le panier.");
        return;
      }
      try {
        await lockSerial(hit.productSerialId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "IMEI indisponible.");
        return;
      }
      setCart((prev) => [
        ...prev,
        {
          key: hit.productSerialId!,
          variantId: hit.variantId,
          productSerialId: hit.productSerialId!,
          name: hit.name,
          sku: hit.sku,
          unitPriceXaf: Number(normalizeMoneyInput(hit.sellingPriceXaf)),
          quantity: 1,
          quantityAvailable: 1,
          discountXaf: 0,
          isSerialized: true,
          imeiLabel: hit.imei1 ?? hit.serialNumber ?? undefined,
        },
      ]);
      return;
    }
    if (hit.quantityAvailable <= 0) {
      setError("Stock insuffisant pour cet article.");
      return;
    }
    setCart((prev) => {
      const existing = prev.find(
        (line) => line.variantId === hit.variantId && !line.isSerialized,
      );
      if (existing) {
        return prev.map((line) =>
          line.key === existing.key
            ? {
                ...line,
                quantity: Math.min(
                  line.quantity + 1,
                  hit.quantityAvailable,
                ),
                quantityAvailable: hit.quantityAvailable,
              }
            : line,
        );
      }
      return [
        ...prev,
        {
          key: hit.variantId,
          variantId: hit.variantId,
          name: hit.name,
          sku: hit.sku,
          unitPriceXaf: Number(normalizeMoneyInput(hit.sellingPriceXaf)),
          quantity: 1,
          quantityAvailable: hit.quantityAvailable,
          discountXaf: 0,
          isSerialized: false,
        },
      ];
    });
  }

  function removeLine(key: string) {
    const line = cart.find((row) => row.key === key);
    if (line?.productSerialId) {
      void releaseSerial(line.productSerialId);
    }
    setCart((prev) => prev.filter((row) => row.key !== key));
  }

  async function onComplete() {
    if (cart.length === 0) {
      setError("Ajoutez au moins un article.");
      return;
    }
    setPending(true);
    setError(null);
    setSuccess(null);

    const paidXaf = sumPaymentDrafts(payments);
    let paymentsToSend = payments;
    if (kind === "IMMEDIATE" && paidXaf !== totalXaf) {
      const allEmpty = payments.every(
        (row) => xaf(normalizeMoneyInput(row.amountXaf)) === BigInt(0),
      );
      if (allEmpty && totalXaf > BigInt(0)) {
        paymentsToSend = [
          {
            method: "CASH",
            amountXaf: totalXaf.toString(),
            operatorReference: "",
            idempotencyKey: newKey("pay"),
          },
        ];
        setPayments(paymentsToSend);
      } else {
        setPending(false);
        setError(
          `Paiement incomplet : attendu ${formatXaf(totalXaf)}, reçu ${formatXaf(paidXaf)}. Utilisez « Remplir paiement = total » ou corrigez le montant.`,
        );
        return;
      }
    }

    const body = buildOfflineSalePayload({
      clientTxnId,
      kind,
      customerId,
      globalDiscount,
      cart,
      payments: paymentsToSend,
      installmentCount,
      intervalDays,
      firstDueDate,
    });

    if (!online) {
      try {
        await enqueueOfflineSale(body);
      } catch (err) {
        setPending(false);
        setError(err instanceof Error ? err.message : "Vente hors ligne impossible.");
        return;
      }
      setPending(false);
      setSuccess(
        "Vente enregistrée hors ligne — en attente de synchronisation (pas encore validée serveur).",
      );
      setCart([]);
      setGlobalDiscount("0");
      setPayments([
        {
          method: "CASH",
          amountXaf: "",
          operatorReference: "",
          idempotencyKey: newKey("pay"),
        },
      ]);
      setClientTxnId(crypto.randomUUID());
      setKind("IMMEDIATE");
      setFirstDueDate("");
      return;
    }

    const response = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: { message?: string };
      data?: {
        replayed?: boolean;
        sale?: {
          id: string;
          reference: string;
          receiptReference: string | null;
          creditReference: string | null;
        };
      };
    } | null;

    setPending(false);
    if (!response.ok || !payload?.success || !payload.data?.sale) {
      setError(payload?.error?.message ?? "Vente impossible.");
      return;
    }

    const sale = payload.data.sale;
    for (const line of cart) {
      if (line.productSerialId) {
        await releaseSerial(line.productSerialId);
      }
    }
    setSuccess(
      payload.data.replayed
        ? `Rejeu : vente ${sale.reference} déjà enregistrée.`
        : `Vente ${sale.reference} — reçu ${sale.receiptReference ?? "—"}${
            sale.creditReference ? ` — crédit ${sale.creditReference}` : ""
          }.`,
    );
    setCart([]);
    setGlobalDiscount("0");
    setPayments([
      {
        method: "CASH",
        amountXaf: "",
        operatorReference: "",
        idempotencyKey: newKey("pay"),
      },
    ]);
    setClientTxnId(crypto.randomUUID());
    setKind("IMMEDIATE");
    setFirstDueDate("");
    router.refresh();
    router.push(`/ventes/${sale.id}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
        <p>
          <span
            className={
              online ? "font-medium text-emerald-700" : "font-medium text-amber-800"
            }
          >
            {online ? "En ligne" : "Hors ligne"}
          </span>
          {cacheHint ? (
            <span className="text-[var(--muted-foreground)]"> · {cacheHint}</span>
          ) : null}
        </p>
        <Link href="/sync" className="text-sm underline-offset-2 hover:underline">
          Centre de synchronisation
        </Link>
      </div>

    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <label className="mb-1 block text-xs font-medium" htmlFor="pos-q">
            Recherche produit / SKU / IMEI
          </label>
          <input
            id="pos-q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={inputClass}
            placeholder="Ex. SAM-A16, 8600…"
            autoFocus
          />
          {searching ? (
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              Recherche…
            </p>
          ) : null}
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {hits.map((hit) => (
              <li
                key={`${hit.variantId}-${hit.productSerialId ?? "v"}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{hit.name}</p>
                  <p className="font-mono text-xs text-[var(--muted-foreground)]">
                    {hit.sku}
                    {hit.imei1 ? ` · IMEI ${hit.imei1}` : ""}
                    {!hit.isSerialized
                      ? ` · stock ${hit.quantityAvailable}`
                      : hit.productSerialId
                        ? " · en stock"
                        : " · choisir IMEI"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm tabular-nums">
                    {hit.sellingPriceLabel}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void addHit(hit)}
                  >
                    Ajouter
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-3 py-2 font-medium">Article</th>
                <th className="px-3 py-2 font-medium">Qté</th>
                <th className="px-3 py-2 text-right font-medium">Prix</th>
                <th className="px-3 py-2 text-right font-medium">Remise</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-[var(--muted-foreground)]"
                  >
                    Panier vide
                  </td>
                </tr>
              ) : (
                cart.map((line) => (
                  <tr
                    key={line.key}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium">{line.name}</p>
                      <p className="font-mono text-xs text-[var(--muted-foreground)]">
                        {line.sku}
                        {line.imeiLabel ? ` · ${line.imeiLabel}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      {line.isSerialized ? (
                        1
                      ) : (
                        <input
                          type="number"
                          min={1}
                          max={line.quantityAvailable}
                          value={line.quantity}
                          onChange={(e) => {
                            const quantity = Math.min(
                              line.quantityAvailable,
                              Math.max(
                                1,
                                Number.parseInt(e.target.value, 10) || 1,
                              ),
                            );
                            setCart((prev) =>
                              prev.map((row) =>
                                row.key === line.key
                                  ? { ...row, quantity }
                                  : row,
                              ),
                            );
                          }}
                          className="h-9 w-16 rounded-md border border-[var(--border)] px-2"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {line.unitPriceXaf.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        value={line.discountXaf}
                        onChange={(e) => {
                          const discountXaf = Math.max(
                            0,
                            Number.parseInt(e.target.value, 10) || 0,
                          );
                          setCart((prev) =>
                            prev.map((row) =>
                              row.key === line.key
                                ? { ...row, discountXaf }
                                : row,
                            ),
                          );
                        }}
                        className="ml-auto h-9 w-24 rounded-md border border-[var(--border)] px-2 text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {lineTotal(line).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => removeLine(line.key)}
                      >
                        Retirer
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Type</label>
            <select
              value={kind}
              onChange={(e) =>
                setKind(e.target.value as "IMMEDIATE" | "INSTALLMENT")
              }
              className={inputClass}
            >
              <option value="IMMEDIATE">Comptant</option>
              <option value="INSTALLMENT">Crédit (échéances)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="cust-q">
              Client {kind === "INSTALLMENT" ? "(obligatoire)" : "(optionnel)"}
            </label>
            {customerId ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm">
                <span>{customerLabel}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCustomerId(null);
                    setCustomerLabel(null);
                  }}
                >
                  Changer
                </Button>
              </div>
            ) : (
              <>
                <input
                  id="cust-q"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  className={inputClass}
                  placeholder="Nom ou téléphone"
                />
                <ul className="mt-2 space-y-1">
                  {customers.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="w-full rounded-md px-2 py-1 text-left text-sm hover:bg-[var(--muted)]"
                        onClick={() => {
                          setCustomerId(row.id);
                          setCustomerLabel(`${row.fullName} · ${row.phone}`);
                          setCustomerQuery("");
                          setCustomers([]);
                        }}
                      >
                        {row.fullName}{" "}
                        <span className="font-mono text-xs text-[var(--muted-foreground)]">
                          {row.phone}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {kind === "INSTALLMENT" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium">
                  Nombre d&apos;échéances
                </label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">
                  Intervalle (jours)
                </label>
                <input
                  type="number"
                  min={7}
                  max={90}
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">
                  1ʳᵉ échéance
                </label>
                <input
                  type="date"
                  value={firstDueDate}
                  onChange={(e) => setFirstDueDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <p className="sm:col-span-3 text-xs text-[var(--muted-foreground)]">
                Les paiements ci-dessous forment l&apos;acompte (minimum
                configurable). Réf. opérateur obligatoire pour OM / MoMo.
              </p>
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-xs font-medium">
              Remise globale (FCFA)
            </label>
            <input
              type="number"
              min={0}
              value={globalDiscount}
              onChange={(e) => setGlobalDiscount(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="space-y-2 border-t border-[var(--border)] pt-3">
            <div className="flex justify-between text-sm">
              <span>Sous-total</span>
              <span className="tabular-nums">
                {subtotal.toLocaleString("fr-FR")} FCFA
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Remises</span>
              <span className="tabular-nums">
                {(lineDiscounts + globalDiscountNum).toLocaleString("fr-FR")}{" "}
                FCFA
              </span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                {total.toLocaleString("fr-FR")} FCFA
              </span>
            </div>
            {kind === "IMMEDIATE" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() =>
                  setPayments([
                    {
                      method: "CASH",
                      amountXaf: totalXaf.toString(),
                      operatorReference: "",
                      idempotencyKey: newKey("pay"),
                    },
                  ])
                }
              >
                Remplir paiement = total
              </Button>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
          <h2 className="font-semibold">
            {kind === "INSTALLMENT" ? "Acompte" : "Paiements"}
          </h2>
          {payments.map((payment, index) => (
            <div
              key={payment.idempotencyKey}
              className="grid gap-2 sm:grid-cols-3"
            >
              <select
                value={payment.method}
                onChange={(e) => {
                  const method = e.target.value as PaymentDraft["method"];
                  setPayments((prev) =>
                    prev.map((row, i) =>
                      i === index ? { ...row, method } : row,
                    ),
                  );
                }}
                className={inputClass}
              >
                <option value="CASH">Espèces</option>
                <option value="ORANGE_MONEY">Orange Money</option>
                <option value="MTN_MOBILE_MONEY">MTN Mobile Money</option>
              </select>
              <input
                type="number"
                min={0}
                placeholder="Montant"
                value={payment.amountXaf}
                onChange={(e) =>
                  setPayments((prev) =>
                    prev.map((row, i) =>
                      i === index
                        ? { ...row, amountXaf: e.target.value }
                        : row,
                    ),
                  )
                }
                className={inputClass}
              />
              <input
                placeholder="Réf. opérateur"
                value={payment.operatorReference}
                onChange={(e) =>
                  setPayments((prev) =>
                    prev.map((row, i) =>
                      i === index
                        ? { ...row, operatorReference: e.target.value }
                        : row,
                    ),
                  )
                }
                className={inputClass}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setPayments((prev) => [
                ...prev,
                {
                  method: "CASH",
                  amountXaf: "",
                  operatorReference: "",
                  idempotencyKey: newKey("pay"),
                },
              ])
            }
          >
            Ajouter un paiement
          </Button>
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

        <Button
          type="button"
          className="w-full"
          disabled={pending || cart.length === 0}
          onClick={() => void onComplete()}
        >
          {pending ? "Enregistrement…" : "Finaliser la vente"}
        </Button>
      </div>
    </div>
    </div>
  );
}
