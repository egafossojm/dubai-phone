/**
 * @vitest-environment node
 */
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createSessionToken, hashSessionToken } from "@/lib/auth/session-token";
import { requireDatabaseForIntegration } from "@/lib/test/database-available";
import {
  ensureVariantStock,
  findSellableVariant,
} from "@/lib/test/sales-fixtures";
import { POST as createSale } from "@/app/api/sales/route";
import { POST as createReturn } from "@/app/api/returns/route";
import { POST as inspectReturn } from "@/app/api/returns/[id]/inspect/route";
import { POST as acceptReturn } from "@/app/api/returns/[id]/accept/route";
import { POST as refundReturn } from "@/app/api/returns/[id]/refund/route";
import { GET as getDashboard } from "@/app/api/dashboard/route";

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
  return user;
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

const databaseAvailable = await requireDatabaseForIntegration();

describe.skipIf(!databaseAvailable)("dashboard API", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    cookieJar.token = undefined;
    await prisma.$disconnect();
  });

  it("gives a salesperson own CA without store-wide financials", async () => {
    await attachSession("caisse@dubai-phone.local");
    const response = await getDashboard(
      new NextRequest("http://localhost/api/dashboard?period=today"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: {
        canReadFinancials: boolean;
        canReadOwnCa: boolean;
        financials: unknown;
        ownCa: { caPeriodXaf: string; saleCount: number } | null;
        salesBySeller: Array<{ saleCount: number; revenueXaf?: string }>;
      };
    };
    expect(payload.data.canReadFinancials).toBe(false);
    expect(payload.data.financials).toBeNull();
    expect(payload.data.canReadOwnCa).toBe(true);
    expect(payload.data.ownCa).toBeTruthy();
    expect(
      payload.data.salesBySeller.every((row) => row.revenueXaf === undefined),
    ).toBe(true);
  });

  it("exposes financial KPIs for a manager and rejects bad custom range", async () => {
    await attachSession("caisse@dubai-phone.local");
    const cable = await findSellableVariant();
    if (!cable) {
      return;
    }
    await ensureVariantStock(cable.id, 2);
    const unit = Number(cable.sellingPriceXaf);
    const clientTxnId = randomUUID();
    const saleResponse = await createSale(
      jsonRequest("http://localhost/api/sales", "POST", {
        clientTxnId,
        kind: "IMMEDIATE",
        items: [{ variantId: cable.id, quantity: 1 }],
        payments: [
          {
            method: "CASH",
            amountXaf: unit,
            idempotencyKey: `dash-${clientTxnId}`,
          },
        ],
      }),
    );
    expect(saleResponse.status).toBe(201);

    await attachSession("manager@dubai-phone.local");
    const bad = await getDashboard(
      new NextRequest(
        "http://localhost/api/dashboard?period=custom&from=2020-01-01&to=2026-12-31",
      ),
    );
    expect(bad.status).toBe(400);

    const response = await getDashboard(
      new NextRequest("http://localhost/api/dashboard?period=today"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: {
        canReadFinancials: boolean;
        saleCount: number;
        financials: {
          caPeriodXaf: string;
          refundsPeriodXaf: string;
          marginXaf: string;
          paymentsByMethod: Array<{ method: string }>;
        } | null;
        topProducts: Array<{ quantity: number; sku: string }>;
      };
    };
    expect(payload.data.canReadFinancials).toBe(true);
    expect(payload.data.financials).toBeTruthy();
    expect(payload.data.saleCount).toBeGreaterThanOrEqual(1);
    expect(BigInt(payload.data.financials!.caPeriodXaf)).toBeGreaterThanOrEqual(
      BigInt(unit),
    );
    expect(payload.data.financials!.paymentsByMethod.length).toBeGreaterThan(0);
    expect(
      payload.data.topProducts.some((row) => row.sku === cable.sku),
    ).toBe(true);
  });

  it("does not keep full CA after a completed refund return", async () => {
    await attachSession("caisse@dubai-phone.local");
    const cable = await findSellableVariant();
    if (!cable) {
      return;
    }
    await ensureVariantStock(cable.id, 3);
    const unit = Number(cable.sellingPriceXaf);
    const clientTxnId = randomUUID();
    const saleResponse = await createSale(
      jsonRequest("http://localhost/api/sales", "POST", {
        clientTxnId,
        kind: "IMMEDIATE",
        items: [{ variantId: cable.id, quantity: 1 }],
        payments: [
          {
            method: "CASH",
            amountXaf: unit,
            idempotencyKey: `dash-ret-${clientTxnId}`,
          },
        ],
      }),
    );
    expect(saleResponse.status).toBe(201);
    const salePayload = (await saleResponse.json()) as {
      data: { sale: { id: string; items: Array<{ id: string }>; totalXaf: string } };
    };
    const saleId = salePayload.data.sale.id;
    const saleItemId = salePayload.data.sale.items[0]!.id;

    await attachSession("manager@dubai-phone.local");
    const before = await getDashboard(
      new NextRequest("http://localhost/api/dashboard?period=today"),
    );
    const beforePayload = (await before.json()) as {
      data: { financials: { caPeriodXaf: string; refundsPeriodXaf: string } };
    };
    const caBefore = BigInt(beforePayload.data.financials.caPeriodXaf);

    const created = await createReturn(
      jsonRequest("http://localhost/api/returns", "POST", {
        saleId,
        reason: "Dashboard netting test",
        items: [{ saleItemId, quantity: 1 }],
      }),
    );
    expect(created.status).toBe(201);
    const createdPayload = (await created.json()) as { data: { id: string } };
    const returnId = createdPayload.data.id;

    await inspectReturn(
      jsonRequest(`http://localhost/api/returns/${returnId}/inspect`, "POST"),
      params(returnId),
    );
    await acceptReturn(
      jsonRequest(`http://localhost/api/returns/${returnId}/accept`, "POST", {
        resolution: "REFUND",
      }),
      params(returnId),
    );
    const refunded = await refundReturn(
      jsonRequest(`http://localhost/api/returns/${returnId}/refund`, "POST", {
        amountXaf: salePayload.data.sale.totalXaf,
        method: "CASH",
        idempotencyKey: `dash-refund-${randomBytes(4).toString("hex")}`,
      }),
      params(returnId),
    );
    expect(refunded.status).toBe(200);

    const after = await getDashboard(
      new NextRequest("http://localhost/api/dashboard?period=today"),
    );
    const afterPayload = (await after.json()) as {
      data: {
        financials: { caPeriodXaf: string; refundsPeriodXaf: string };
        topProducts: Array<{ sku: string; quantity: number }>;
      };
    };
    const caAfter = BigInt(afterPayload.data.financials.caPeriodXaf);
    const refunds = BigInt(afterPayload.data.financials.refundsPeriodXaf);
    expect(refunds).toBeGreaterThanOrEqual(BigInt(unit));
    expect(caAfter).toBe(caBefore - BigInt(unit));
  });

  it("rejects unauthenticated dashboard access", async () => {
    cookieJar.token = undefined;
    const response = await getDashboard(
      new NextRequest("http://localhost/api/dashboard?period=month"),
    );
    expect(response.status).toBe(401);
  });
});
