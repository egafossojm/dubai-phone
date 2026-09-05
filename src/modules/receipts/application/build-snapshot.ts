import type { Prisma } from "@prisma/client";
import type { ReceiptSnapshotV1 } from "@/modules/receipts/domain/snapshot";

type Tx = Prisma.TransactionClient;

const STORE_KEYS = [
  "store.name",
  "store.address",
  "store.city",
  "store.country",
  "store.phone",
  "store.email",
] as const;

async function loadStoreForSnapshot(tx: Tx) {
  const rows = await tx.storeSetting.findMany({
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

/**
 * Build immutable receipt snapshot inside CompleteSale transaction
 * (after sale items, payments, warranties, optional credit exist).
 */
export async function buildReceiptSnapshotInTx(
  tx: Tx,
  input: {
    receiptReference: string;
    saleId: string;
    saleReference: string;
    saleKind: string;
    completedAt: Date;
    cashierName: string;
    customer: { fullName: string; phone: string } | null;
    subtotalXaf: bigint;
    lineDiscountTotalXaf: bigint;
    globalDiscountXaf: bigint;
    totalXaf: bigint;
    credit: { reference: string; remainingXaf: bigint } | null;
  },
): Promise<ReceiptSnapshotV1> {
  const [store, items, payments] = await Promise.all([
    loadStoreForSnapshot(tx),
    tx.saleItem.findMany({
      where: { saleId: input.saleId },
      orderBy: { id: "asc" },
      select: {
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
          },
        },
      },
    }),
    tx.payment.findMany({
      where: { saleId: input.saleId },
      orderBy: { paidAt: "asc" },
      select: {
        method: true,
        amountXaf: true,
        operatorReference: true,
      },
    }),
  ]);

  return {
    version: 1,
    store,
    receiptReference: input.receiptReference,
    saleReference: input.saleReference,
    saleKind: input.saleKind,
    completedAt: input.completedAt.toISOString(),
    cashierName: input.cashierName,
    customer: input.customer,
    subtotalXaf: input.subtotalXaf.toString(),
    lineDiscountTotalXaf: input.lineDiscountTotalXaf.toString(),
    globalDiscountXaf: input.globalDiscountXaf.toString(),
    totalXaf: input.totalXaf.toString(),
    credit: input.credit
      ? {
          reference: input.credit.reference,
          remainingXaf: input.credit.remainingXaf.toString(),
        }
      : null,
    lines: items.map((item) => ({
      name: `${item.variant.product.name} — ${item.variant.name}`,
      sku: item.variant.sku,
      quantity: item.quantity,
      unitPriceXaf: item.unitPriceXaf.toString(),
      discountXaf: item.discountXaf.toString(),
      lineTotalXaf: item.lineTotalXaf.toString(),
      serial: item.serial,
      warranty: item.warranties[0]
        ? {
            reference: item.warranties[0].reference,
            startsAt: item.warranties[0].startsAt.toISOString(),
            endsAt: item.warranties[0].endsAt.toISOString(),
          }
        : null,
    })),
    payments: payments.map((payment) => ({
      method: payment.method,
      amountXaf: payment.amountXaf.toString(),
      operatorReference: payment.operatorReference,
    })),
  };
}
