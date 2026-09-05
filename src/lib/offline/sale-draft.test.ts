import { describe, expect, it } from "vitest";
import { normalizeMoneyInput } from "@/lib/money";
import {
  buildOfflineSalePayload,
  sumPaymentLineDrafts,
} from "@/lib/offline/sale-draft";

describe("sale draft builder", () => {
  it("normalizes localized payment amounts in payload", () => {
    const payload = buildOfflineSalePayload({
      clientTxnId: "11111111-1111-4111-8111-111111111111",
      kind: "IMMEDIATE",
      customerId: null,
      globalDiscount: "0",
      cart: [
        {
          variantId: "22222222-2222-4222-8222-222222222222",
          quantity: 1,
          discountXaf: 0,
        },
      ],
      payments: [
        {
          method: "CASH",
          amountXaf: "8 000",
          operatorReference: "",
          idempotencyKey: "pay-test-key-001",
        },
      ],
      installmentCount: "3",
      intervalDays: "30",
      firstDueDate: "",
    });
    expect(payload.payments[0]?.amountXaf).toBe("8000");
    expect(sumPaymentLineDrafts([{ method: "CASH", amountXaf: "8 000", operatorReference: "", idempotencyKey: "x" }])).toBe(
      BigInt(8000),
    );
    expect(normalizeMoneyInput("2 500")).toBe("2500");
  });
});
