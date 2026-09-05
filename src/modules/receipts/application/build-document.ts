import { formatXaf } from "@/lib/money";
import type { DocumentSpec } from "@/lib/documents/types";
import {
  formatReceiptDateTime,
  formatWarrantyPeriod,
  receiptPaymentMethodLabel,
  receiptReturnWatermark,
  receiptSalePlanLabel,
  sanitizeDocumentFilename,
} from "@/modules/receipts/domain/policies";
import type { ReceiptSnapshotV1 } from "@/modules/receipts/domain/snapshot";

export type ReceiptStoreInfo = {
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
};

export type ReceiptLineInput = {
  name: string;
  sku: string;
  quantity: number;
  unitPriceXaf: bigint;
  discountXaf: bigint;
  lineTotalXaf: bigint;
  serial: {
    imei1: string | null;
    imei2: string | null;
    serialNumber: string | null;
  } | null;
  warranty: {
    reference: string;
    startsAt: Date;
    endsAt: Date;
  } | null;
};

export type ReceiptDocumentInput = {
  receiptReference: string;
  saleReference: string;
  saleKind: string;
  completedAt: Date;
  cashierName: string;
  customer: { fullName: string; phone: string } | null;
  store: ReceiptStoreInfo;
  subtotalXaf: bigint;
  /** Line discounts only (shown in column; not repeated as full footer total). */
  lineDiscountTotalXaf: bigint;
  /** Sale-scope discount only. */
  globalDiscountXaf: bigint;
  totalXaf: bigint;
  credit: { reference: string; remainingXaf: bigint } | null;
  lines: ReceiptLineInput[];
  payments: Array<{
    method: string;
    amountXaf: bigint;
    operatorReference: string | null;
  }>;
  /** Live sale status for watermark only — does not alter line content. */
  overlayStatus?: string;
};

export function snapshotToDocumentInput(
  snapshot: ReceiptSnapshotV1,
  overlayStatus?: string,
): ReceiptDocumentInput {
  return {
    receiptReference: snapshot.receiptReference,
    saleReference: snapshot.saleReference,
    saleKind: snapshot.saleKind,
    completedAt: new Date(snapshot.completedAt),
    cashierName: snapshot.cashierName,
    customer: snapshot.customer,
    store: snapshot.store,
    subtotalXaf: BigInt(snapshot.subtotalXaf),
    lineDiscountTotalXaf: BigInt(snapshot.lineDiscountTotalXaf),
    globalDiscountXaf: BigInt(snapshot.globalDiscountXaf),
    totalXaf: BigInt(snapshot.totalXaf),
    credit: snapshot.credit
      ? {
          reference: snapshot.credit.reference,
          remainingXaf: BigInt(snapshot.credit.remainingXaf),
        }
      : null,
    lines: snapshot.lines.map((line) => ({
      name: line.name,
      sku: line.sku,
      quantity: line.quantity,
      unitPriceXaf: BigInt(line.unitPriceXaf),
      discountXaf: BigInt(line.discountXaf),
      lineTotalXaf: BigInt(line.lineTotalXaf),
      serial: line.serial,
      warranty: line.warranty
        ? {
            reference: line.warranty.reference,
            startsAt: new Date(line.warranty.startsAt),
            endsAt: new Date(line.warranty.endsAt),
          }
        : null,
    })),
    payments: snapshot.payments.map((payment) => ({
      method: payment.method,
      amountXaf: BigInt(payment.amountXaf),
      operatorReference: payment.operatorReference,
    })),
    overlayStatus,
  };
}

