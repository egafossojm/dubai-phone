/**
 * @vitest-environment node
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  CreditStatus,
  PaymentMethod,
  SaleKind,
  SaleStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { xaf } from "@/lib/money";
import { createSessionToken, hashSessionToken } from "@/lib/auth/session-token";
import { requireDatabaseForIntegration } from "@/lib/test/database-available";
import { GET as getCredit } from "@/app/api/credit/[id]/route";
import { GET as listCredits } from "@/app/api/credit/route";
import { POST as payCredit } from "@/app/api/credit/payments/route";

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

async function createOpenCredit(options?: { overdue?: boolean }) {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const customer = await prisma.customer.findFirstOrThrow({
    where: { deletedAt: null },
  });
  const cashier = await prisma.user.findUniqueOrThrow({
    where: { email: "caisse@dubai-phone.local" },
  });
  const variant = await prisma.productVariant.findFirstOrThrow({
    where: { deletedAt: null },
  });

  const dueBase = options?.overdue
    ? new Date("2026-01-10T00:00:00.000Z")
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const sale = await prisma.sale.create({
    data: {
      reference: `V-TEST-${suffix}`,
      clientTxnId: `txn-credit-${suffix}`,
      kind: SaleKind.INSTALLMENT,
      status: SaleStatus.COMPLETED,
      customerId: customer.id,
      soldById: cashier.id,
      subtotalXaf: xaf(100_000),
      totalXaf: xaf(100_000),
      completedAt: new Date(),
      items: {
        create: {
          variantId: variant.id,
          quantity: 1,
          unitPriceXaf: xaf(100_000),
          lineTotalXaf: xaf(100_000),
        },
      },
    },
  });

  const credit = await prisma.customerCredit.create({
    data: {
      reference: `CR-TEST-${suffix}`,
      saleId: sale.id,
      customerId: customer.id,
      totalAmountXaf: xaf(100_000),
      downPaymentXaf: xaf(20_000),
      remainingXaf: xaf(80_000),
      status: CreditStatus.PENDING,
      installments: {
        create: [
          {
            sequence: 1,
            dueDate: dueBase,
            amountDueXaf: xaf(40_000),
          },
          {
            sequence: 2,
            dueDate: new Date(dueBase.getTime() + 30 * 24 * 60 * 60 * 1000),
            amountDueXaf: xaf(40_000),
          },
        ],
      },
    },
    include: { installments: { orderBy: { sequence: "asc" } } },
  });

  return credit;
}

const databaseAvailable = await requireDatabaseForIntegration();

describe.skipIf(!databaseAvailable)("credit payment APIs", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    cookieJar.token = undefined;
    await prisma.$disconnect();
  });

  it("forbids inventory from registering a credit payment", async () => {
    await attachSession("stock@dubai-phone.local");
    const response = await payCredit(
      jsonRequest("http://localhost/api/credit/payments", "POST", {
        creditId: "00000000-0000-4000-8000-000000000001",
        amountXaf: 1000,
        method: "CASH",
        idempotencyKey: "forbid-stock-pay",
      }),
    );
    expect(response.status).toBe(403);
  });

  it("registers a partial payment and updates remaining balance", async () => {
    await attachSession("caisse@dubai-phone.local");
    const credit = await createOpenCredit();
    const response = await payCredit(
      jsonRequest("http://localhost/api/credit/payments", "POST", {
        creditId: credit.id,
        amountXaf: 25_000,
        method: PaymentMethod.CASH,
        idempotencyKey: `partial-${credit.reference}`,
      }),
    );
    expect(response.status).toBe(201);
    const payload = (await response.json()) as {
      data: {
        replayed: boolean;
        credit: { remainingXaf: string; status: string };
      };
    };
    expect(payload.data.replayed).toBe(false);
    expect(payload.data.credit.remainingXaf).toBe("55000");
    expect(payload.data.credit.status).toBe("PARTIALLY_PAID");
  });

  it("supports multiple payments until completed", async () => {
    await attachSession("caisse@dubai-phone.local");
    const credit = await createOpenCredit();
    const first = await payCredit(
      jsonRequest("http://localhost/api/credit/payments", "POST", {
        creditId: credit.id,
        amountXaf: 40_000,
        method: "ORANGE_MONEY",
        idempotencyKey: `multi-1-${credit.reference}`,
      }),
    );
    expect(first.status).toBe(201);

    const second = await payCredit(
      jsonRequest("http://localhost/api/credit/payments", "POST", {
        creditId: credit.id,
        amountXaf: 40_000,
        method: "MTN_MOBILE_MONEY",
        idempotencyKey: `multi-2-${credit.reference}`,
      }),
    );
    expect(second.status).toBe(201);
    const payload = (await second.json()) as {
      data: { credit: { remainingXaf: string; status: string } };
    };
    expect(payload.data.credit.remainingXaf).toBe("0");
    expect(payload.data.credit.status).toBe("PAID");
  });

  it("rejects overpayment and zero amount", async () => {
    await attachSession("caisse@dubai-phone.local");
    const credit = await createOpenCredit();

    const over = await payCredit(
      jsonRequest("http://localhost/api/credit/payments", "POST", {
        creditId: credit.id,
        amountXaf: 90_000,
        method: "CASH",
        idempotencyKey: `over-${credit.reference}`,
      }),
    );
    expect(over.status).toBe(422);

    const zero = await payCredit(
      jsonRequest("http://localhost/api/credit/payments", "POST", {
        creditId: credit.id,
        amountXaf: 0,
        method: "CASH",
        idempotencyKey: `zero-${credit.reference}`,
      }),
    );
    expect(zero.status).toBe(400);
  });

  it("marks overdue installments when viewing credit detail", async () => {
    await attachSession("caisse@dubai-phone.local");
    const credit = await createOpenCredit({ overdue: true });
    const response = await getCredit(
      jsonRequest(`http://localhost/api/credit/${credit.id}`, "GET"),
      { params: Promise.resolve({ id: credit.id }) },
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: {
        status: string;
        installments: Array<{ status: string }>;
      };
    };
    expect(payload.data.status).toBe("OVERDUE");
    expect(payload.data.installments[0]?.status).toBe("OVERDUE");
  });

  it("replays the same payment idempotency key", async () => {
    await attachSession("caisse@dubai-phone.local");
    const credit = await createOpenCredit();
    const body = {
      creditId: credit.id,
      amountXaf: 10_000,
      method: "CASH",
      idempotencyKey: `idem-${credit.reference}`,
    };
    const first = await payCredit(
      jsonRequest("http://localhost/api/credit/payments", "POST", body),
    );
    const second = await payCredit(
      jsonRequest("http://localhost/api/credit/payments", "POST", body),
    );
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstPayload = (await first.json()) as {
      data: { paymentId: string; replayed: boolean };
    };
    const secondPayload = (await second.json()) as {
      data: { paymentId: string; replayed: boolean };
    };
    expect(secondPayload.data.replayed).toBe(true);
    expect(secondPayload.data.paymentId).toBe(firstPayload.data.paymentId);

    const updated = await prisma.customerCredit.findUniqueOrThrow({
      where: { id: credit.id },
    });
    expect(updated.remainingXaf).toBe(xaf(70_000));
  });

  it("stores multi-installment payment allocations", async () => {
    await attachSession("caisse@dubai-phone.local");
    const credit = await createOpenCredit();
    const response = await payCredit(
      jsonRequest("http://localhost/api/credit/payments", "POST", {
        creditId: credit.id,
        amountXaf: 55_000,
        method: "CASH",
        idempotencyKey: `alloc-${credit.reference}`,
      }),
    );
    expect(response.status).toBe(201);
    const payload = (await response.json()) as {
      data: {
        paymentId: string;
        credit: {
          payments: Array<{
            id: string;
            allocations: Array<{
              installmentSequence: number;
              amountXaf: string;
            }>;
          }>;
        };
      };
    };
    const payment = payload.data.credit.payments.find(
      (row) => row.id === payload.data.paymentId,
    );
    expect(payment?.allocations).toHaveLength(2);
    expect(
      payment?.allocations.map((row) => ({
        installmentSequence: row.installmentSequence,
        amountXaf: row.amountXaf,
      })),
    ).toEqual([
      { installmentSequence: 1, amountXaf: "40000" },
      { installmentSequence: 2, amountXaf: "15000" },
    ]);

    const stored = await prisma.paymentAllocation.findMany({
      where: { paymentId: payload.data.paymentId },
      orderBy: { amountXaf: "desc" },
    });
    expect(stored).toHaveLength(2);
    expect(stored.map((row) => row.amountXaf.toString())).toEqual([
      "40000",
      "15000",
    ]);
  });

  it("marks overdue credits when listing", async () => {
    await attachSession("caisse@dubai-phone.local");
    const credit = await createOpenCredit({ overdue: true });
    const response = await listCredits(
      jsonRequest("http://localhost/api/credit?status=OVERDUE", "GET"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: { items: Array<{ id: string; status: string }> };
    };
    const match = payload.data.items.find((row) => row.id === credit.id);
    expect(match?.status).toBe("OVERDUE");
  });
});
