"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatXaf, xaf } from "@/lib/money";
import {
  describeSnapshotFreshness,
  getSnapshotMeta,
  listOutbox,
} from "@/lib/offline/repository";
import {
  abandonOutboxItem,
  flushOutbox,
  pullOfflineSnapshot,
  repairOutboxPayment,
  retryOutboxItem,
} from "@/lib/offline/sync-engine";
import {
  parsePaymentMismatch,
  sumOutboxPayments,
} from "@/lib/offline/payment-mismatch";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import {
  outboxStatusLabel,
  type OutboxSaleRecord,
} from "@/lib/offline/types";

export function SyncCenter() {
  const online = useOnlineStatus();
  const [rows, setRows] = useState<OutboxSaleRecord[]>([]);
  const [cacheNote, setCacheNote] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setRows(await listOutbox());
    const meta = await getSnapshotMeta();
    if (!meta) {
      setCacheNote("Aucun cache local — rafraîchissez en ligne.");
      return;
    }
    const warning = describeSnapshotFreshness(meta);
    setCacheNote(
      `Cache du ${new Date(meta.fetchedAt).toLocaleString("fr-FR")}${
        warning ? ` — ${warning}` : ""
      }`,
    );
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!online) {
      return;
    }
    void (async () => {
      try {
        const result = await flushOutbox();
        if (result.processed > 0) {
          setMessage(
            `Sync auto : ${result.synced} ok, ${result.failed} échec, ${result.conflicted} conflit(s).`,
          );
          await reload();
        }
      } catch {
        // Manual flush remains available.
      }
    })();
  }, [online, reload]);

  async function onRefreshCache() {
    setBusy(true);
    setError(null);
    try {
      await pullOfflineSnapshot();
      setMessage("Cache catalogue / clients rafraîchi.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du cache.");
    } finally {
      setBusy(false);
    }
  }

  async function onFlush() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await flushOutbox();
      if (result.processed === 0) {
        setMessage("Rien à synchroniser (file déjà à jour).");
      } else {
        setMessage(
          `Synchronisation : ${result.synced} ok, ${result.failed} échec, ${result.conflicted} conflit(s).`,
        );
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de sync.");
    } finally {
      setBusy(false);
    }
  }

  async function onRetry(clientTxnId: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await retryOutboxItem(clientTxnId);
      setMessage(
        result.status === "SYNCED"
          ? `Transaction ${clientTxnId.slice(0, 8)}… synchronisée.`
          : `Statut : ${outboxStatusLabel(result.status)} — ${result.lastError ?? ""}`,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du retry.");
    } finally {
      setBusy(false);
    }
  }

  async function onRepairPayment(clientTxnId: string, expectedTotalXaf: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await repairOutboxPayment(clientTxnId, expectedTotalXaf);
      setMessage(
        result.status === "SYNCED"
          ? `Paiement corrigé — vente ${result.saleReference ?? "synchronisée"}.`
          : `Correction envoyée : ${outboxStatusLabel(result.status)} — ${result.lastError ?? ""}`,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la correction.");
    } finally {
      setBusy(false);
    }
  }

  async function onAbandon(clientTxnId: string) {
    setBusy(true);
    setError(null);
    try {
      await abandonOutboxItem(clientTxnId);
      setMessage("Vente locale abandonnée (non synchronisée).");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'abandon.");
    } finally {
      setBusy(false);
    }
  }

  const pending = rows.filter((row) => row.status === "PENDING_SYNC").length;
  const syncing = rows.filter((row) => row.status === "SYNCING").length;
  const failed = rows.filter((row) => row.status === "FAILED").length;
  const conflicted = rows.filter((row) => row.status === "CONFLICT").length;
  const synced = rows.filter((row) => row.status === "SYNCED").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          Réseau :{" "}
          <span className={online ? "text-emerald-700" : "text-amber-800"}>
            {online ? "en ligne" : "hors ligne"}
          </span>
          {" · "}
          {pending} en attente · {syncing} en cours · {failed} échec ·{" "}
          {conflicted} conflit · {synced} synchronisées
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy || !online}
            onClick={() => void onRefreshCache()}
          >
            Rafraîchir le cache
          </Button>
          <Button
            type="button"
            disabled={busy || !online}
            onClick={() => void onFlush()}
          >
            Synchroniser la file
          </Button>
          <Link href="/pos">
            <Button type="button" variant="outline">
              Retour caisse
            </Button>
          </Link>
        </div>
      </div>

      {cacheNote ? (
        <p className="text-sm text-[var(--muted-foreground)]">{cacheNote}</p>
      ) : null}

      {message ? (
        <p className="text-sm text-emerald-700" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <p className="text-sm text-[var(--muted-foreground)]">
        Les ventes hors ligne restent dans cette liste jusqu&apos;au statut{" "}
        <strong>Synchronisé</strong>. Les lignes <strong>Échec</strong> sont
        réessayables ; les <strong>Conflit</strong> (IMEI déjà vendu, etc.)
        nécessitent un abandon ou une intervention manager.
      </p>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-3 font-medium">Txn</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Tentatives</th>
              <th className="px-4 py-3 font-medium">Paiement</th>
              <th className="px-4 py-3 font-medium">Erreur / vente</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-[var(--muted-foreground)]"
                >
                  Aucune transaction hors ligne.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const paid = sumOutboxPayments(row.payload.payments);
                const mismatch = parsePaymentMismatch(
                  row.lastError,
                  row.lastErrorDetails,
                );
                return (
                  <tr
                    key={row.clientTxnId}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {row.clientTxnId.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3">
                      {outboxStatusLabel(row.status)}
                    </td>
                    <td className="px-4 py-3">
                      {row.payload.kind === "INSTALLMENT" ? "Crédit" : "Comptant"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.attempts}</td>
                    <td className="px-4 py-3 text-sm tabular-nums">
                      {formatXaf(xaf(paid))}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {row.saleReference ? (
                        `Vente ${row.saleReference}`
                      ) : row.lastError ? (
                        <span className="text-red-700">{row.lastError}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {row.status === "FAILED" ? (
                        <>
                          {mismatch ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={busy || !online}
                              onClick={() =>
                                void onRepairPayment(
                                  row.clientTxnId,
                                  mismatch.expectedTotalXaf,
                                )
                              }
                            >
                              Corriger le paiement
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy || !online}
                            onClick={() => void onRetry(row.clientTxnId)}
                          >
                            Réessayer
                          </Button>
                        </>
                      ) : null}
                      {row.status === "FAILED" || row.status === "CONFLICT" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void onAbandon(row.clientTxnId)}
                        >
                          Abandonner
                        </Button>
                      ) : null}
                      {row.status === "SYNCED" && row.saleId ? (
                        <Link
                          href={`/ventes/${row.saleId}`}
                          className="text-sm hover:underline"
                        >
                          Ouvrir
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
