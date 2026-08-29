import { describe, expect, it } from "vitest";
import {
  assertDiscountWithinCap,
  assertDownPaymentRules,
  assertImmediatePaymentsCoverTotal,
  splitEqualInstallments,
} from "@/modules/sales/domain/policies";
import { AppError } from "@/lib/errors/app-error";

describe("sales policies", () => {
  it("requires exact payment for immediate sales", () => {
    expect(() =>
      assertImmediatePaymentsCoverTotal(BigInt(10_000), BigInt(9_000)),
    ).toThrow(AppError);
    expect(() =>
      assertImmediatePaymentsCoverTotal(BigInt(10_000), BigInt(10_000)),
    ).not.toThrow();
  });

  it("enforces credit down payment bounds", () => {
    expect(() =>
      assertDownPaymentRules({
        totalXaf: BigInt(100_000),
        downPaymentXaf: BigInt(5_000),
        minDownPaymentBps: 1000,
      }),
    ).toThrow(AppError);
    expect(() =>
      assertDownPaymentRules({
        totalXaf: BigInt(100_000),
        downPaymentXaf: BigInt(100_000),
        minDownPaymentBps: 1000,
      }),
    ).toThrow(AppError);
    expect(() =>
      assertDownPaymentRules({
        totalXaf: BigInt(100_000),
        downPaymentXaf: BigInt(20_000),
        minDownPaymentBps: 1000,
      }),
    ).not.toThrow();
  });

  it("caps discounts by role bps", () => {
    expect(() =>
      assertDiscountWithinCap({
        subtotalXaf: BigInt(100_000),
        discountTotalXaf: BigInt(5_001),
        maxDiscountBps: 500,
      }),
    ).toThrow(AppError);
    expect(() =>
      assertDiscountWithinCap({
        subtotalXaf: BigInt(100_000),
        discountTotalXaf: BigInt(5_000),
        maxDiscountBps: 500,
      }),
    ).not.toThrow();
  });

  it("splits installments without losing francs", () => {
    expect(splitEqualInstallments(BigInt(100_000), 3)).toEqual([
      BigInt(33333),
      BigInt(33333),
      BigInt(33334),
    ]);
  });
});