export function buildReceiptDocument(
  input: ReceiptDocumentInput,
): DocumentSpec {
  const blocks: DocumentSpec["blocks"] = [
    { type: "title", text: input.store.name },
  ];

  const watermark = input.overlayStatus
    ? receiptReturnWatermark(input.overlayStatus)
    : null;
  if (watermark) {
    blocks.push({ type: "subtitle", text: watermark });
  }

  if (input.store.address) {
    blocks.push({ type: "muted", text: input.store.address });
  }
  const cityLine = [input.store.city, input.store.country]
    .filter(Boolean)
    .join(", ");
  if (cityLine) {
    blocks.push({ type: "muted", text: cityLine });
  }
  if (input.store.phone) {
    blocks.push({ type: "muted", text: `Tél. ${input.store.phone}` });
  }
  if (input.store.email) {
    blocks.push({ type: "muted", text: input.store.email });
  }

  blocks.push(
    { type: "spacer", size: "sm" },
    { type: "subtitle", text: "Reçu de vente" },
    { type: "kv", label: "N° reçu", value: input.receiptReference },
    { type: "kv", label: "Vente", value: input.saleReference },
    {
      type: "kv",
      label: "Date",
      value: formatReceiptDateTime(input.completedAt),
    },
    { type: "kv", label: "Caissier", value: input.cashierName },
  );

  if (input.customer) {
    blocks.push({
      type: "kv",
      label: "Client",
      value: `${input.customer.fullName} · ${input.customer.phone}`,
    });
  }

  blocks.push(
    { type: "kv", label: "Mode", value: receiptSalePlanLabel(input.saleKind) },
  );

  if (input.credit) {
    blocks.push({
      type: "kv",
      label: "Crédit",
      value: `${input.credit.reference} · reste ${formatXaf(input.credit.remainingXaf)}`,
    });
  }

  blocks.push({ type: "rule" });

  const tableRows: Array<Record<string, string>> = [];
  for (const line of input.lines) {
    tableRows.push({
      article: `${line.name}\n${line.sku}`,
      qty: String(line.quantity),
      unit: formatXaf(line.unitPriceXaf),
      disc:
        line.discountXaf > BigInt(0) ? formatXaf(line.discountXaf) : "—",
      total: formatXaf(line.lineTotalXaf),
    });
    if (line.serial) {
      const serialBits = [
        line.serial.imei1 ? `IMEI 1 : ${line.serial.imei1}` : null,
        line.serial.imei2 ? `IMEI 2 : ${line.serial.imei2}` : null,
        line.serial.serialNumber
          ? `N° série : ${line.serial.serialNumber}`
          : null,
      ].filter(Boolean);
      if (serialBits.length > 0) {
        tableRows.push({
          article: serialBits.join(" · "),
          qty: "",
          unit: "",
          disc: "",
          total: "",
        });
      }
    }
    if (line.warranty) {
      tableRows.push({
        article: `Garantie ${line.warranty.reference} · ${formatWarrantyPeriod(line.warranty.startsAt, line.warranty.endsAt)}`,
        qty: "",
        unit: "",
        disc: "",
        total: "",
      });
    }
  }

  blocks.push({
    type: "table",
    columns: [
      { key: "article", header: "Article", align: "left" },
      { key: "qty", header: "Qté", align: "right" },
      { key: "unit", header: "P.U.", align: "right" },
      { key: "disc", header: "Remise", align: "right" },
      { key: "total", header: "Total", align: "right" },
    ],
    rows: tableRows,
  });

  blocks.push({ type: "rule" });
  if (
    input.lineDiscountTotalXaf > BigInt(0) ||
    input.globalDiscountXaf > BigInt(0)
  ) {
    blocks.push({
      type: "kv",
      label: "Sous-total",
      value: formatXaf(input.subtotalXaf),
    });
    if (input.lineDiscountTotalXaf > BigInt(0)) {
      blocks.push({
        type: "kv",
        label: "Remises lignes",
        value: formatXaf(input.lineDiscountTotalXaf),
      });
    }
    if (input.globalDiscountXaf > BigInt(0)) {
      blocks.push({
        type: "kv",
        label: "Remise globale",
        value: formatXaf(input.globalDiscountXaf),
      });
    }
  }
  blocks.push({
    type: "total",
    label: "Total TTC",
    value: formatXaf(input.totalXaf),
  });

  blocks.push(
    { type: "spacer", size: "sm" },
    { type: "subtitle", text: "Paiements" },
  );
  for (const payment of input.payments) {
    const label = receiptPaymentMethodLabel(payment.method);
    const extra = payment.operatorReference
      ? ` (${payment.operatorReference})`
      : "";
    blocks.push({
      type: "kv",
      label: `${label}${extra}`,
      value: formatXaf(payment.amountXaf),
    });
  }

  blocks.push(
    { type: "spacer", size: "md" },
    {
      type: "muted",
      text: "Merci de votre confiance — Dubai Phone",
    },
  );

  const safeName = sanitizeDocumentFilename(
    `recu-${input.receiptReference}`,
  );

  return {
    title: `Reçu ${input.receiptReference}`,
    filename: safeName,
    blocks,
  };
}
