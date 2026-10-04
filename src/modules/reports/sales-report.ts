import { DateTime } from "luxon";
import { z } from "zod";
import { prisma } from "../../lib/db";
import { DomainError } from "../orders/errors";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const salesReportQuerySchema = z.object({ from: day, to: day });

const MAX_RANGE_DAYS = 366;
/** An order counts as a sale once its payment is confirmed. */
const SOLD_STATUSES = ["CONFIRMED", "PREPARING", "READY", "DELIVERED"] as const;

export type SalesReport = {
  from: string;
  to: string;
  timezone: string;
  totalCents: number;
  orders: number;
  cancelledOrders: number;
  awaitingPaymentOrders: number;
  byPaymentMethod: { method: string; totalCents: number; payments: number }[];
  byProduct: { productName: string; quantity: number; totalCents: number }[];
};

/**
 * Sales between two calendar days (inclusive) in the business timezone.
 * Covers both the daily cash close and the sales-by-product report.
 */
export async function buildSalesReport(input: unknown): Promise<SalesReport> {
  const { from, to } = salesReportQuerySchema.parse(input);
  const settings = await prisma.businessSettings.findUnique({ where: { id: "default" }, select: { timezone: true } });
  const timezone = settings?.timezone ?? "America/Argentina/Buenos_Aires";
  const start = DateTime.fromISO(from, { zone: timezone }).startOf("day");
  const end = DateTime.fromISO(to, { zone: timezone }).plus({ days: 1 }).startOf("day");
  if (!start.isValid || !end.isValid || end <= start || end.diff(start, "days").days > MAX_RANGE_DAYS) {
    throw new DomainError("INVALID_REPORT_RANGE", "El rango de fechas no es válido.");
  }

  const createdAt = { gte: start.toJSDate(), lt: end.toJSDate() };
  const sold = { createdAt, status: { in: [...SOLD_STATUSES] } };
  const [totals, cancelledOrders, awaitingPaymentOrders, payments, items] = await Promise.all([
    prisma.order.aggregate({ where: sold, _sum: { totalCents: true }, _count: true }),
    prisma.order.count({ where: { createdAt, status: "CANCELLED" } }),
    prisma.order.count({ where: { createdAt, status: "AWAITING_PAYMENT" } }),
    prisma.paymentAttempt.groupBy({ by: ["method"], where: { status: "APPROVED", order: sold }, _sum: { amountCents: true }, _count: true }),
    prisma.orderItem.groupBy({ by: ["productName"], where: { order: sold }, _sum: { quantity: true, lineTotalCents: true } }),
  ]);

  return {
    from,
    to,
    timezone,
    totalCents: totals._sum.totalCents ?? 0,
    orders: totals._count,
    cancelledOrders,
    awaitingPaymentOrders,
    byPaymentMethod: payments
      .map((row) => ({ method: row.method, totalCents: row._sum.amountCents ?? 0, payments: row._count }))
      .sort((a, b) => b.totalCents - a.totalCents),
    byProduct: items
      .map((row) => ({ productName: row.productName, quantity: row._sum.quantity ?? 0, totalCents: row._sum.lineTotalCents ?? 0 }))
      .sort((a, b) => b.totalCents - a.totalCents || b.quantity - a.quantity),
  };
}
