import { describe, expect, it } from "vitest";
import {
  assertCanRegisterSerial,
  assertSerializedIdentifiers,
  assertSerialsAreRecordedAtReceipt,
  canChangeProductPrices,
  canSeeCostPrice,
  normalizeOptionalImei,
  normalizeSku,
  parseXafAmount,
  stockStatusFromQuantity,
} from "@/modules/products/domain/policies";
import { AppError } from "@/lib/errors/app-error";

describe("product catalog policies", () => {
  it("normalizes SKU to uppercase", () => {
    expect(normalizeSku("sam-a16-128")).toBe("SAM-A16-128");
  });

  it("restricts price changes to products.delete holders", () => {
    expect(canChangeProductPrices(["products.update"])).toBe(false);
    expect(canChangeProductPrices(["products.delete"])).toBe(true);
  });

  it("rejects a selling price of zero", () => {
    expect(() => parseXafAmount(0, "Prix de vente", 1)).toThrow(AppError);
  });

  it("requires IMEI 1 or serial number", () => {
    expect(() =>
      assertSerializedIdentifiers({ imei1: null, imei2: null, serialNumber: null }),
    ).toThrow(/IMEI 1 ou le numéro de série/);
  });

  it("rejects identical IMEI 1 and IMEI 2", () => {
    expect(() =>
      assertSerializedIdentifiers({
        imei1: "350000000000010",
        imei2: "350000000000010",
        serialNumber: null,
      }),
    ).toThrow(/différents/);
  });

  it("rejects serials on a non-serialized product", () => {
    expect(() => assertCanRegisterSerial(false)).toThrow(AppError);
  });

  it("forbids creating serials from the catalog", () => {
    expect(() => assertSerialsAreRecordedAtReceipt()).toThrow(/réception de stock/);
  });

  it("validates IMEI length", () => {
    expect(() => normalizeOptionalImei("123")).toThrow(AppError);
    expect(normalizeOptionalImei("350000000000010")).toBe("350000000000010");
  });

  it("derives stock status from quantity and threshold", () => {
    expect(stockStatusFromQuantity(0, 3)).toBe("OUT_OF_STOCK");
    expect(stockStatusFromQuantity(2, 3)).toBe("LOW_STOCK");
    expect(stockStatusFromQuantity(10, 3)).toBe("IN_STOCK");
  });

  it("hides cost from a salesperson", () => {
    expect(canSeeCostPrice(["products.read", "sales.create"])).toBe(false);
    expect(canSeeCostPrice(["products.update"])).toBe(true);
  });
});
