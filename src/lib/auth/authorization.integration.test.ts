/**
 * @vitest-environment node
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createSessionToken, hashSessionToken } from "@/lib/auth/session-token";
import { requireDatabaseForIntegration } from "@/lib/test/database-available";
import { GET as getProducts } from "@/app/api/products/route";
import { GET as getUsers } from "@/app/api/users/route";
import { GET as getAudit } from "@/app/api/audit/route";
import { POST as refundSale } from "@/app/api/sales/refund/route";
import { POST as adjustInventory } from "@/app/api/inventory/adjust/route";
import { POST as receivePurchase } from "@/app/api/purchases/receive/route";
import { GET as getSales } from "@/app/api/sales/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { getSeedUserPassword } from "@/lib/auth/dev-credentials";
import {
  LOGIN_RATE_LIMIT,
  resetLoginRateLimitForTests,
} from "@/lib/auth/rate-limit";
import { NextRequest } from "next/server";

const cookieJar = vi.hoisted(() => ({ token: undefined as string | undefined }));

function refundStubRequest() {
  return new NextRequest("http://localhost/api/sales/refund", { method: "POST" });
}

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "dp_session" && cookieJar.token
        ? { name, value: cookieJar.token }
        : undefined,
    set: (name: string, value: string) => {
      if (name === "dp_session") {
        cookieJar.token = value;
      }
    },
    delete: () => {
      cookieJar.token = undefined;
    },
  }),
}));

async function attachSession(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const token = createSessionToken();
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  cookieJar.token = token;
}

async function statusOf(response: Response): Promise<number> {
  return response.status;
}

function productsListRequest() {
  return new NextRequest("http://localhost/api/products", { method: "GET" });
}

function salesListRequest() {
  return new NextRequest("http://localhost/api/sales", { method: "GET" });
}

function adjustRequest(body?: unknown) {
  return new NextRequest("http://localhost/api/inventory/adjust", {
    method: "POST",
    body: body ? JSON.stringify(body) : JSON.stringify({}),
    headers: { "content-type": "application/json" },
  });
}

function receiveRequest(body?: unknown) {
  return new NextRequest("http://localhost/api/purchases/receive", {
    method: "POST",
    body: JSON.stringify(
      body ?? {
        purchaseOrderId: "00000000-0000-4000-8000-000000000001",
        idempotencyKey: "auth-recv-missing-po-key",
        lines: [
          {
            purchaseOrderItemId: "00000000-0000-4000-8000-000000000002",
            quantityReceived: 1,
          },
        ],
      },
    ),
    headers: { "content-type": "application/json" },
  });
}

const databaseAvailable = await requireDatabaseForIntegration();

describe.skipIf(!databaseAvailable)("authorization APIs by role", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    cookieJar.token = undefined;
    await prisma.$disconnect();
  });

  it("rejects anonymous access to a protected API", async () => {
    cookieJar.token = undefined;
    expect(await statusOf(await getProducts(productsListRequest()))).toBe(401);
  });

  it("logs in with bcrypt credentials", async () => {
    cookieJar.token = undefined;
    const request = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "caisse@dubai-phone.local",
        password: getSeedUserPassword(),
      }),
      headers: { "content-type": "application/json" },
    });
    const response = await loginRoute(request);
    expect(response.status).toBe(200);
    expect(cookieJar.token).toBeTruthy();
  });

  it("allows a salesperson to read sales but not refund or manage users", async () => {
    await attachSession("caisse@dubai-phone.local");
    expect(await statusOf(await getSales(salesListRequest()))).toBe(200);
    expect(await statusOf(await getProducts(productsListRequest()))).toBe(200);
    expect(await statusOf(await refundSale(refundStubRequest()))).toBe(403);
    expect(await statusOf(await getUsers())).toBe(403);
    expect(await statusOf(await getAudit())).toBe(403);
    expect(await statusOf(await adjustInventory(adjustRequest()))).toBe(403);
  });

  it("allows an inventory manager to receive purchases but not create sales refunds", async () => {
    await attachSession("stock@dubai-phone.local");
    // Receive is implemented: unknown PO id → not found (not 501 stub).
    expect(await statusOf(await receivePurchase(receiveRequest()))).toBe(404);
    // Adjust is implemented: empty/invalid body → validation (not 501 stub).
    expect(await statusOf(await adjustInventory(adjustRequest()))).toBe(400);
    expect(await statusOf(await getSales(salesListRequest()))).toBe(403);
    expect(await statusOf(await refundSale(refundStubRequest()))).toBe(403);
    expect(await statusOf(await getUsers())).toBe(403);
  });

  it("allows a manager to hit legacy refund stub without mutating data", async () => {
    await attachSession("manager@dubai-phone.local");
    const paymentsBefore = await prisma.payment.count();
    const movementsBefore = await prisma.stockMovement.count();

    const refundResponse = await refundSale(refundStubRequest());
    expect(refundResponse.status).toBe(501);
    const payload = (await refundResponse.json()) as {
      success: boolean;
      error?: { code: string; message?: string };
    };
    expect(payload.success).toBe(false);
    expect(payload.error?.code).toBe("NOT_IMPLEMENTED");
    expect(payload.error?.message).toMatch(/returns/i);
    expect(await prisma.payment.count()).toBe(paymentsBefore);
    expect(await prisma.stockMovement.count()).toBe(movementsBefore);

    expect(await statusOf(await getUsers())).toBe(200);
    const { POST: createUser } = await import("@/app/api/users/route");
    expect(await statusOf(await createUser())).toBe(403);
  });

  it("allows a super administrator to read audit; user creation is not implemented yet", async () => {
    await attachSession("admin@dubai-phone.local");
    expect(await statusOf(await getAudit())).toBe(200);
    const { POST: createUser } = await import("@/app/api/users/route");
    expect(await statusOf(await createUser())).toBe(501);
  });

  it("rejects an expired session cookie", async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "caisse@dubai-phone.local" },
    });
    const token = createSessionToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() - 60 * 1000),
      },
    });
    cookieJar.token = token;
    expect(await statusOf(await getProducts(productsListRequest()))).toBe(401);
  });

  it("rejects a session when the user is disabled", async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "caisse@dubai-phone.local" },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { status: "DISABLED" },
    });
    try {
      await attachSession("caisse@dubai-phone.local");
      expect(await statusOf(await getProducts(productsListRequest()))).toBe(401);
    } finally {
      await prisma.user.update({
        where: { id: user.id },
        data: { status: "ACTIVE" },
      });
    }
  });

  it("revokes the session on logout", async () => {
    await attachSession("caisse@dubai-phone.local");
    const token = cookieJar.token;
    expect(token).toBeTruthy();
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "caisse@dubai-phone.local" },
    });

    const request = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
    });
    expect(await statusOf(await logoutRoute(request))).toBe(200);
    expect(cookieJar.token).toBeUndefined();
    expect(await statusOf(await getProducts(productsListRequest()))).toBe(401);

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token!) },
    });
    expect(session?.revokedAt).not.toBeNull();

    const logoutAudit = await prisma.auditLog.findFirst({
      where: { action: "auth.logout", actorId: user.id },
      orderBy: { createdAt: "desc" },
    });
    expect(logoutAudit?.actorId).toBe(user.id);
    expect(logoutAudit?.entityId).toBe(session?.id);
  });

  it("rate-limits repeated login failures and resets after success", async () => {
    resetLoginRateLimitForTests();
    const ip = "203.0.113.50";
    const email = "caisse@dubai-phone.local";
    const password = getSeedUserPassword();

    async function postLogin(bodyPassword: string) {
      return loginRoute(
        new NextRequest("http://localhost/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password: bodyPassword }),
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": ip,
          },
        }),
      );
    }

    for (let i = 0; i < 3; i += 1) {
      expect(await statusOf(await postLogin("wrong-password"))).toBe(401);
    }

    expect(await statusOf(await postLogin(password))).toBe(200);

    for (let i = 0; i < LOGIN_RATE_LIMIT.maxAttempts; i += 1) {
      expect(await statusOf(await postLogin("wrong-password"))).toBe(401);
    }
    expect(await statusOf(await postLogin("wrong-password"))).toBe(429);
  });

  it("revokes prior sessions on a new successful login", async () => {
    resetLoginRateLimitForTests();
    await attachSession("caisse@dubai-phone.local");
    const oldToken = cookieJar.token!;
    expect(await statusOf(await getProducts(productsListRequest()))).toBe(200);

    const password = getSeedUserPassword();
    const loginResponse = await loginRoute(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "caisse@dubai-phone.local",
          password,
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(await statusOf(loginResponse)).toBe(200);

    cookieJar.token = oldToken;
    expect(await statusOf(await getProducts(productsListRequest()))).toBe(401);

    const oldSession = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(oldToken) },
    });
    expect(oldSession?.revokedAt).not.toBeNull();
  });
});
