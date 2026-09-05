import { afterEach, describe, expect, it } from "vitest";
import {
  isLoginRateLimited,
  LOGIN_RATE_LIMIT,
  recordLoginFailure,
  resetLoginRateLimit,
  resetLoginRateLimitForTests,
} from "@/lib/auth/rate-limit";

describe("login rate limit", () => {
  afterEach(() => {
    resetLoginRateLimitForTests();
  });

  it("allows up to max failed attempts then blocks by email", () => {
    const ip = "203.0.113.10";
    const email = "caisse@dubai-phone.local";

    for (let i = 0; i < LOGIN_RATE_LIMIT.maxAttempts; i += 1) {
      expect(isLoginRateLimited(ip, email)).toBe(false);
      recordLoginFailure(ip, email);
    }

    expect(isLoginRateLimited(ip, email)).toBe(true);
  });

  it("blocks the same email even when the IP header rotates", () => {
    const email = "manager@dubai-phone.local";
    for (let i = 0; i < LOGIN_RATE_LIMIT.maxAttempts; i += 1) {
      recordLoginFailure(`203.0.113.${i + 1}`, email);
    }
    expect(isLoginRateLimited("198.51.100.9", email)).toBe(true);
  });

  it("skips the IP bucket when IP is unknown", () => {
    const emailA = "a@example.com";
    const emailB = "b@example.com";
    for (let i = 0; i < LOGIN_RATE_LIMIT.maxAttemptsPerIp; i += 1) {
      recordLoginFailure("unknown", `spray-${i}@example.com`);
    }
    expect(isLoginRateLimited("unknown", emailA)).toBe(false);
    expect(isLoginRateLimited("unknown", emailB)).toBe(false);
  });

  it("resets after a successful login", () => {
    const ip = "203.0.113.11";
    const email = "caisse@dubai-phone.local";

    for (let i = 0; i < LOGIN_RATE_LIMIT.maxAttempts; i += 1) {
      recordLoginFailure(ip, email);
    }
    expect(isLoginRateLimited(ip, email)).toBe(true);

    resetLoginRateLimit(ip, email);
    expect(isLoginRateLimited(ip, email)).toBe(false);
  });
});
