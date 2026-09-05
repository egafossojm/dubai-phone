export const DASHBOARD_TIME_ZONE = "Africa/Douala";

/** Max inclusive days for a custom dashboard range (Wave B). */
export const DASHBOARD_CUSTOM_MAX_DAYS = 92;

export type DashboardPeriod = "today" | "week" | "month" | "custom";

export type DateRange = {
  from: Date;
  toExclusive: Date;
  label: string;
};

function ymdParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { year, month, day };
}

function zonedParts(
  date: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Instant of local midnight in `timeZone` for the given calendar Y-M-D.
 * Iteratively corrects a UTC guess using the zone's wall-clock parts.
 */
export function zonedMidnightUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string = DASHBOARD_TIME_ZONE,
): Date {
  let utcMs = Date.UTC(year, month - 1, day, 0, 0, 0);
  for (let i = 0; i < 4; i += 1) {
    const local = zonedParts(new Date(utcMs), timeZone);
    const asUtcMs = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    const targetMs = Date.UTC(year, month - 1, day, 0, 0, 0);
    const delta = asUtcMs - targetMs;
    if (delta === 0) {
      break;
    }
    utcMs -= delta;
  }
  return new Date(utcMs);
}

export function addCalendarDaysUtcMidnight(
  start: Date,
  days: number,
  timeZone: string = DASHBOARD_TIME_ZONE,
): Date {
  const { year, month, day } = ymdParts(
    new Date(start.getTime() + 12 * 60 * 60 * 1000),
    timeZone,
  );
  const probe = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  const next = ymdParts(probe, timeZone);
  return zonedMidnightUtc(next.year, next.month, next.day, timeZone);
}

export function inclusiveDaySpan(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split("-").map(Number);
  const [ty, tm, td] = toYmd.split("-").map(Number);
  const fromUtc = Date.UTC(fy!, fm! - 1, fd!);
  const toUtc = Date.UTC(ty!, tm! - 1, td!);
  return Math.floor((toUtc - fromUtc) / 86_400_000) + 1;
}

export function resolveDashboardRange(options: {
  period: DashboardPeriod;
  fromYmd?: string;
  toYmd?: string;
  now?: Date;
  timeZone?: string;
}): DateRange {
  const timeZone = options.timeZone ?? DASHBOARD_TIME_ZONE;
  const now = options.now ?? new Date();
  const todayParts = ymdParts(now, timeZone);
  const todayStart = zonedMidnightUtc(
    todayParts.year,
    todayParts.month,
    todayParts.day,
    timeZone,
  );

  if (options.period === "today") {
    return {
      from: todayStart,
      toExclusive: addCalendarDaysUtcMidnight(todayStart, 1, timeZone),
      label: "Aujourd'hui",
    };
  }

  if (options.period === "week") {
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
    }).format(now);
    const mondayOffset: Record<string, number> = {
      Mon: 0,
      Tue: 1,
      Wed: 2,
      Thu: 3,
      Fri: 4,
      Sat: 5,
      Sun: 6,
    };
    const back = mondayOffset[weekday] ?? 0;
    const weekStart = addCalendarDaysUtcMidnight(todayStart, -back, timeZone);
    return {
      from: weekStart,
      toExclusive: addCalendarDaysUtcMidnight(todayStart, 1, timeZone),
      label: "Cette semaine",
    };
  }

  if (options.period === "month") {
    const monthStart = zonedMidnightUtc(
      todayParts.year,
      todayParts.month,
      1,
      timeZone,
    );
    return {
      from: monthStart,
      toExclusive: addCalendarDaysUtcMidnight(todayStart, 1, timeZone),
      label: "Ce mois",
    };
  }

  if (!options.fromYmd || !options.toYmd) {
    throw new Error("Custom dashboard range requires fromYmd and toYmd.");
  }

  const [fy, fm, fd] = options.fromYmd.split("-").map(Number);
  const [ty, tm, td] = options.toYmd.split("-").map(Number);
  const from = zonedMidnightUtc(fy!, fm!, fd!, timeZone);
  const toStart = zonedMidnightUtc(ty!, tm!, td!, timeZone);
  return {
    from,
    toExclusive: addCalendarDaysUtcMidnight(toStart, 1, timeZone),
    label: `${options.fromYmd} → ${options.toYmd}`,
  };
}

/**
 * Net line after completed returns (integer FCFA share).
 * remainder stays with unsold quantity (same policy as returns module).
 */
export function netLineAfterReturns(options: {
  lineTotalXaf: bigint;
  saleQuantity: number;
  returnedQuantity: number;
}): { netQuantity: number; netLineTotalXaf: bigint } {
  const returned = Math.min(
    Math.max(options.returnedQuantity, 0),
    options.saleQuantity,
  );
  const netQuantity = options.saleQuantity - returned;
  if (netQuantity <= 0 || options.saleQuantity <= 0) {
    return { netQuantity: 0, netLineTotalXaf: BigInt(0) };
  }
  const netLineTotalXaf =
    (options.lineTotalXaf * BigInt(netQuantity)) /
    BigInt(options.saleQuantity);
  return { netQuantity, netLineTotalXaf };
}

/**
 * Estimated margin for a sale after returns + global discount already in totalXaf.
 * margin ≈ netRevenue − Σ(cost × netQty)
 */
export function estimateSaleMarginXaf(options: {
  saleTotalXaf: bigint;
  refundedXaf: bigint;
  lines: Array<{
    lineTotalXaf: bigint;
    costPriceXaf: bigint;
    saleQuantity: number;
    returnedQuantity: number;
  }>;
}): bigint {
  const refunded =
    options.refundedXaf < BigInt(0) ? BigInt(0) : options.refundedXaf;
  const netRevenue =
    options.saleTotalXaf > refunded
      ? options.saleTotalXaf - refunded
      : BigInt(0);
  let cost = BigInt(0);
  for (const line of options.lines) {
    const { netQuantity } = netLineAfterReturns({
      lineTotalXaf: line.lineTotalXaf,
      saleQuantity: line.saleQuantity,
      returnedQuantity: line.returnedQuantity,
    });
    cost += line.costPriceXaf * BigInt(netQuantity);
  }
  return netRevenue - cost;
}

export function averageBasketXaf(options: {
  revenueXaf: bigint;
  saleCount: number;
}): bigint | null {
  if (options.saleCount <= 0) {
    return null;
  }
  return options.revenueXaf / BigInt(options.saleCount);
}

export function isLowStock(quantityOnHand: number, threshold: number): boolean {
  return quantityOnHand <= threshold;
}

/** @deprecated prefer estimateSaleMarginXaf — kept for narrow unit tests */
export function estimateGrossMarginXaf(options: {
  lineTotalXaf: bigint;
  costPriceXaf: bigint;
  quantity: number;
}): bigint {
  const cost = options.costPriceXaf * BigInt(options.quantity);
  return options.lineTotalXaf - cost;
}
