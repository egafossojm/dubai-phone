import type { NumberDocumentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type Tx = Prisma.TransactionClient;

type ExistsFn = (tx: Tx, reference: string) => Promise<boolean>;

const EXISTS_BY_TYPE: Partial<Record<NumberDocumentType, ExistsFn>> = {
  PURCHASE_ORDER: async (tx, reference) =>
    Boolean(await tx.purchaseOrder.findUnique({ where: { reference }, select: { id: true } })),
  GOODS_RECEIPT: async (tx, reference) =>
    Boolean(await tx.goodsReceipt.findUnique({ where: { reference }, select: { id: true } })),
  SALE: async (tx, reference) =>
    Boolean(await tx.sale.findUnique({ where: { reference }, select: { id: true } })),
  RECEIPT: async (tx, reference) =>
    Boolean(await tx.receipt.findUnique({ where: { reference }, select: { id: true } })),
  CREDIT: async (tx, reference) =>
    Boolean(await tx.customerCredit.findUnique({ where: { reference }, select: { id: true } })),
  WARRANTY: async (tx, reference) =>
    Boolean(await tx.warranty.findUnique({ where: { reference }, select: { id: true } })),
};

/**
 * Allocates the next business reference (e.g. PO-2026-000001) atomically.
 * Skips values already used (e.g. seed data ahead of the sequence counter).
 */
export async function allocateDocumentReference(
  documentType: NumberDocumentType,
  options?: { tx?: Tx; year?: number },
): Promise<string> {
  const year = options?.year ?? new Date().getFullYear();
  const run = async (tx: Tx) => {
    let sequence = await tx.numberSequence.findUnique({
      where: {
        documentType_year: { documentType, year },
      },
    });

    if (!sequence) {
      sequence = await tx.numberSequence.create({
        data: {
          documentType,
          year,
          prefix: defaultPrefix(documentType),
          currentValue: 0,
        },
      });
    }

    const exists = EXISTS_BY_TYPE[documentType];
    for (let attempt = 0; attempt < 50; attempt += 1) {
      sequence = await tx.numberSequence.update({
        where: { id: sequence.id },
        data: { currentValue: { increment: 1 } },
      });
      const reference = formatReference(sequence.prefix, year, sequence.currentValue);
      if (!exists || !(await exists(tx, reference))) {
        return reference;
      }
    }

    throw new Error(`Impossible d'allouer une référence pour ${documentType}.`);
  };

  if (options?.tx) {
    return run(options.tx);
  }
  return prisma.$transaction(run);
}

function defaultPrefix(documentType: NumberDocumentType): string {
  switch (documentType) {
    case "PURCHASE_ORDER":
      return "PO";
    case "GOODS_RECEIPT":
      return "GR";
    case "SALE":
      return "VTE";
    case "RECEIPT":
      return "RC";
    case "RETURN":
      return "RET";
    case "WARRANTY":
      return "GAR";
    case "CREDIT":
      return "CR";
    default:
      return "DOC";
  }
}

function formatReference(prefix: string, year: number, value: number): string {
  return `${prefix}-${year}-${String(value).padStart(6, "0")}`;
}
