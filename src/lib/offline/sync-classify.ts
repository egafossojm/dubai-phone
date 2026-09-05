import type { OutboxLocalStatus } from "@/lib/offline/types";

export type SyncFailureKind =
  | "PAYMENT_MISMATCH"
  | "DOWN_PAYMENT_RULE"
  | "SERIAL_UNAVAILABLE"
  | "STOCK_INSUFFICIENT"
  | "AUTHORIZATION"
  | "VALIDATION"
  | "CONFLICT"
  | "OTHER";

function kindFromDetails(details: unknown): SyncFailureKind | null {
  if (!details || typeof details !== "object") {
    return null;
  }
  const kind = (details as { kind?: unknown }).kind;
  if (typeof kind !== "string") {
    return null;
  }
  const allowed: SyncFailureKind[] = [
    "PAYMENT_MISMATCH",
    "DOWN_PAYMENT_RULE",
    "SERIAL_UNAVAILABLE",
    "STOCK_INSUFFICIENT",
    "AUTHORIZATION",
    "VALIDATION",
    "CONFLICT",
    "OTHER",
  ];
  return allowed.includes(kind as SyncFailureKind)
    ? (kind as SyncFailureKind)
    : null;
}

function kindFromMessage(message: string): SyncFailureKind | null {
  const lower = message.toLowerCase();
  if (
    lower.includes("paiement incomplet") ||
    lower.includes("acompte insuffisant") ||
    lower.includes("acompte doit") ||
    lower.includes("acompte crédit")
  ) {
    return lower.includes("paiement incomplet")
      ? "PAYMENT_MISMATCH"
      : "DOWN_PAYMENT_RULE";
  }
  if (
    lower.includes("imei") ||
    lower.includes("appareil") ||
    lower.includes("sérialis") ||
    lower.includes("serial") ||
    lower.includes("n'est plus disponible")
  ) {
    return "SERIAL_UNAVAILABLE";
  }
  if (lower.includes("stock insuffisant") || lower.includes("stock")) {
    return "STOCK_INSUFFICIENT";
  }
  return null;
}

/**
 * Map API sync failures to local outbox status.
 * FAILED = repairable; CONFLICT = abandon / manager.
 */
export function classifySyncFailure(options: {
  httpStatus: number;
  code: string;
  message: string;
  details?: unknown;
}): OutboxLocalStatus {
  const { httpStatus, code, message, details } = options;

  if (httpStatus === 409 || code === "CONFLICT") {
    return "CONFLICT";
  }
  if (code === "AUTHORIZATION_ERROR") {
    return "CONFLICT";
  }

  const kind =
    kindFromDetails(details) ??
    (code === "BUSINESS_RULE_ERROR" || code === "VALIDATION_ERROR"
      ? kindFromMessage(message)
      : null);

  if (kind === "PAYMENT_MISMATCH" || kind === "DOWN_PAYMENT_RULE") {
    return "FAILED";
  }
  if (
    kind === "SERIAL_UNAVAILABLE" ||
    kind === "STOCK_INSUFFICIENT" ||
    kind === "AUTHORIZATION" ||
    kind === "CONFLICT"
  ) {
    return "CONFLICT";
  }

  if (code === "VALIDATION_ERROR" || kind === "VALIDATION") {
    return "FAILED";
  }

  if (code === "BUSINESS_RULE_ERROR") {
    return "FAILED";
  }

  return "FAILED";
}

/** Server SyncTransaction status from AppError (aligned with client outbox). */
export function syncTransactionStatusFromError(error: {
  code: string;
  message: string;
  statusCode?: number;
  details?: unknown;
}): "CONFLICT" | "FAILED" {
  const status = classifySyncFailure({
    httpStatus: error.statusCode ?? 422,
    code: error.code,
    message: error.message,
    details: error.details,
  });
  return status === "CONFLICT" ? "CONFLICT" : "FAILED";
}
