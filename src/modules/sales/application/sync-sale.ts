import type { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import type { AuthUser } from "@/lib/auth/session";
import type { completeSaleSchema } from "@/modules/sales/api/schemas";
import { completeSaleUseCase } from "@/modules/sales/application/complete-sale";
import { computeSalePayloadFingerprint } from "@/modules/sales/application/fingerprint";
import { syncTransactionStatusFromError } from "@/lib/offline/sync-classify";

type CompleteInput = z.infer<typeof completeSaleSchema>;

/**
 * Idempotent sync endpoint: records SyncTransaction then delegates to CompleteSale.
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

  const syncRow = await prisma.syncTransaction.upsert({
    where: { clientTxnId: input.clientTxnId },
    create: {
      clientTxnId: input.clientTxnId,
      status: "SYNCING",
      payloadJson,
      attempts: 1,
      lastAttemptAt: new Date(),
    },
    update: {
      status: "SYNCING",
      payloadJson,
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
      errorMessage: null,
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
