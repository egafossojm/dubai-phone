/**
 * @vitest-environment node
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createSessionToken, hashSessionToken } from "@/lib/auth/session-token";
import { requireDatabaseForIntegration } from "@/lib/test/database-available";
import {
  allocateTestSerial,
  ensureVariantStock,
  findSellableVariant,
} from "@/lib/test/sales-fixtures";
import { POST as createSale } from "@/app/api/sales/route";
import { POST as createReturn } from "@/app/api/returns/route";
import { POST as inspectReturn } from "@/app/api/returns/[id]/inspect/route";
import { POST as acceptReturn } from "@/app/api/returns/[id]/accept/route";
import { POST as refundReturn } from "@/app/api/returns/[id]/refund/route";
import { GET as getReceipt } from "@/app/api/receipts/[saleId]/route";
import { GET as getReceiptPdf } from "@/app/api/receipts/[saleId]/pdf/route";
import { GET as getReceiptHtml } from "@/app/api/receipts/[saleId]/html/route";
import { POST as markPrinted } from "@/app/api/receipts/[saleId]/print/route";

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

function params(saleId: string) {
  return { params: Promise.resolve({ saleId }) };
}

function returnParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const databaseAvailable = await requireDatabaseForIntegration();

describe.skipIf(!databaseAvailable)("receipts API", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    cookieJar.token = undefined;
    await prisma.$disconnect();
  });

  it("snapshots receipt, keeps PDF read-only for printedAt, and serves HTML", async () => {
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
            idempotencyKey: `receipt-${clientTxnId}`,
          },
        ],
      }),
    );
    expect(saleResponse.status).toBe(201);
    const salePayload = (await saleResponse.json()) as {
      data: { sale: { id: string; receiptReference: string | null } };
    };
    const saleId = salePayload.data.sale.id;

    const row = await prisma.receipt.findUniqueOrThrow({
      where: { saleId },
      select: { snapshotJson: true, printedAt: true },
    });
    expect(row.snapshotJson).toBeTruthy();
    expect(row.printedAt).toBeNull();

    const receiptResponse = await getReceipt(
      new NextRequest(`http://localhost/api/receipts/${saleId}`),
      params(saleId),
    );
    expect(receiptResponse.status).toBe(200);
    const receiptPayload = (await receiptResponse.json()) as {
      data: { fromSnapshot: boolean; document: { blocks: unknown[] } };
    };
    expect(receiptPayload.data.fromSnapshot).toBe(true);

    const pdfResponse = await getReceiptPdf(
      new NextRequest(`http://localhost/api/receipts/${saleId}/pdf`),
      params(saleId),
    );
    expect(pdfResponse.status).toBe(200);
    const afterPdf = await prisma.receipt.findUniqueOrThrow({
      where: { saleId },
      select: { printedAt: true },
    });
    expect(afterPdf.printedAt).toBeNull();

    const htmlResponse = await getReceiptHtml(
      new NextRequest(`http://localhost/api/receipts/${saleId}/html`),
      params(saleId),
    );
    expect(htmlResponse.status).toBe(200);
    expect(htmlResponse.headers.get("content-type")).toContain("text/html");

    const printed = await markPrinted(
      new NextRequest(`http://localhost/api/receipts/${saleId}/print`, {
        method: "POST",
      }),
      params(saleId),
    );
    expect(printed.status).toBe(200);
    const afterPrint = await prisma.receipt.findUniqueOrThrow({
      where: { saleId },
      select: { printedAt: true },
    });
    expect(afterPrint.printedAt).toBeTruthy();
  });

  it("keeps original IMEI on reprint after a completed refund return", async () => {
    await attachSession("caisse@dubai-phone.local");
    const serial = await allocateTestSerial();
    if (!serial) {
      return;
    }
    const unit = Number(serial.variant.sellingPriceXaf);
    const clientTxnId = randomUUID();
    const saleResponse = await createSale(
      jsonRequest("http://localhost/api/sales", "POST", {
        clientTxnId,
        kind: "IMMEDIATE",
        items: [
          {
            variantId: serial.variantId,
            quantity: 1,
            productSerialId: serial.id,
          },
        ],
        payments: [
          {
            method: "CASH",
            amountXaf: unit,
            idempotencyKey: `receipt-ser-${clientTxnId}`,
          },
        ],
      }),
    );
    expect(saleResponse.status).toBe(201);
    const salePayload = (await saleResponse.json()) as {
      data: {
        sale: {
          id: string;
          totalXaf: string;
          items: Array<{ id: string }>;
        };
      };
    };
    const saleId = salePayload.data.sale.id;
    const saleItemId = salePayload.data.sale.items[0]!.id;
    const imei1 = serial.imei1!;

    const before = await getReceipt(
      new NextRequest(`http://localhost/api/receipts/${saleId}`),
      params(saleId),
    );
    const beforePayload = (await before.json()) as {
      data: { document: { blocks: unknown[] } };
    };
    expect(JSON.stringify(beforePayload.data.document.blocks)).toContain(imei1);

    await attachSession("caisse@dubai-phone.local");
    const created = await createReturn(
      jsonRequest("http://localhost/api/returns", "POST", {
        saleId,
        reason: "Receipt snapshot reprint test",
        items: [
          {
            saleItemId,
            quantity: 1,
            productSerialId: serial.id,
          },
        ],
      }),
    );
    expect(created.status).toBe(201);
    const createdPayload = (await created.json()) as { data: { id: string } };
    const returnId = createdPayload.data.id;

    await attachSession("manager@dubai-phone.local");
    await inspectReturn(
      jsonRequest(`http://localhost/api/returns/${returnId}/inspect`, "POST"),
      returnParams(returnId),
    );
    await acceptReturn(
      jsonRequest(`http://localhost/api/returns/${returnId}/accept`, "POST", {
        resolution: "REFUND",
      }),
      returnParams(returnId),
    );
    const refunded = await refundReturn(
      jsonRequest(`http://localhost/api/returns/${returnId}/refund`, "POST", {
        amountXaf: salePayload.data.sale.totalXaf,
        method: "CASH",
        idempotencyKey: `receipt-refund-${randomUUID()}`,
      }),
      returnParams(returnId),
    );
    expect(refunded.status).toBe(200);

    const after = await getReceipt(
      new NextRequest(`http://localhost/api/receipts/${saleId}`),
      params(saleId),
    );
    expect(after.status).toBe(200);
    const afterPayload = (await after.json()) as {
      data: {
        saleStatus: string;
        document: { blocks: unknown[] };
      };
    };
    const blob = JSON.stringify(afterPayload.data.document.blocks);
    expect(blob).toContain(imei1);
    expect(blob).toMatch(/RETOURN/);
    expect(afterPayload.data.saleStatus).toBe("RETURNED");
  });

  it("returns 404 for missing or draft-like receipt access", async () => {
    await attachSession("caisse@dubai-phone.local");
    const response = await getReceipt(
      new NextRequest(
        "http://localhost/api/receipts/00000000-0000-4000-8000-000000000099",
      ),
      params("00000000-0000-4000-8000-000000000099"),
    );
    expect(response.status).toBe(404);
  });

  it("rejects unauthenticated receipt access", async () => {
    cookieJar.token = undefined;
    const response = await getReceipt(
      new NextRequest(
        "http://localhost/api/receipts/00000000-0000-4000-8000-000000000099",
      ),
      params("00000000-0000-4000-8000-000000000099"),
    );
    expect(response.status).toBe(401);
  });
});
