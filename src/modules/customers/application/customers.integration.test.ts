/**
 * @vitest-environment node
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createSessionToken, hashSessionToken } from "@/lib/auth/session-token";
import { uniqueTestPhone } from "@/lib/test/sales-fixtures";
import { requireDatabaseForIntegration } from "@/lib/test/database-available";
import {
  GET as getCustomers,
  POST as createCustomer,
} from "@/app/api/customers/route";
import {
  DELETE as deleteCustomer,
  GET as getCustomer,
  PATCH as patchCustomer,
} from "@/app/api/customers/[id]/route";

const cookieJar = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "dp_session" && cookieJar.token
        ? { name, value: cookieJar.token }
        : undefined,
    set: () => undefined,
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

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });
}

const databaseAvailable = await requireDatabaseForIntegration();

describe.skipIf(!databaseAvailable)("customers APIs", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    cookieJar.token = undefined;
    await prisma.$disconnect();
  });

  it("lists customers for cashier", async () => {
    await attachSession("caisse@dubai-phone.local");
    const response = await getCustomers(
      jsonRequest("http://localhost/api/customers", "GET"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: { items: Array<{ fullName: string }> };
    };
    expect(payload.data.items.length).toBeGreaterThan(0);
  });

  it("creates a customer and returns detail with empty credit", async () => {
    await attachSession("caisse@dubai-phone.local");
    const suffix = randomBytes(2).toString("hex");
    const phone = uniqueTestPhone();
    const created = await createCustomer(
      jsonRequest("http://localhost/api/customers", "POST", {
        fullName: `Client Test ${suffix}`,
        phone,
      }),
    );
    expect(created.status).toBe(201);
    const createdPayload = (await created.json()) as { data: { id: string } };

    const detail = await getCustomer(
      jsonRequest(
        `http://localhost/api/customers/${createdPayload.data.id}`,
        "GET",
      ),
      { params: Promise.resolve({ id: createdPayload.data.id }) },
    );
    expect(detail.status).toBe(200);
    const detailPayload = (await detail.json()) as {
      data: { outstandingXaf: string; credits: unknown[] };
    };
    expect(detailPayload.data.outstandingXaf).toBe("0");
    expect(detailPayload.data.credits).toHaveLength(0);
  });

  it("rejects duplicate phone", async () => {
    await attachSession("caisse@dubai-phone.local");
    const existing = await prisma.customer.findFirstOrThrow({
      where: { deletedAt: null },
    });
    const response = await createCustomer(
      jsonRequest("http://localhost/api/customers", "POST", {
        fullName: "Doublon",
        phone: existing.phone,
      }),
    );
    expect(response.status).toBe(409);
  });

  it("allows reusing a phone after soft-delete", async () => {
    await attachSession("caisse@dubai-phone.local");
    const suffix = randomBytes(2).toString("hex");
    const phone = uniqueTestPhone();
    const created = await createCustomer(
      jsonRequest("http://localhost/api/customers", "POST", {
        fullName: `Client Soft ${suffix}`,
        phone,
      }),
    );
    expect(created.status).toBe(201);
    const createdPayload = (await created.json()) as { data: { id: string } };

    const deactivated = await deleteCustomer(
      jsonRequest(
        `http://localhost/api/customers/${createdPayload.data.id}`,
        "DELETE",
      ),
      { params: Promise.resolve({ id: createdPayload.data.id }) },
    );
    expect(deactivated.status).toBe(200);

    const reused = await createCustomer(
      jsonRequest("http://localhost/api/customers", "POST", {
        fullName: `Client Reuse ${suffix}`,
        phone,
      }),
    );
    expect(reused.status).toBe(201);
  });

  it("updates customer profile fields", async () => {
    await attachSession("caisse@dubai-phone.local");
    const suffix = randomBytes(2).toString("hex");
    const created = await createCustomer(
      jsonRequest("http://localhost/api/customers", "POST", {
        fullName: `Client Edit ${suffix}`,
        phone: uniqueTestPhone(),
      }),
    );
    expect(created.status).toBe(201);
    const createdPayload = (await created.json()) as { data: { id: string } };

    const updated = await patchCustomer(
      jsonRequest(
        `http://localhost/api/customers/${createdPayload.data.id}`,
        "PATCH",
        {
          email: `edit-${suffix}@example.com`,
          address: "Douala Bonanjo",
        },
      ),
      { params: Promise.resolve({ id: createdPayload.data.id }) },
    );
    expect(updated.status).toBe(200);
    const payload = (await updated.json()) as {
      data: { email: string | null; address: string | null };
    };
    expect(payload.data.email).toBe(`edit-${suffix}@example.com`);
    expect(payload.data.address).toBe("Douala Bonanjo");
  });
});
