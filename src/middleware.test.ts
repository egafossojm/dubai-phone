import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

describe("auth middleware", () => {
  it("does not bounce /login to home when a (possibly dead) cookie is present", () => {
    const request = new NextRequest("http://localhost/login", {
      headers: { cookie: "dp_session=dead-token" },
    });
    const response = middleware(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects anonymous app pages to login", () => {
    const request = new NextRequest("http://localhost/stock");
    const response = middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?from=%2Fstock");
  });

  it("allows anonymous readiness and health API probes", () => {
    const health = middleware(new NextRequest("http://localhost/api/health"));
    expect(health.status).toBe(200);
    const ready = middleware(new NextRequest("http://localhost/api/ready"));
    expect(ready.status).toBe(200);
  });
});
