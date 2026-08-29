import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("un-mot-de-passe-de-test");
    expect(hash.startsWith("$2")).toBe(true);
    await expect(verifyPassword("un-mot-de-passe-de-test", hash)).resolves.toBe(
      true,
    );
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });

  it("rejects legacy sha256 hashes", async () => {
    await expect(verifyPassword("x", "sha256:abcd")).resolves.toBe(false);
  });
});
