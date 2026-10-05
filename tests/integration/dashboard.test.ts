import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { buildDashboard } from "@/modules/reports/dashboard";

// Anchoring "now" in 2001 keeps the windows isolated from orders created by other suites.
const now = new Date("2001-03-15T18:00:00.000Z");
const productName = `Dashboard ${randomUUID()}`;
const orderIds: string[] = [];

async function createOrder(createdAt: string, status: "DELIVERED" | "CANCELLED", quantity: number, unitCostCents: number | null = null) {
  const totalCents = 1000 * quantity;
  const order = await prisma.order.create({
    data: {
      clientRequestId: randomUUID(),
      origin: "COUNTER",
      status,
      totalCents,
      createdAt: new Date(createdAt),
      items: { create: { productName, unitCostCents, quantity, unitBaseCents: 1000, optionsTotalCents: 0, lineTotalCents: totalCents, station: "GENERAL", fulfillment: "TABLE" } },
    },
  });
  orderIds.push(order.id);
}

describe("dashboard", () => {
  beforeAll(async () => {
    await createOrder("2001-03-15T15:00:00.000Z", "DELIVERED", 2); // today
    await createOrder("2001-03-12T15:00:00.000Z", "DELIVERED", 1, 300); // 3 days ago
    await createOrder("2001-03-01T15:00:00.000Z", "DELIVERED", 3); // 14 days ago
    await createOrder("2001-03-15T16:00:00.000Z", "CANCELLED", 9); // never counts
    await createOrder("2001-01-01T15:00:00.000Z", "DELIVERED", 7); // outside the 30-day window
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  });

  it("splits paid sales into today, 7 and 30 day windows and ignores cancelled orders", async () => {
    const dashboard = await buildDashboard(now);

    expect(dashboard.today).toEqual({ totalCents: 2000, orders: 1, averageCents: 2000, profitCents: null });
    expect(dashboard.last7Days).toEqual({ totalCents: 3000, orders: 2, averageCents: 1500, profitCents: 700 });
    expect(dashboard.last30Days).toEqual({ totalCents: 6000, orders: 3, averageCents: 2000, profitCents: 700 });
  });

  it("ranks best sellers over the last 7 days and buckets sales by local hour", async () => {
    const dashboard = await buildDashboard(now);

    expect(dashboard.topProducts.find((row) => row.productName === productName)).toEqual({ productName, quantity: 3, totalCents: 3000 });
    expect(dashboard.byHour.reduce((sum, row) => sum + row.orders, 0)).toBeGreaterThanOrEqual(3);
  });
});
