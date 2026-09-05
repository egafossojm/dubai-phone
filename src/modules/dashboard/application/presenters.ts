import { formatXaf } from "@/lib/money";
import { paymentMethodLabel } from "@/modules/credit/domain/policies";

export function toDashboardPayload(input: {
  range: { from: Date; toExclusive: Date; label: string; period: string };
  canReadFinancials: boolean;
  /** Salesperson without reports.read: personal CA only (docs 08). */
  canReadOwnCa: boolean;
  saleCount: number;
  revenueXaf: bigint;
  marginXaf: bigint;
  averageBasketXaf: bigint | null;
  caTodayXaf: bigint;
  caMonthXaf: bigint;
  refundsPeriodXaf: bigint;
  creditOutstandingXaf: bigint;
  paymentsByMethod: Array<{ method: string; amountXaf: bigint; count: number }>;
  lowStock: Array<{
    variantId: string;
    sku: string;
    name: string;
    quantityOnHand: number;
  }>;
  topProducts: Array<{
    variantId: string;
    sku: string;
    name: string;
    quantity: number;
    revenueXaf: bigint;
  }>;
  salesBySeller: Array<{
    userId: string;
    fullName: string;
    saleCount: number;
    revenueXaf: bigint;
  }>;
  recentSales: Array<{
    id: string;
    reference: string;
    totalXaf: bigint;
    completedAt: Date | null;
    soldByName: string;
    customerName: string | null;
  }>;
  lowStockThreshold: number;
  ownCa?: {
    saleCount: number;
    revenueXaf: bigint;
    averageBasketXaf: bigint | null;
  } | null;
}) {
  const operational = {
    period: input.range.period,
    periodLabel: input.range.label,
    from: input.range.from.toISOString(),
    toExclusive: input.range.toExclusive.toISOString(),
    saleCount: input.saleCount,
    lowStockThreshold: input.lowStockThreshold,
    lowStock: input.lowStock,
    topProducts: input.topProducts.map((row) => ({
      variantId: row.variantId,
      sku: row.sku,
      name: row.name,
      quantity: row.quantity,
      ...(input.canReadFinancials
        ? {
            revenueXaf: row.revenueXaf.toString(),
            revenueLabel: formatXaf(row.revenueXaf),
          }
        : {}),
    })),
    salesBySeller: input.salesBySeller.map((row) => ({
      userId: row.userId,
      fullName: row.fullName,
      saleCount: row.saleCount,
      ...(input.canReadFinancials
        ? {
            revenueXaf: row.revenueXaf.toString(),
            revenueLabel: formatXaf(row.revenueXaf),
          }
        : {}),
    })),
    recentSales: input.recentSales.map((row) => ({
      id: row.id,
      reference: row.reference,
      completedAt: row.completedAt?.toISOString() ?? null,
      soldByName: row.soldByName,
      customerName: row.customerName,
      ...(input.canReadFinancials || input.canReadOwnCa
        ? {
            totalXaf: row.totalXaf.toString(),
            totalLabel: formatXaf(row.totalXaf),
          }
        : {}),
    })),
  };

  const ownCa =
    input.canReadOwnCa && input.ownCa
      ? {
          saleCount: input.ownCa.saleCount,
          caPeriodXaf: input.ownCa.revenueXaf.toString(),
          caPeriodLabel: formatXaf(input.ownCa.revenueXaf),
          averageBasketXaf: input.ownCa.averageBasketXaf?.toString() ?? null,
          averageBasketLabel:
            input.ownCa.averageBasketXaf !== null
              ? formatXaf(input.ownCa.averageBasketXaf)
              : "—",
        }
      : null;

  if (!input.canReadFinancials) {
    return {
      ...operational,
      canReadFinancials: false as const,
      canReadOwnCa: input.canReadOwnCa,
      financials: null,
      ownCa,
    };
  }

  return {
    ...operational,
    canReadFinancials: true as const,
    canReadOwnCa: false as const,
    ownCa: null,
    financials: {
      caPeriodXaf: input.revenueXaf.toString(),
      caPeriodLabel: formatXaf(input.revenueXaf),
      caTodayXaf: input.caTodayXaf.toString(),
      caTodayLabel: formatXaf(input.caTodayXaf),
      caMonthXaf: input.caMonthXaf.toString(),
      caMonthLabel: formatXaf(input.caMonthXaf),
      refundsPeriodXaf: input.refundsPeriodXaf.toString(),
      refundsPeriodLabel: formatXaf(input.refundsPeriodXaf),
      marginXaf: input.marginXaf.toString(),
      marginLabel: formatXaf(input.marginXaf),
      averageBasketXaf: input.averageBasketXaf?.toString() ?? null,
      averageBasketLabel:
        input.averageBasketXaf !== null
          ? formatXaf(input.averageBasketXaf)
          : "—",
      creditOutstandingXaf: input.creditOutstandingXaf.toString(),
      creditOutstandingLabel: formatXaf(input.creditOutstandingXaf),
      paymentsByMethod: input.paymentsByMethod.map((row) => ({
        method: row.method,
        methodLabel: paymentMethodLabel(row.method),
        count: row.count,
        amountXaf: row.amountXaf.toString(),
        amountLabel: formatXaf(row.amountXaf),
      })),
    },
  };
}
