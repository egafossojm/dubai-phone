import { describe, expect, it } from "vitest";
import {
  averageBasketXaf,
  estimateSaleMarginXaf,
  inclusiveDaySpan,
  isLowStock,
  netLineAfterReturns,
  resolveDashboardRange,
  zonedMidnightUtc,
} from "@/modules/dashboard/domain/policies";

describe("dashboard date ranges (Africa/Douala)", () => {
  it("maps local midnight to 23:00Z previous calendar day (UTC+1)", () => {
    // 2026-09-05 00:00 Douala = 2026-09-04T23:00:00.000Z
    expect(zonedMidnightUtc(2026, 9, 5).toISOString()).toBe(
      "2026-09-04T23:00:00.000Z",
    );
    expect(zonedMidnightUtc(2026, 1, 1).toISOString()).toBe(
      "2025-12-31T23:00:00.000Z",
    );
  });

  it("resolves today as [local midnight, next midnight)", () => {
    // 2026-09-05 10:00 Douala = 09:00 UTC
    const now = new Date("2026-09-05T09:00:00.000Z");
    const range = resolveDashboardRange({ period: "today", now });
    expect(range.from.toISOString()).toBe("2026-09-04T23:00:00.000Z");
    expect(range.toExclusive.toISOString()).toBe("2026-09-05T23:00:00.000Z");
  });

  it("resolves month from the 1st local day", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    const range = resolveDashboardRange({ period: "month", now });
    expect(range.from.toISOString()).toBe("2026-08-31T23:00:00.000Z");
  });

  it("resolves custom inclusive end day", () => {
    const range = resolveDashboardRange({
      period: "custom",
      fromYmd: "2026-09-01",
      toYmd: "2026-09-03",
      now: new Date("2026-09-10T12:00:00.000Z"),
    });
    expect(range.from.toISOString()).toBe("2026-08-31T23:00:00.000Z");
    expect(range.toExclusive.toISOString()).toBe("2026-09-03T23:00:00.000Z");
  });

  it("counts inclusive custom day span", () => {
    expect(inclusiveDaySpan("2026-09-01", "2026-09-01")).toBe(1);
    expect(inclusiveDaySpan("2026-09-01", "2026-09-03")).toBe(3);
  });
});

describe("dashboard financial helpers", () => {
  it("nets returned quantities on a line", () => {
    expect(
      netLineAfterReturns({
        lineTotalXaf: BigInt(10_000),
        saleQuantity: 2,
        returnedQuantity: 1,
      }),
    ).toEqual({ netQuantity: 1, netLineTotalXaf: BigInt(5_000) });
  });

  it("estimates sale margin after refund and global discount in totalXaf", () => {
    // total 18_000 already includes discount vs lines 20_000; refund 5_000; cost 3_000×2
    expect(
      estimateSaleMarginXaf({
        saleTotalXaf: BigInt(18_000),
        refundedXaf: BigInt(5_000),
        lines: [
          {
            lineTotalXaf: BigInt(20_000),
            costPriceXaf: BigInt(3_000),
            saleQuantity: 2,
            returnedQuantity: 0,
          },
        ],
      }),
    ).toBe(BigInt(7_000)); // 13000 net revenue - 6000 cost
  });

  it("computes average basket with integer division", () => {
    expect(
      averageBasketXaf({ revenueXaf: BigInt(10_000), saleCount: 3 }),
    ).toBe(BigInt(3_333));
    expect(averageBasketXaf({ revenueXaf: BigInt(100), saleCount: 0 })).toBe(
      null,
    );
  });

  it("flags low stock at threshold inclusive", () => {
    expect(isLowStock(3, 3)).toBe(true);
    expect(isLowStock(4, 3)).toBe(false);
    expect(isLowStock(0, 3)).toBe(true);
  });
});
