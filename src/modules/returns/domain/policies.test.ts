import { describe, expect, it } from "vitest";
import {
  assertRefundWithinLimit,
  assertReturnWindow,
  computeReturnedGoodsValue,
  deriveWarrantyStatus,
} from "@/modules/returns/domain/policies";
import { AppError } from "@/lib/errors/app-error";

describe("returns policies", () => {
  it("derives expired warranty from endsAt", () => {
    expect(
      deriveWarrantyStatus({
        status: "ACTIVE",
        endsAt: new Date("2020-01-01T00:00:00Z"),
        now: new Date("2026-01-01T00:00:00Z"),
      }),
    ).toBe("EXPIRED");
    expect(
      deriveWarrantyStatus({
        status: "ACTIVE",
        endsAt: new Date("2030-01-01T00:00:00Z"),
        now: new Date("2026-01-01T00:00:00Z"),
      }),
    ).toBe("ACTIVE");
  });

  it("enforces return window", () => {
    expect(() =>
      assertReturnWindow({
        soldAt: new Date("2026-01-01T00:00:00Z"),
        maxDays: 7,
        now: new Date("2026-01-10T00:00:00Z"),
      }),
    ).toThrow(AppError);
    expect(() =>
      assertReturnWindow({
        soldAt: new Date("2026-01-01T00:00:00Z"),
        maxDays: 7,
        now: new Date("2026-01-05T00:00:00Z"),
      }),
    ).not.toThrow();
  });

  it("caps refunds", () => {
    expect(() =>
      assertRefundWithinLimit({
        amountXaf: BigInt(5001),
        refundableXaf: BigInt(5000),
      }),
    ).toThrow(AppError);
  });

  it("computes proportional returned goods value", () => {
    expect(
      computeReturnedGoodsValue({
        items: [
          {
            lineTotalXaf: BigInt(10_000),
            saleQuantity: 2,
            returnQuantity: 1,
          },
        ],
      }),
    ).toBe(BigInt(5000));
  });
});
