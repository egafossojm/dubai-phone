import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { writeAudit } from "@/lib/audit/write-audit";
import type { AuthUser } from "@/lib/auth/session";
import {
  buildReceiptDocument,
  snapshotToDocumentInput,
  type ReceiptDocumentInput,
  type ReceiptStoreInfo,
} from "@/modules/receipts/application/build-document";
import { renderDocumentHtml, renderDocumentPdf } from "@/lib/documents";
import { isReceiptSnapshotV1 } from "@/modules/receipts/domain/snapshot";
import { sanitizeDocumentFilename } from "@/modules/receipts/domain/policies";

const STORE_KEYS = [
  "store.name",
  "store.address",
  "store.city",
  "store.country",
  "store.phone",
  "store.email",
] as const;

async function loadStoreInfo(): Promise<ReceiptStoreInfo> {
  const rows = await prisma.storeSetting.findMany({
    where: { key: { in: [...STORE_KEYS] } },
    select: { key: true, value: true },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    name: map.get("store.name") ?? "Dubai Phone",
    address: map.get("store.address") ?? null,
    city: map.get("store.city") ?? null,
    country: map.get("store.country") ?? null,
    phone: map.get("store.phone") ?? null,
    email: map.get("store.email") ?? null,
  };
}

async function loadSaleForReceipt(saleId: string) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      reference: true,
      kind: true,
      status: true,
      subtotalXaf: true,
      discountTotalXaf: true,
      totalXaf: true,
      completedAt: true,
      customer: { select: { fullName: true, phone: true } },
      soldBy: { select: { fullName: true } },
      credit: {
        select: { reference: true, remainingXaf: true },
      },
      receipt: {
        select: {
          id: true,
          reference: true,
          printedAt: true,
          snapshotJson: true,
        },
      },
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          quantity: true,
          unitPriceXaf: true,
          discountXaf: true,
          lineTotalXaf: true,
          variant: {
            select: {
              sku: true,
              name: true,
              product: { select: { name: true } },
            },
          },
          serial: {
            select: {
              imei1: true,
              imei2: true,
              serialNumber: true,
            },
          },
          warranties: {
            orderBy: { startsAt: "desc" },
            take: 1,
            select: {
              reference: true,
              startsAt: true,
              endsAt: true,
              productSerial: {
                select: {
                  imei1: true,
                  imei2: true,
                  serialNumber: true,
                },
              },
            },
          },
        },
      },
      payments: {
        orderBy: { paidAt: "asc" },
        select: {
          method: true,
          amountXaf: true,
          operatorReference: true,
        },
      },
      discounts: {
        where: { scope: "SALE" },
        select: { amountXaf: true },
      },
    },
  });

  if (!sale || !sale.receipt || !sale.completedAt) {
    throw new AppError("NOT_FOUND", "Reçu introuvable.");
  }
  if (sale.status === "DRAFT" || sale.status === "CANCELLED") {
    throw new AppError("NOT_FOUND", "Reçu introuvable.");
  }

  return sale;
}

function buildLiveFallbackInput(
  sale: Awaited<ReturnType<typeof loadSaleForReceipt>>,
  store: ReceiptStoreInfo,
): ReceiptDocumentInput {
  const lineDiscountTotalXaf = sale.items.reduce(
    (sum, item) => sum + item.discountXaf,
    BigInt(0),
  );
  const globalDiscountXaf = sale.discounts.reduce(
    (sum, row) => sum + row.amountXaf,
    BigInt(0),
  );

  return {
    receiptReference: sale.receipt!.reference,
    saleReference: sale.reference,
    saleKind: sale.kind,
    completedAt: sale.completedAt!,
    cashierName: sale.soldBy.fullName,
    customer: sale.customer,
    store,
    subtotalXaf: sale.subtotalXaf,
    lineDiscountTotalXaf,
    globalDiscountXaf,
    totalXaf: sale.totalXaf,
    credit: sale.credit
      ? {
          reference: sale.credit.reference,
          remainingXaf: sale.credit.remainingXaf,
        }
      : null,
    lines: sale.items.map((item) => {
      const serial =
        item.serial ??
        item.warranties[0]?.productSerial ??
        null;
      return {
        name: `${item.variant.product.name} — ${item.variant.name}`,
        sku: item.variant.sku,
        quantity: item.quantity,
        unitPriceXaf: item.unitPriceXaf,
        discountXaf: item.discountXaf,
        lineTotalXaf: item.lineTotalXaf,
        serial,
        warranty: item.warranties[0]
          ? {
              reference: item.warranties[0].reference,
              startsAt: item.warranties[0].startsAt,
              endsAt: item.warranties[0].endsAt,
            }
          : null,
      };
    }),
    payments: sale.payments,
    overlayStatus: sale.status,
  };
}

export async function getReceiptBySaleIdUseCase(saleId: string) {
  const sale = await loadSaleForReceipt(saleId);
  const snapshot = sale.receipt!.snapshotJson;

  let documentInput: ReceiptDocumentInput;
  if (isReceiptSnapshotV1(snapshot)) {
    documentInput = snapshotToDocumentInput(snapshot, sale.status);
  } else {
    const store = await loadStoreInfo();
    documentInput = buildLiveFallbackInput(sale, store);
  }

  const document = buildReceiptDocument(documentInput);

  return {
    saleId: sale.id,
    receiptId: sale.receipt!.id,
    receiptReference: sale.receipt!.reference,
    saleReference: sale.reference,
    saleStatus: sale.status,
    printedAt: sale.receipt!.printedAt?.toISOString() ?? null,
    fromSnapshot: isReceiptSnapshotV1(snapshot),
    document,
  };
}

export async function getReceiptPdfBySaleIdUseCase(saleId: string) {
  const payload = await getReceiptBySaleIdUseCase(saleId);
  const pdf = await renderDocumentPdf(payload.document);
  const filename = `${sanitizeDocumentFilename(payload.document.filename)}.pdf`;
  return {
    filename,
    buffer: pdf,
    receiptReference: payload.receiptReference,
  };
}

export async function getReceiptHtmlBySaleIdUseCase(saleId: string) {
  const payload = await getReceiptBySaleIdUseCase(saleId);
  const filename = `${sanitizeDocumentFilename(payload.document.filename)}.html`;
  return {
    html: renderDocumentHtml(payload.document),
    filename,
    receiptReference: payload.receiptReference,
  };
}

export async function markReceiptPrintedUseCase(
  user: AuthUser,
  saleId: string,
) {
  const sale = await loadSaleForReceipt(saleId);
  const updated = await prisma.receipt.update({
    where: { id: sale.receipt!.id },
    data: { printedAt: new Date() },
    select: { id: true, reference: true, printedAt: true },
  });
  await writeAudit({
    actorId: user.id,
    action: "receipt.print",
    entityType: "Receipt",
    entityId: updated.id,
    after: {
      saleId,
      receiptReference: updated.reference,
      printedAt: updated.printedAt!.toISOString(),
    },
  });
  return {
    receiptId: updated.id,
    receiptReference: updated.reference,
    printedAt: updated.printedAt!.toISOString(),
  };
}
