import { DateTime } from "luxon";
import { prisma } from "../../lib/db";
import { LOW_STOCK_THRESHOLD } from "../orders/stock";
import { businessDayStart } from "./business-day";
import { listLowSupplies, type SupplyView } from "../supplies/supply-service";

/** An order counts as a sale once its payment is confirmed. */
const SOLD_STATUSES = ["CONFIRMED", "PREPARING", "READY", "DELIVERED"] as const;
const IN_PROGRESS_STATUSES = ["AWAITING_PAYMENT", "CONFIRMED", "PREPARING", "READY"] as const;
const TOP_PRODUCTS = 5;
/** profitCents counts only units with a known cost; null when none had one. */
export type DashboardPeriod = { totalCents: number; orders: number; averageCents: number; profitCents: number | null };

export type Dashboard = {
  timezone: string;
  today: DashboardPeriod;
  last7Days: DashboardPeriod;
  last30Days: DashboardPeriod;
  /** Orders per status right now, only the statuses still open. */
  inProgress: { status: (typeof IN_PROGRESS_STATUSES)[number]; orders: number }[];
  /** Best sellers of the last 7 days. */
  topProducts: { productName: string; quantity: number; totalCents: number }[];
  /** Sales of the last 30 days by hour of the day (0-23), in the business timezone. */
  byHour: { hour: number; orders: number; totalCents: number }[];
  lowStockSupplies: SupplyView[];
  lowStockProducts: { id: string; name: string; stockQuantity: number }[];
};

type SoldLine = { quantity: number; lineTotalCents: number; unitCostCents: number | null; order: { createdAt: Date } };

function summarize(rows: { totalCents: number }[], lines: SoldLine[]): DashboardPeriod {
  const totalCents = rows.reduce((sum, row) => sum + row.totalCents, 0);
  const costed = lines.filter((line) => line.unitCostCents !== null);
  const profitCents = costed.length === 0 ? null : costed.reduce((sum, line) => sum + line.lineTotalCents - line.quantity * line.unitCostCents!, 0);
  return { totalCents, orders: rows.length, averageCents: rows.length > 0 ? Math.round(totalCents / rows.length) : 0, profitCents };
}

/** Owner dashboard: sales, open orders, best sellers and busiest hours. `now` is injectable for tests. */
export async function buildDashboard(now: Date = new Date()): Promise<Dashboard> {
  const settings = await prisma.businessSettings.findUnique({ where: { id: "default" }, select: { timezone: true } });
  const timezone = settings?.timezone ?? "America/Argentina/Buenos_Aires";
  const todayStart = businessDayStart(now, timezone);
  const since7 = todayStart.minus({ days: 6 }).toJSDate();
  const since30 = todayStart.minus({ days: 29 }).toJSDate();

  const [sales, lines, open, items, lowStockProducts, lowStockSupplies] = await Promise.all([
    prisma.order.findMany({ where: { status: { in: [...SOLD_STATUSES] }, createdAt: { gte: since30 } }, select: { createdAt: true, totalCents: true } }),
    prisma.orderItem.findMany({ where: { order: { status: { in: [...SOLD_STATUSES] }, createdAt: { gte: since30 } } }, select: { quantity: true, lineTotalCents: true, unitCostCents: true, order: { select: { createdAt: true } } } }),
    prisma.order.groupBy({ by: ["status"], where: { status: { in: [...IN_PROGRESS_STATUSES] } }, _count: true }),
    prisma.orderItem.groupBy({ by: ["productName"], where: { order: { status: { in: [...SOLD_STATUSES] }, createdAt: { gte: since7 } } }, _sum: { quantity: true, lineTotalCents: true } }),
    prisma.product.findMany({
      where: { visible: true, stockQuantity: { lte: LOW_STOCK_THRESHOLD } },
      orderBy: [{ stockQuantity: "asc" }, { name: "asc" }],
      select: { id: true, name: true, stockQuantity: true },
    }),
    listLowSupplies(),
  ]);

  const hours = new Map<number, { orders: number; totalCents: number }>();
  for (const sale of sales) {
    const hour = DateTime.fromJSDate(sale.createdAt, { zone: timezone }).hour;
    const bucket = hours.get(hour) ?? { orders: 0, totalCents: 0 };
    bucket.orders += 1;
    bucket.totalCents += sale.totalCents;
    hours.set(hour, bucket);
  }

  const openByStatus = new Map(open.map((row) => [row.status, row._count]));
  return {
    timezone,
    today: summarize(sales.filter((sale) => sale.createdAt >= todayStart.toJSDate()), lines.filter((line) => line.order.createdAt >= todayStart.toJSDate())),
    last7Days: summarize(sales.filter((sale) => sale.createdAt >= since7), lines.filter((line) => line.order.createdAt >= since7)),
    last30Days: summarize(sales, lines),
    inProgress: IN_PROGRESS_STATUSES.map((status) => ({ status, orders: openByStatus.get(status) ?? 0 })),
    topProducts: items
      .map((row) => ({ productName: row.productName, quantity: row._sum.quantity ?? 0, totalCents: row._sum.lineTotalCents ?? 0 }))
      .sort((a, b) => b.quantity - a.quantity || b.totalCents - a.totalCents)
      .slice(0, TOP_PRODUCTS),
    lowStockSupplies,
    lowStockProducts: lowStockProducts.flatMap((p) => (p.stockQuantity === null ? [] : [{ ...p, stockQuantity: p.stockQuantity }])),
    byHour: [...hours.entries()].sort(([a], [b]) => a - b).map(([hour, value]) => ({ hour, ...value })),
  };
}
