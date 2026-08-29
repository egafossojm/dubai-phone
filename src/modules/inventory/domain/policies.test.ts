import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import {
  assertAdjustmentQuantitySign,
  assertAdjustmentReason,
  assertDeviceSellable,
  assertNoNegativeStock,
  assertNonZeroQuantity,
  expectedSerialStatusAfterMovement,
  movementTypeLabel,
} from "@/modules/inventory/domain/policies";

describe("inventory policies", () => {
  it("rejects zero quantity movements", () => {
    expect(() => assertNonZeroQuantity(0)).toThrow(AppError);
  });

  it("requires a meaningful adjustment reason", () => {
    expect(() => assertAdjustmentReason("ab")).toThrow(AppError);
    expect(assertAdjustmentReason("  inventaire  ")).toBe("inventaire");
  });

  it("blocks negative stock by default", () => {
    expect(() => assertNoNegativeStock(2, -3, false)).toThrow(AppError);
    expect(assertNoNegativeStock(2, -2, false)).toBe(0);
    expect(assertNoNegativeStock(0, -1, true)).toBe(-1);
  });

  it("forces damaged/lost movements to decrease stock", () => {
    expect(() => assertAdjustmentQuantitySign("DAMAGED", 1)).toThrow(AppError);
    expect(() => assertAdjustmentQuantitySign("LOST", -1)).not.toThrow();
  });

  it("only allows selling IN_STOCK devices", () => {
    expect(() => assertDeviceSellable("SOLD")).toThrow(AppError);
    expect(() => assertDeviceSellable("IN_STOCK")).not.toThrow();
  });

  it("maps movement types to French labels", () => {
    expect(movementTypeLabel("PURCHASE_RECEIPT")).toBe("Réception achat");
    expect(expectedSerialStatusAfterMovement("SALE", -1)).toBe("SOLD");
  });
});
