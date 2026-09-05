import { prisma } from "@/lib/db/prisma";
import { formatXaf } from "@/lib/money";
import { SNAPSHOT_LIMITS } from "@/lib/offline/constants";

/**
 * Snapshot for offline POS cache (catalog + customers + sellable serials).
 */
export async function getSyncSnapshotUseCase() {
  const catalogLimit = SNAPSHOT_LIMITS.catalog + 1;
  const customerLimit = SNAPSHOT_LIMITS.customers + 1;
  const serialLimit = SNAPSHOT_LIMITS.serials + 1;

  const [variants, customers, serials, minDownSetting] = await Promise.all([
    prisma.productVariant.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        product: { deletedAt: null, status: "ACTIVE" },
      },
      include: {
        product: { select: { name: true, isSerialized: true } },
      },
      orderBy: { sku: "asc" },
      take: catalogLimit,
    }),
    prisma.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, fullName: true, phone: true },
      orderBy: { fullName: "asc" },
      take: customerLimit,
    }),
    prisma.productSerial.findMany({
      where: { status: "IN_STOCK" },
      select: {
        id: true,
        variantId: true,
        imei1: true,
        serialNumber: true,
        status: true,
      },
      take: serialLimit,
    }),
    prisma.storeSetting.findUnique({
      where: { key: "credit.minDownPaymentBps" },
      select: { value: true },
    }),
  ]);

  const catalogTruncated = variants.length > SNAPSHOT_LIMITS.catalog;
  const customersTruncated = customers.length > SNAPSHOT_LIMITS.customers;
  const serialsTruncated = serials.length > SNAPSHOT_LIMITS.serials;

  const minDownPaymentBps = Number.parseInt(
    minDownSetting?.value ?? "1000",
    10,
  );

  return {
    fetchedAt: new Date().toISOString(),
    minDownPaymentBps: Number.isFinite(minDownPaymentBps)
      ? minDownPaymentBps
      : 1000,
    catalogTruncated,
    customersTruncated,
    serialsTruncated,
    catalog: variants.slice(0, SNAPSHOT_LIMITS.catalog).map((row) => ({
      variantId: row.id,
      sku: row.sku,
      name: `${row.product.name} — ${row.name}`,
      sellingPriceXaf: row.sellingPriceXaf.toString(),
      sellingPriceLabel: formatXaf(row.sellingPriceXaf),
      isSerialized: row.product.isSerialized,
      quantityAvailable: row.product.isSerialized ? 0 : row.quantityOnHand,
    })),
    customers: customers.slice(0, SNAPSHOT_LIMITS.customers),
    serials: serials.slice(0, SNAPSHOT_LIMITS.serials),
  };
}
