import { completeSaleSchema } from "@/modules/sales/api/schemas";
import { normalizeMoneyInput, xaf, type Xaf } from "@/lib/money";
import {
  assertCustomerRequiredForInstallment,
  assertDownPaymentRules,
  assertImmediatePaymentsCoverTotal,
  assertSerializedLine,
  parseSaleMoney,
  sumPayments,
} from "@/modules/sales/domain/policies";
import type {
  OfflineCatalogItem,
  OfflineSalePayload,
  OfflineSerial,
} from "@/lib/offline/types";

export type OfflineSaleValidationContext = {
  catalog: OfflineCatalogItem[];
  serials: OfflineSerial[];
  minDownPaymentBps: number;
  /** Serial IDs already claimed by other pending outbox rows. */
  reservedSerialIds?: Set<string>;
};

export function estimateSaleTotalXaf(
  payload: Pick<OfflineSalePayload, "items" | "discountTotalXaf">,
  catalog: OfflineCatalogItem[],
): Xaf {
  const byVariant = new Map(catalog.map((row) => [row.variantId, row]));
  let subtotal = BigInt(0);
  let lineDiscounts = BigInt(0);
  for (const item of payload.items) {
    const variant = byVariant.get(item.variantId);
    if (!variant) {
      throw new Error("Article hors cache — rafraîchissez le catalogue.");
    }
    const unit = xaf(normalizeMoneyInput(variant.sellingPriceXaf));
    const qty = BigInt(item.quantity);
    const lineDiscount = parseSaleMoney(item.discountXaf ?? 0, "remise ligne");
    subtotal += unit * qty;
    lineDiscounts += lineDiscount;
  }
  const globalDiscount = parseSaleMoney(
    payload.discountTotalXaf ?? 0,
    "remise globale",
  );
  const total = subtotal - lineDiscounts - globalDiscount;
  if (total <= BigInt(0)) {
    throw new Error("Le total de la vente doit être positif.");
  }
  return total;
}

export function validateOfflineSalePayload(
  payload: OfflineSalePayload,
  context: OfflineSaleValidationContext,
): string | null {
  const parsed = completeSaleSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return first?.message ?? "Données de vente invalides.";
  }

  try {
    assertCustomerRequiredForInstallment(
      parsed.data.kind,
      parsed.data.customerId,
    );
  } catch (error) {
    return error instanceof Error ? error.message : "Client requis.";
  }

  for (const payment of parsed.data.payments) {
    if (payment.method !== "CASH") {
      const ref = payment.operatorReference?.trim() ?? "";
      if (ref.length < 3) {
        return "La référence opérateur est obligatoire pour Orange Money / MTN MoMo.";
      }
    }
  }

  const byVariant = new Map(context.catalog.map((row) => [row.variantId, row]));
  const bySerial = new Map(context.serials.map((row) => [row.id, row]));
  const qtyByVariant = new Map<string, number>();
  const seenSerials = new Set<string>();
  const reserved = context.reservedSerialIds ?? new Set<string>();

  for (const item of parsed.data.items) {
    const variant = byVariant.get(item.variantId);
    if (!variant) {
      return "Article hors cache — rafraîchissez le catalogue.";
    }
    try {
      assertSerializedLine(
        variant.isSerialized,
        item.quantity,
        item.productSerialId,
      );
    } catch (error) {
      return error instanceof Error ? error.message : "Ligne sérialisée invalide.";
    }

    if (variant.isSerialized) {
      const serialId = item.productSerialId!;
      if (seenSerials.has(serialId) || reserved.has(serialId)) {
        return "Cet appareil est déjà réservé dans une vente hors ligne.";
      }
      seenSerials.add(serialId);
      const serial = bySerial.get(serialId);
      if (!serial || serial.status !== "IN_STOCK") {
        return "Cet appareil n'est plus disponible à la vente.";
      }
      if (serial.variantId !== item.variantId) {
        return "L'appareil n'appartient pas à cette variante.";
      }
    } else {
      const used = (qtyByVariant.get(item.variantId) ?? 0) + item.quantity;
      qtyByVariant.set(item.variantId, used);
      if (used > variant.quantityAvailable) {
        return `Stock insuffisant pour ${variant.sku} (disponible : ${variant.quantityAvailable}).`;
      }
    }
  }

  let totalXaf: Xaf;
  try {
    totalXaf = estimateSaleTotalXaf(parsed.data, context.catalog);
  } catch (error) {
    return error instanceof Error ? error.message : "Total invalide.";
  }

  const paidXaf = sumPayments(parsed.data.payments);

  try {
    if (parsed.data.kind === "IMMEDIATE") {
      assertImmediatePaymentsCoverTotal(totalXaf, paidXaf);
    } else {
      assertDownPaymentRules({
        totalXaf,
        downPaymentXaf: paidXaf,
        minDownPaymentBps: context.minDownPaymentBps,
      });
    }
  } catch (error) {
    return error instanceof Error ? error.message : "Paiement invalide.";
  }

  return null;
}
