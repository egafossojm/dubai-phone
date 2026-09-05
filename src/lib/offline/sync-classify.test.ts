import { describe, expect, it } from "vitest";
import {
  classifySyncFailure,
  syncTransactionStatusFromError,
} from "@/lib/offline/sync-classify";

describe("classifySyncFailure", () => {
  it("marks payment mismatch as FAILED", () => {
    expect(
      classifySyncFailure({
        httpStatus: 422,
        code: "BUSINESS_RULE_ERROR",
        message: "Paiement incomplet : attendu 8000 FCFA, reçu 2 FCFA.",
      }),
    ).toBe("FAILED");
  });

  it("prefers structured details.kind over message", () => {
    expect(
      classifySyncFailure({
        httpStatus: 422,
        code: "BUSINESS_RULE_ERROR",
        message: "ignored wording",
        details: { kind: "PAYMENT_MISMATCH" },
      }),
    ).toBe("FAILED");
    expect(
      classifySyncFailure({
        httpStatus: 422,
        code: "BUSINESS_RULE_ERROR",
        message: "ignored wording",
        details: { kind: "SERIAL_UNAVAILABLE" },
      }),
    ).toBe("CONFLICT");
  });

  it("marks IMEI conflicts as CONFLICT", () => {
    expect(
      classifySyncFailure({
        httpStatus: 422,
        code: "BUSINESS_RULE_ERROR",
        message: "Cet appareil n'est plus disponible à la vente.",
      }),
    ).toBe("CONFLICT");
  });

  it("marks authorization errors as CONFLICT", () => {
    expect(
      classifySyncFailure({
        httpStatus: 403,
        code: "AUTHORIZATION_ERROR",
        message: "Remise au-delà du plafond.",
      }),
    ).toBe("CONFLICT");
  });

  it("aligns server SyncTransaction status helper", () => {
    expect(
      syncTransactionStatusFromError({
        code: "BUSINESS_RULE_ERROR",
        message: "x",
        statusCode: 422,
        details: { kind: "PAYMENT_MISMATCH" },
      }),
    ).toBe("FAILED");
    expect(
      syncTransactionStatusFromError({
        code: "BUSINESS_RULE_ERROR",
        message: "x",
        statusCode: 422,
        details: { kind: "SERIAL_UNAVAILABLE" },
      }),
    ).toBe("CONFLICT");
  });
});
