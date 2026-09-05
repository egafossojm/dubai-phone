import { describe, expect, it } from "vitest";
import { addXaf, formatXaf, normalizeMoneyInput, xaf } from "@/lib/money";

describe("money (FCFA integers)", () => {
  it("rejects non-integer numbers", () => {
    expect(() => xaf(1.5)).toThrow(/whole safe integers/);
  });

  it("adds without floating point", () => {
    expect(addXaf(xaf(200_000), xaf(150_000), xaf(250_000))).toBe(BigInt(600_000));
  });

  it("formats with FCFA suffix", () => {
    expect(formatXaf(xaf(165000))).toContain("FCFA");
    expect(formatXaf(xaf(165000))).toContain("165");
  });

  it("normalizes localized money input without truncating", () => {
    expect(normalizeMoneyInput("8 000")).toBe("8000");
    expect(normalizeMoneyInput("2\u00a0500")).toBe("2500");
    expect(normalizeMoneyInput("16 500")).toBe("16500");
    expect(normalizeMoneyInput("")).toBe("0");
  });
});
