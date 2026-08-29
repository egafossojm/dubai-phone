import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import {
  assertNoOverReceive,
  derivePurchaseOrderStatusAfterReceive,
  purchaseOrderStatusLabel,
} from "@/modules/purchases/domain/policies";

describe("purchase policies", () => {
  it("rejects over-receive", () => {
    expect(() => assertNoOverReceive(10, 8, 3)).toThrow(AppError);
    expect(() => assertNoOverReceive(10, 8, 2)).not.toThrow();
  });

  it("derives partial vs complete receive status", () => {
    expect(
      derivePurchaseOrderStatusAfterReceive([
        { quantityOrdered: 5, quantityReceived: 2 },
        { quantityOrdered: 3, quantityReceived: 3 },
      ]),
    ).toBe("PARTIALLY_RECEIVED");
    expect(
      derivePurchaseOrderStatusAfterReceive([
        { quantityOrdered: 5, quantityReceived: 5 },
      ]),
    ).toBe("RECEIVED");
  });

  it("labels statuses in French", () => {
    expect(purchaseOrderStatusLabel("ORDERED")).toBe("Commandée");
  });
});
