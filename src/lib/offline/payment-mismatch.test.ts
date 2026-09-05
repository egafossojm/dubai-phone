import { describe, expect, it } from "vitest";
import {
  parsePaymentMismatch,
  sumOutboxPayments,
} from "@/lib/offline/payment-mismatch";

describe("payment mismatch helpers", () => {
  it("parses incomplete payment message", () => {
    expect(
      parsePaymentMismatch(
        "Paiement incomplet : attendu 8000 FCFA, reçu 2 FCFA.",
      ),
    ).toEqual({
      expectedTotalXaf: "8000",
      receivedPaidXaf: "2",
    });
  });

  it("prefers structured error details", () => {
    expect(
      parsePaymentMismatch("ignored", {
        expectedTotalXaf: "10000",
        receivedPaidXaf: "5000",
      }),
    ).toEqual({
      expectedTotalXaf: "10000",
      receivedPaidXaf: "5000",
    });
  });

  it("sums outbox payment rows", () => {
    expect(
      sumOutboxPayments([
        { amountXaf: "8000" },
        { amountXaf: 0 },
      ]),
    ).toBe("8000");
  });
});
