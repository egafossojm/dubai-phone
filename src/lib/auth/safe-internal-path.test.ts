import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/auth/safe-internal-path";

describe("safeInternalPath", () => {
  it("keeps a same-origin relative path", () => {
    expect(safeInternalPath("/produits")).toBe("/produits");
    expect(safeInternalPath("/stock?q=a")).toBe("/stock?q=a");
  });

  it("rejects protocol-relative and backslash open redirects", () => {
    expect(safeInternalPath("//evil.example")).toBe("/");
    expect(safeInternalPath("/\\evil.example")).toBe("/");
    expect(safeInternalPath("https://evil.example")).toBe("/");
    expect(safeInternalPath("evil.example")).toBe("/");
  });

  it("falls back to home when empty", () => {
    expect(safeInternalPath(null)).toBe("/");
    expect(safeInternalPath("")).toBe("/");
  });
});
