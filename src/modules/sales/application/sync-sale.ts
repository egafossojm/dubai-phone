import type { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import type { AuthUser } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit/write-audit";
import type { completeSaleSchema } from "@/modules/sales/api/schemas";
import { completeSaleUseCase } from "@/modules/sales/application/complete-sale";
import { computeSalePayloadFingerprint } from "@/modules/sales/application/fingerprint";
import { syncTransactionStatusFromError } from "@/lib/offline/sync-classify";

type CompleteInput = z.infer<typeof completeSaleSchema>;

function fingerprintFromPayloadJson(payloadJson: string): string | null {
  try {
    const parsed = JSON.parse(payloadJson) as { fingerprint?: unknown };
    return typeof parsed.fingerprint === "string" ? parsed.fingerprint : null;
  } catch {
    return null;
  }
}

/**
 * Idempotent sync endpoint: records SyncTransaction then delegates to CompleteSale.
 * Payload fingerprint is frozen after the first attempt for a clientTxnId.
 */
export async function syncSaleUseCase(user: AuthUser, input: CompleteInput) {
  const fingerprint = computeSalePayloadFingerprint(input);
  const payloadJson = JSON.stringify({
    fingerprint,
    payload: input,
  });

  const existing = await prisma.syncTransaction.findUnique({
    where: { clientTxnId: input.clientTxnId },
  });
  if (existing?.status === "SYNCED" && existing.saleId) {
    const result = await completeSaleUseCase(user, input);
    return {
      ...result,
      syncStatus: "SYNCED" as const,
      syncTransactionId: existing.id,
    };
  }

  if (existing) {
    const frozen = fingerprintFromPayloadJson(existing.payloadJson);
    if (frozen && frozen !== fingerprint) {
      throw new AppError(
        "CONFLICT",
        "Le payload de cette transaction offline a changé — créez une nouvelle vente.",
        {
          details: {
            kind: "SYNC_PAYLOAD_MISMATCH",
            clientTxnId: input.clientTxnId,
          },
        },
      );
    }
  }

  const syncRow = existing
    ? await prisma.syncTransaction.update({
        where: { id: existing.id },
        data: {
          status: "SYNCING",
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          errorMessage: null,
          // Keep original payloadJson / fingerprint frozen.
        },
      })
    : await prisma.syncTransaction.create({
        data: {
          clientTxnId: input.clientTxnId,
          status: "SYNCING",
          payloadJson,
          attempts: 1,
          lastAttemptAt: new Date(),
        },
      });

  try {
    const result = await completeSaleUseCase(user, input);
    await prisma.syncTransaction.update({
      where: { id: syncRow.id },
      data: {
        status: "SYNCED",
        saleId: result.sale.id,
        syncedAt: new Date(),
        errorMessage: null,
      },
    });
    return {
      ...result,
      syncStatus: "SYNCED" as const,
      syncTransactionId: syncRow.id,
    };
  } catch (error) {
    const message =
      error instanceof AppError
        ? error.message
        : "Échec de synchronisation de la vente.";
    const status =
      error instanceof AppError
        ? syncTransactionStatusFromError(error)
        : "FAILED";
    await prisma.syncTransaction.update({
      where: { id: syncRow.id },
      data: {
        status,
        errorMessage: message,
      },
    });
    await writeAudit({
      actorId: user.id,
      action: "sync.sale_failed",
      entityType: "SyncTransaction",
      entityId: syncRow.id,
      after: {
        clientTxnId: input.clientTxnId,
        status,
        errorMessage: message,
      },
      reason: message,
    });
    if (error instanceof AppError) {
      throw error;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        "CONFLICT",
        "Conflit d'unicité lors de la synchronisation.",
      );
    }
    throw error;
  }
}
