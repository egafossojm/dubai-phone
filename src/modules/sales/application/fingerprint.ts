import { createHash } from "node:crypto";
import type { z } from "zod";
import type { completeSaleSchema } from "@/modules/sales/api/schemas";
import { parseSaleMoney } from "@/modules/sales/domain/policies";

type CompleteInput = z.infer<typeof completeSaleSchema>;

/**
 * Canonical fingerprint for CompleteSale idempotent replay binding.
 */
export function computeSalePayloadFingerprint(input: CompleteInput): string {
  const items = [...input.items]
    .map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      productSerialId: item.productSerialId ?? null,
      discountXaf: parseSaleMoney(item.discountXaf ?? 0, "remise ligne").toString(),
    }))
    .sort((a, b) => {
      const left = `${a.variantId}:${a.productSerialId ?? ""}`;
      const right = `${b.variantId}:${b.productSerialId ?? ""}`;
      return left.localeCompare(right);
    });

  const payments = [...input.payments]
    .map((payment) => ({
      method: payment.method,
      amountXaf: parseSaleMoney(payment.amountXaf, "paiement").toString(),
      idempotencyKey: payment.idempotencyKey,
      operatorReference: payment.operatorReference?.trim() || null,
    }))
    .sort((a, b) => a.idempotencyKey.localeCompare(b.idempotencyKey));

  const canonical = {
    kind: input.kind,
    customerId: input.customerId ?? null,
    discountTotalXaf: parseSaleMoney(
      input.discountTotalXaf ?? 0,
      "remise globale",
    ).toString(),
    items,
    payments,
    installmentPlan: input.installmentPlan
      ? {
          installmentCount: input.installmentPlan.installmentCount,
          firstDueDate: input.installmentPlan.firstDueDate ?? null,
          intervalDays: input.installmentPlan.intervalDays,
        }
      : null,
    notes: input.notes?.trim() || null,
  };

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
