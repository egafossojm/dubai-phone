import type { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import type { AuthUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import type { dashboardQuerySchema } from "@/modules/dashboard/api/schemas";
import {
  averageBasketXaf,
  estimateSaleMarginXaf,
  isLowStock,
  netLineAfterReturns,
  resolveDashboardRange,
} from "@/modules/dashboard/domain/policies";
import { toDashboardPayload } from "@/modules/dashboard/application/presenters";

type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

const SALE_STATUSES = ["COMPLETED", "PARTIALLY_RETURNED", "RETURNED"] as const;

async function readLowStockThreshold() {
  const setting = await prisma.storeSetting.findUnique({
    where: { key: "stock.lowStockThreshold" },
    select: { value: true },
  });
  const parsed = Number.parseInt(setting?.value ?? "3", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 3;
}

async function sumPaymentsInRange(from: Date, toExclusive: Date) {
  const result = await prisma.payment.aggregate({
    where: {
      paidAt: { gte: from, lt: toExclusive },
      sale: { status: { in: [...SALE_STATUSES] } },
    },
    _sum: { amountXaf: true },
  });
  return result._sum.amountXaf ?? BigInt(0);
}

async function sumRefundsInRange(from: Date, toExclusive: Date) {
  const result = await prisma.refund.aggregate({
    where: { refundedAt: { gte: from, lt: toExclusive } },
    _sum: { amountXaf: true },
  });
  return result._sum.amountXaf ?? BigInt(0);
}

async function netCashCaInRange(from: Date, toExclusive: Date) {
  const [paid, refunded] = await Promise.all([
    sumPaymentsInRange(from, toExclusive),
    sumRefundsInRange(from, toExclusive),
  ]);
  return paid > refunded ? paid - refunded : BigInt(0);
}

/**
 * Management dashboard — operational metrics for dashboard.read.
 * Full financials require reports.read; salesperson gets own CA only (docs 08).
 */
export async function getDashboardUseCase(
  user: AuthUser,
  query: DashboardQuery,
) {
  const canReadFinancials = hasPermission(user.permissions, "reports.read");
  const canReadOwnCa = !canReadFinancials;
  const range = resolveDashboardRange({
    period: query.period,
    fromYmd: query.from,
    toYmd: query.to,
  });
  const todayRange = resolveDashboardRange({ period: "today" });
  const monthRange = resolveDashboardRange({ period: "month" });
  const lowStockThreshold = await readLowStockThreshold();

  const saleWhere = {
    status: { in: [...SALE_STATUSES] },
    completedAt: { gte: range.from, lt: range.toExclusive },
    ...(canReadOwnCa ? { soldById: user.id } : {}),
  };

  const [salesInPeriod, recentSalesRaw, lowStockVariants] = await Promise.all([
    prisma.sale.findMany({
      where: saleWhere,
      select: {
        id: true,
        reference: true,
        status: true,
        totalXaf: true,
        completedAt: true,
        soldById: true,
        soldBy: { select: { id: true, fullName: true } },
        customer: { select: { fullName: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            lineTotalXaf: true,
            variantId: true,
            variant: {
              select: {
                id: true,
                sku: true,
                name: true,
                ...(canReadFinancials ? { costPriceXaf: true } : {}),
                product: { select: { name: true } },
              },
            },
          },
        },
      },
      // Safety bound — custom ranges capped at 92 days (schemas).
      take: 5_000,
      orderBy: { completedAt: "desc" },
    }),
    prisma.sale.findMany({
      where: saleWhere,
      take: 10,
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        reference: true,
        totalXaf: true,
        completedAt: true,
        soldBy: { select: { fullName: true } },
        customer: { select: { fullName: true } },
      },
    }),
    prisma.productVariant.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        quantityOnHand: { lte: lowStockThreshold },
        product: { deletedAt: null, status: "ACTIVE" },
      },
      take: 20,
      orderBy: { quantityOnHand: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        quantityOnHand: true,
        product: { select: { name: true } },
      },
    }),
  ]);

  const saleIds = salesInPeriod.map((sale) => sale.id);
  const saleItemIds = salesInPeriod.flatMap((sale) =>
    sale.items.map((item) => item.id),
  );

  const [refundRows, returnedRows] = await Promise.all([
    saleIds.length === 0
      ? Promise.resolve([] as Array<{ amountXaf: bigint; saleId: string }>)
      : prisma.refund.findMany({
          where: { returnRecord: { saleId: { in: saleIds } } },
          select: {
            amountXaf: true,
            returnRecord: { select: { saleId: true } },
          },
        }).then((rows) =>
          rows.map((row) => ({
            amountXaf: row.amountXaf,
            saleId: row.returnRecord.saleId,
          })),
        ),
    saleItemIds.length === 0
      ? Promise.resolve([] as Array<{ saleItemId: string; quantity: number }>)
      : prisma.returnItem
          .groupBy({
            by: ["saleItemId"],
            where: {
              saleItemId: { in: saleItemIds },
              returnRecord: { status: "COMPLETED" },
            },
            _sum: { quantity: true },
          })
          .then((rows) =>
            rows.map((row) => ({
              saleItemId: row.saleItemId,
              quantity: row._sum.quantity ?? 0,
            })),
          ),
  ]);

  const refundsBySale = new Map<string, bigint>();
  for (const row of refundRows) {
    refundsBySale.set(
      row.saleId,
      (refundsBySale.get(row.saleId) ?? BigInt(0)) + row.amountXaf,
    );
  }
  const returnedBySaleItem = new Map(
    returnedRows.map((row) => [row.saleItemId, row.quantity]),
  );

  let revenueXaf = BigInt(0);
  let marginXaf = BigInt(0);
  let activeSaleCount = 0;
  const productAgg = new Map<
    string,
    {
      variantId: string;
      sku: string;
      name: string;
      quantity: number;
      revenueXaf: bigint;
    }
  >();
  const sellerAgg = new Map<
    string,
    { userId: string; fullName: string; saleCount: number; revenueXaf: bigint }
  >();

  for (const sale of salesInPeriod) {
    const refundedXaf = refundsBySale.get(sale.id) ?? BigInt(0);
    const netSaleRevenue =
      sale.totalXaf > refundedXaf ? sale.totalXaf - refundedXaf : BigInt(0);

    if (sale.status === "RETURNED" && netSaleRevenue <= BigInt(0)) {
      continue;
    }

    activeSaleCount += 1;
    revenueXaf += netSaleRevenue;

    if (canReadFinancials) {
      marginXaf += estimateSaleMarginXaf({
        saleTotalXaf: sale.totalXaf,
        refundedXaf,
        lines: sale.items.map((item) => ({
          lineTotalXaf: item.lineTotalXaf,
          costPriceXaf: item.variant.costPriceXaf,
          saleQuantity: item.quantity,
          returnedQuantity: returnedBySaleItem.get(item.id) ?? 0,
        })),
      });
    }

    const seller = sellerAgg.get(sale.soldById) ?? {
      userId: sale.soldBy.id,
      fullName: sale.soldBy.fullName,
      saleCount: 0,
      revenueXaf: BigInt(0),
    };
    seller.saleCount += 1;
    seller.revenueXaf += netSaleRevenue;
    sellerAgg.set(sale.soldById, seller);

    for (const item of sale.items) {
      const returnedQty = returnedBySaleItem.get(item.id) ?? 0;
      const { netQuantity, netLineTotalXaf } = netLineAfterReturns({
        lineTotalXaf: item.lineTotalXaf,
        saleQuantity: item.quantity,
        returnedQuantity: returnedQty,
      });
      if (netQuantity <= 0) {
        continue;
      }
      const key = item.variantId;
      const row = productAgg.get(key) ?? {
        variantId: item.variant.id,
        sku: item.variant.sku,
        name: `${item.variant.product.name} — ${item.variant.name}`,
        quantity: 0,
        revenueXaf: BigInt(0),
      };
      row.quantity += netQuantity;
      row.revenueXaf += netLineTotalXaf;
      productAgg.set(key, row);
    }
  }

  const basket = averageBasketXaf({
    revenueXaf,
    saleCount: activeSaleCount,
  });

  const [caToday, caMonth, creditAgg, payments, refundsPeriod, periodCashCa] =
    await Promise.all([
      canReadFinancials
        ? netCashCaInRange(todayRange.from, todayRange.toExclusive)
        : Promise.resolve(BigInt(0)),
      canReadFinancials
        ? netCashCaInRange(monthRange.from, monthRange.toExclusive)
        : Promise.resolve(BigInt(0)),
      canReadFinancials
        ? prisma.customerCredit.aggregate({
            // Includes DEFAULTED — outstanding recovery exposure.
            where: { status: { notIn: ["PAID", "CANCELLED"] } },
            _sum: { remainingXaf: true },
          })
        : Promise.resolve({ _sum: { remainingXaf: BigInt(0) } }),
      canReadFinancials
        ? prisma.payment.groupBy({
            by: ["method"],
            where: {
              paidAt: { gte: range.from, lt: range.toExclusive },
              sale: { status: { in: [...SALE_STATUSES] } },
            },
            _sum: { amountXaf: true },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      canReadFinancials
        ? sumRefundsInRange(range.from, range.toExclusive)
        : Promise.resolve(BigInt(0)),
      canReadFinancials
        ? netCashCaInRange(range.from, range.toExclusive)
        : Promise.resolve(revenueXaf),
    ]);

  const topProducts = [...productAgg.values()]
    .sort((a, b) => b.quantity - a.quantity || (a.sku < b.sku ? -1 : 1))
    .slice(0, 10);

  const salesBySeller = [...sellerAgg.values()].sort((a, b) => {
    if (b.saleCount !== a.saleCount) {
      return b.saleCount - a.saleCount;
    }
    if (canReadFinancials) {
      if (b.revenueXaf !== a.revenueXaf) {
        return b.revenueXaf > a.revenueXaf ? 1 : -1;
      }
    }
    return a.fullName.localeCompare(b.fullName, "fr");
  });

  return toDashboardPayload({
    range: {
      from: range.from,
      toExclusive: range.toExclusive,
      label: range.label,
      period: query.period,
    },
    canReadFinancials,
    canReadOwnCa,
    saleCount: activeSaleCount,
    revenueXaf: periodCashCa,
    marginXaf,
    averageBasketXaf: canReadFinancials
      ? averageBasketXaf({
          revenueXaf: periodCashCa,
          saleCount: activeSaleCount,
        })
      : basket,
    caTodayXaf: caToday,
    caMonthXaf: caMonth,
    refundsPeriodXaf: refundsPeriod,
    creditOutstandingXaf: creditAgg._sum.remainingXaf ?? BigInt(0),
    paymentsByMethod: payments.map((row) => ({
      method: row.method,
      amountXaf: row._sum.amountXaf ?? BigInt(0),
      count: row._count._all,
    })),
    lowStock: lowStockVariants
      .filter((row) => isLowStock(row.quantityOnHand, lowStockThreshold))
      .map((row) => ({
        variantId: row.id,
        sku: row.sku,
        name: `${row.product.name} — ${row.name}`,
        quantityOnHand: row.quantityOnHand,
      })),
    topProducts,
    salesBySeller,
    recentSales: recentSalesRaw.map((sale) => ({
      id: sale.id,
      reference: sale.reference,
      totalXaf: sale.totalXaf,
      completedAt: sale.completedAt,
      soldByName: sale.soldBy.fullName,
      customerName: sale.customer?.fullName ?? null,
    })),
    lowStockThreshold,
    ownCa: canReadOwnCa
      ? {
          saleCount: activeSaleCount,
          revenueXaf,
          averageBasketXaf: basket,
        }
      : null,
  });
}
