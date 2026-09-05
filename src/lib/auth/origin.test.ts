import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import { assertMutatingOrigin } from "@/lib/auth/origin";
import { clientIp } from "@/lib/auth/service";

describe("clientIp / TRUSTED_PROXY", () => {
  it("ignores X-Forwarded-For when TRUSTED_PROXY is unset", () => {
    const previous = process.env.TRUSTED_PROXY;
    delete process.env.TRUSTED_PROXY;
    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.9" },
    });
    expect(clientIp(request)).toBe("unknown");
    if (previous === undefined) {
      delete process.env.TRUSTED_PROXY;
    } else {
      process.env.TRUSTED_PROXY = previous;
    }
  });

  it("uses the first X-Forwarded-For hop when TRUSTED_PROXY=1", () => {
    const previous = process.env.TRUSTED_PROXY;
    process.env.TRUSTED_PROXY = "1";
    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    });
    expect(clientIp(request)).toBe("203.0.113.9");
    if (previous === undefined) {
      delete process.env.TRUSTED_PROXY;
    } else {
      process.env.TRUSTED_PROXY = previous;
    }
  });
});

describe("assertMutatingOrigin", () => {
  it("rejects cross-origin POST when Origin is present", () => {
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(() =>
      assertMutatingOrigin(
        new Request("http://localhost:3000/api/sales", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toThrow(AppError);
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = previous;
    }
  });

  it("allows POST without Origin header", () => {
    expect(() =>
      assertMutatingOrigin(
        new Request("http://localhost:3000/api/sales", { method: "POST" }),
      ),
    ).not.toThrow();
  });
});
