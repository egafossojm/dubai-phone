import { describe, expect, it } from "vitest";
import { validateOfflineSalePayload } from "@/lib/offline/validate-sale";
import type { OfflineCatalogItem, OfflineSerial } from "@/lib/offline/types";

const catalog: OfflineCatalogItem[] = [
  {
    variantId: "22222222-2222-4222-8222-222222222222",
    sku: "CABLE-USB",
    name: "Câble USB",
    sellingPriceXaf: "3500",
    sellingPriceLabel: "3 500 FCFA",
    isSerialized: false,
    quantityAvailable: 2,
  },
  {
    variantId: "33333333-3333-4333-8333-333333333333",
    sku: "PHONE-A",
    name: "Phone A",
    sellingPriceXaf: "100000",
    sellingPriceLabel: "100 000 FCFA",
    isSerialized: true,
    quantityAvailable: 0,
  },
];

const serials: OfflineSerial[] = [
  {
    id: "44444444-4444-4444-8444-444444444444",
    variantId: "33333333-3333-4333-8333-333333333333",
    imei1: "350000000000099",
    serialNumber: "SN-99",
    status: "IN_STOCK",
  },
];

const ctx = { catalog, serials, minDownPaymentBps: 1000 };

describe("validateOfflineSalePayload", () => {
  it("rejects installment sale without customer", () => {
    const message = validateOfflineSalePayload(
      {
        clientTxnId: "11111111-1111-4111-8111-111111111111",
        kind: "INSTALLMENT",
        items: [{ variantId: catalog[0].variantId, quantity: 1 }],
        payments: [
          {
            method: "CASH",
            amountXaf: "1000",
            idempotencyKey: "pay-test-key-002",
          },
        ],
        installmentPlan: {
          installmentCount: 3,
          intervalDays: 30,
        },
      },
      ctx,
    );
    expect(message).toContain("client");
  });

  it("rejects momo without operator reference", () => {
    const message = validateOfflineSalePayload(
      {
        clientTxnId: "11111111-1111-4111-8111-111111111111",
        kind: "IMMEDIATE",
        items: [{ variantId: catalog[0].variantId, quantity: 1 }],
        payments: [
          {
            method: "ORANGE_MONEY",
            amountXaf: "3500",
            idempotencyKey: "pay-test-key-003",
          },
        ],
      },
      ctx,
    );
    expect(message).toContain("référence opérateur");
  });

  it("accepts a balanced immediate sale", () => {
    expect(
      validateOfflineSalePayload(
        {
          clientTxnId: "11111111-1111-4111-8111-111111111111",
          kind: "IMMEDIATE",
          items: [{ variantId: catalog[0].variantId, quantity: 1 }],
          payments: [
            {
              method: "CASH",
              amountXaf: "3500",
              idempotencyKey: "pay-test-key-004",
            },
          ],
        },
        ctx,
      ),
    ).toBeNull();
  });

  it("rejects oversell of non-serialized stock", () => {
    const message = validateOfflineSalePayload(
      {
        clientTxnId: "11111111-1111-4111-8111-111111111111",
        kind: "IMMEDIATE",
        items: [{ variantId: catalog[0].variantId, quantity: 3 }],
        payments: [
          {
            method: "CASH",
            amountXaf: "10500",
            idempotencyKey: "pay-test-key-005",
          },
        ],
      },
      ctx,
    );
    expect(message).toContain("Stock insuffisant");
  });

  it("rejects serial already reserved in another outbox row", () => {
    const message = validateOfflineSalePayload(
      {
        clientTxnId: "11111111-1111-4111-8111-111111111111",
        kind: "IMMEDIATE",
        items: [
          {
            variantId: catalog[1].variantId,
            quantity: 1,
            productSerialId: serials[0].id,
          },
        ],
        payments: [
          {
            method: "CASH",
            amountXaf: "100000",
            idempotencyKey: "pay-test-key-006",
          },
        ],
      },
      { ...ctx, reservedSerialIds: new Set([serials[0].id]) },
    );
    expect(message).toContain("déjà réservé");
  });

  it("accepts serialized sale when serial is in stock", () => {
    expect(
      validateOfflineSalePayload(
        {
          clientTxnId: "11111111-1111-4111-8111-111111111111",
          kind: "IMMEDIATE",
          items: [
            {
              variantId: catalog[1].variantId,
              quantity: 1,
              productSerialId: serials[0].id,
            },
          ],
          payments: [
            {
              method: "CASH",
              amountXaf: "100000",
              idempotencyKey: "pay-test-key-007",
            },
          ],
        },
        ctx,
      ),
    ).toBeNull();
  });
});
