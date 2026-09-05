import { describe, expect, it } from "vitest";
import { parseEnv, isTrustedProxyEnabled } from "@/lib/env";

describe("parseEnv", () => {
  it("requires DATABASE_URL when NODE_ENV=production", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_NAME: "Dubai Phone",
        NEXT_PUBLIC_APP_URL: "https://pos.example.cm",
      }),
    ).toThrow(/Invalid environment/);
  });

  it("allows missing DATABASE_URL in development", () => {
    const env = parseEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("parses TRUSTED_PROXY=1 as true", () => {
    const env = parseEnv({
      NODE_ENV: "test",
      TRUSTED_PROXY: "1",
      DATABASE_URL: "postgresql://u:p@localhost:5432/db",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });
    expect(env.TRUSTED_PROXY).toBe(true);
  });
});

describe("isTrustedProxyEnabled", () => {
  it("reflects call-time process env", () => {
    expect(isTrustedProxyEnabled({ TRUSTED_PROXY: undefined })).toBe(false);
    expect(isTrustedProxyEnabled({ TRUSTED_PROXY: "1" })).toBe(true);
    expect(isTrustedProxyEnabled({ TRUSTED_PROXY: "true" })).toBe(true);
    expect(isTrustedProxyEnabled({ TRUSTED_PROXY: "0" })).toBe(false);
  });
});
