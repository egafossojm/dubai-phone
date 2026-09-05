import { describe, expect, it } from "vitest";
import {
  formatReceiptDateTime,
  receiptPaymentMethodLabel,
  receiptReturnWatermark,
  receiptSalePlanLabel,
  sanitizeDocumentFilename,
} from "@/modules/receipts/domain/policies";
import { buildReceiptDocument } from "@/modules/receipts/application/build-document";
import { renderDocumentHtml, renderDocumentPdf } from "@/lib/documents";

describe("receipt labels", () => {
  it("maps payment methods via shared credit labels", () => {
    expect(receiptPaymentMethodLabel("CASH")).toBe("Espèces");
    expect(receiptPaymentMethodLabel("ORANGE_MONEY")).toBe("Orange Money");
    expect(receiptPaymentMethodLabel("MTN_MOBILE_MONEY")).toBe(
      "MTN Mobile Money",
    );
  });

  it("labels installment plan in French", () => {
    expect(receiptSalePlanLabel("INSTALLMENT")).toBe(
      "Paiement en plusieurs fois",
    );
    expect(receiptSalePlanLabel("IMMEDIATE")).toBe("Paiement comptant");
  });

  it("formats Douala wall-clock datetimes", () => {
    const label = formatReceiptDateTime(new Date("2026-09-05T09:00:00.000Z"));
    expect(label).toMatch(/05\/09\/2026/);
  });

  it("sanitizes filenames and return watermarks", () => {
    expect(sanitizeDocumentFilename("recu-R-2026-0001")).toBe(
      "recu-R-2026-0001",
    );
    expect(sanitizeDocumentFilename('recu-"evil".pdf')).toBe("recu-evil-.pdf");
    expect(receiptReturnWatermark("RETURNED")).toMatch(/RETOURN/);
    expect(receiptReturnWatermark("COMPLETED")).toBeNull();
  });
});

describe("receipt document rendering", () => {
  const input = {
    receiptReference: "R-2026-000042",
    saleReference: "V-2026-000010",
    saleKind: "IMMEDIATE" as const,
    completedAt: new Date("2026-09-05T09:00:00.000Z"),
    cashierName: "Amina Caisse",
    customer: { fullName: "Jean Client", phone: "690000000" },
    store: {
      name: "Dubai Phone",
      address: "Marché central",
      city: "Douala",
      country: "CM",
      phone: "+237 600 000 000",
      email: "contact@dubai-phone.local",
    },
    subtotalXaf: BigInt(100_000),
    lineDiscountTotalXaf: BigInt(5_000),
    globalDiscountXaf: BigInt(2_000),
    totalXaf: BigInt(93_000),
    credit: null,
    lines: [
      {
        name: "Samsung A15 — Noir",
        sku: "SAM-A15-BLK",
        quantity: 1,
        unitPriceXaf: BigInt(100_000),
        discountXaf: BigInt(5_000),
        lineTotalXaf: BigInt(95_000),
        serial: {
          imei1: "356938035643809",
          imei2: "356938035643817",
          serialNumber: "SN-A15-1",
        },
        warranty: {
          reference: "W-2026-000001",
          startsAt: new Date("2026-09-05T09:00:00.000Z"),
          endsAt: new Date("2027-09-05T09:00:00.000Z"),
        },
      },
    ],
    payments: [
      {
        method: "CASH",
        amountXaf: BigInt(93_000),
        operatorReference: null,
      },
    ],
    overlayStatus: "RETURNED",
  };

  it("separates line vs global remises and keeps IMEI + watermark", () => {
    const doc = buildReceiptDocument(input);
    const blob = JSON.stringify(doc.blocks);
    expect(blob).toContain("Remises lignes");
    expect(blob).toContain("Remise globale");
    expect(blob).toContain("IMEI 1");
    expect(blob).toContain("IMEI 2");
    expect(blob).toContain("RETOURN");
    expect(doc.filename).toBe("recu-R-2026-000042");
  });

  it("renders HTML and multi-page-capable PDF from the same document spec", async () => {
    const doc = buildReceiptDocument(input);
    const html = renderDocumentHtml(doc);
    expect(html).toContain("R-2026-000042");
    expect(html).toContain("Espèces");
    expect(html).toContain("white-space: pre-line");

    const pdf = await renderDocumentPdf(doc);
    expect(pdf.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(500);
  });
});
