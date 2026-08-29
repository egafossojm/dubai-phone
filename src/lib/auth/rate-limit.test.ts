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

  it("allows up to max failed attempts then blocks", () => {
    const ip = "203.0.113.10";
    const email = "caisse@dubai-phone.local";

    for (let i = 0; i < LOGIN_RATE_LIMIT.maxAttempts; i += 1) {
      expect(isLoginRateLimited(ip, email)).toBe(false);
      recordLoginFailure(ip, email);
    }

    expect(isLoginRateLimited(ip, email)).toBe(true);
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
