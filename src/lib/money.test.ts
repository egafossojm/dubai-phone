import { describe, expect, it } from "vitest";
import { addXaf, formatXaf, xaf } from "@/lib/money";

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
});
