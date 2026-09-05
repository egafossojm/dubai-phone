const PAYMENT_MISMATCH =
  /attendu (\d+) FCFA, reçu (\d+) FCFA/i;

export type PaymentMismatchDetails = {
  expectedTotalXaf: string;
  receivedPaidXaf: string;
};

export function parsePaymentMismatch(
  message: string | null | undefined,
  details?: unknown,
): PaymentMismatchDetails | null {
  if (details && typeof details === "object") {
    const row = details as Record<string, unknown>;
    if (
      typeof row.expectedTotalXaf === "string" &&
      typeof row.receivedPaidXaf === "string"
    ) {
      return {
        expectedTotalXaf: row.expectedTotalXaf,
        receivedPaidXaf: row.receivedPaidXaf,
      };
    }
  }
  if (!message) {
    return null;
  }
  const match = PAYMENT_MISMATCH.exec(message);
  if (!match) {
    return null;
  }
  return {
    expectedTotalXaf: match[1],
    receivedPaidXaf: match[2],
  };
}

export function sumOutboxPayments(
  payments: Array<{ amountXaf: number | string }>,
): string {
  return payments
    .reduce((sum, row) => sum + BigInt(String(row.amountXaf)), BigInt(0))
    .toString();
}
