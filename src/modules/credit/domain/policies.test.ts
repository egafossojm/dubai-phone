import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import {
  assertNoOverpayment,
  deriveCreditStatus,
  deriveInstallmentStatus,
} from "@/modules/credit/domain/policies";

describe("credit policies", () => {
  it("rejects overpayment", () => {
    expect(() => assertNoOverpayment(BigInt(10_000), BigInt(10_001))).toThrow(
      AppError,
    );
    expect(() => assertNoOverpayment(BigInt(10_000), BigInt(10_000))).not.toThrow();
  });

  it("marks installments overdue after due date", () => {
    expect(
      deriveInstallmentStatus({
        dueDate: new Date("2026-01-01T00:00:00.000Z"),
        amountDueXaf: BigInt(40_000),
        amountPaidXaf: BigInt(0),
        now: new Date("2026-02-01T00:00:00.000Z"),
      }),
    ).toBe("OVERDUE");
  });

  it("derives credit PAID / PARTIALLY_PAID / OVERDUE / PENDING", () => {
    const installments = [
      {
        dueDate: new Date("2026-06-01T00:00:00.000Z"),
        amountDueXaf: BigInt(40_000),
        amountPaidXaf: BigInt(0),
        status: "DUE" as const,
      },
    ];
    expect(
      deriveCreditStatus({
        remainingXaf: BigInt(0),
        totalAmountXaf: BigInt(165_000),
        downPaymentXaf: BigInt(45_000),
        installments,
      }),
    ).toBe("PAID");

    expect(
      deriveCreditStatus({
        remainingXaf: BigInt(80_000),
        totalAmountXaf: BigInt(165_000),
        downPaymentXaf: BigInt(45_000),
        installments: [
          {
            dueDate: new Date("2026-06-01T00:00:00.000Z"),
            amountDueXaf: BigInt(40_000),
            amountPaidXaf: BigInt(40_000),
            status: "PAID",
          },
        ],
        now: new Date("2026-05-01T00:00:00.000Z"),
      }),
    ).toBe("PARTIALLY_PAID");

    expect(
      deriveCreditStatus({
        remainingXaf: BigInt(120_000),
        totalAmountXaf: BigInt(165_000),
        downPaymentXaf: BigInt(45_000),
        installments: [
          {
            dueDate: new Date("2026-02-01T00:00:00.000Z"),
            amountDueXaf: BigInt(40_000),
            amountPaidXaf: BigInt(0),
            status: "DUE",
          },
        ],
        now: new Date("2026-03-01T00:00:00.000Z"),
      }),
    ).toBe("OVERDUE");

    expect(
      deriveCreditStatus({
        remainingXaf: BigInt(120_000),
        totalAmountXaf: BigInt(165_000),
        downPaymentXaf: BigInt(45_000),
        installments,
        now: new Date("2026-05-01T00:00:00.000Z"),
      }),
    ).toBe("PENDING");
  });
});
