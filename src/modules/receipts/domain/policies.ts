import { paymentMethodLabel } from "@/modules/credit/domain/policies";

/** Receipt payment labels — shared with credit/sales presenters. */
export function receiptPaymentMethodLabel(method: string): string {
  return paymentMethodLabel(method);
}

/** Sale kind as payment plan line on the receipt. */
export function receiptSalePlanLabel(kind: string): string {
  return kind === "INSTALLMENT"
    ? "Paiement en plusieurs fois"
    : "Paiement comptant";
}

export function formatReceiptDateTime(
  date: Date,
  timeZone = "Africa/Douala",
): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function formatWarrantyPeriod(
  startsAt: Date,
  endsAt: Date,
  timeZone = "Africa/Douala",
): string {
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    dateStyle: "short",
  });
  return `${fmt.format(startsAt)} → ${fmt.format(endsAt)}`;
}

/** Safe Content-Disposition basename fragment. */
export function sanitizeDocumentFilename(name: string): string {
  const cleaned = name
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned.slice(0, 120) || "document";
}

export function receiptReturnWatermark(status: string): string | null {
  if (status === "RETURNED") {
    return "VENTE RETOURNÉE — document d'origine (instantané)";
  }
  if (status === "PARTIALLY_RETURNED") {
    return "RETOUR PARTIEL — document d'origine (instantané)";
  }
  return null;
}
