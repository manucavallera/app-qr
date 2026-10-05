import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { buildSalesReport } from "@/modules/reports/sales-report";

// A day far in the past keeps this report isolated from orders created by other suites.
const day = "2001-03-15";
const at = new Date(`${day}T15:00:00.000Z`);
const productName = `Reporte ${randomUUID()}`;
const orderIds: string[] = [];

async function createOrder(status: "DELIVERED" | "CANCELLED" | "AWAITING_PAYMENT", method: "CASH" | "CARD_AT_COUNTER", quantity: number, unitCostCents: number | null = null, name = productName) {
  const totalCents = 1000 * quantity;
  const order = await prisma.order.create({
    data: {
      clientRequestId: randomUUID(),
      origin: "COUNTER",
      status,
      totalCents,
      createdAt: at,
      items: { create: { productName: name, unitCostCents, quantity, unitBaseCents: 1000, optionsTotalCents: 0, lineTotalCents: totalCents, station: "GENERAL", fulfillment: "TABLE" } },
      payments: { create: { method, status: status === "DELIVERED" ? "APPROVED" : status === "CANCELLED" ? "REJECTED" : "UNPAID", amountCents: totalCents, idempotencyKey: randomUUID() } },
    },
  });
  orderIds.push(order.id);
}

describe("sales report", () => {
  beforeAll(async () => {
    await createOrder("DELIVERED", "CASH", 2);
    await createOrder("DELIVERED", "CARD_AT_COUNTER", 1);
    await createOrder("CANCELLED", "CASH", 5);
    await createOrder("AWAITING_PAYMENT", "CASH", 4);
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  });

  it("totals only paid orders and splits them by payment method and product", async () => {
    const report = await buildSalesReport({ from: day, to: day });

    expect(report).toMatchObject({ totalCents: 3000, orders: 2, cancelledOrders: 1, awaitingPaymentOrders: 1 });
    expect(report.byPaymentMethod).toEqual([
      { method: "CASH", totalCents: 2000, payments: 1 },
      { method: "CARD_AT_COUNTER", totalCents: 1000, payments: 1 },
    ]);
    expect(report.byProduct).toEqual([{ productName, quantity: 3, totalCents: 3000, costCents: null, profitCents: null }]);
  });

  it("shows unpaid table tabs as sold but still to collect, and drops them once settled", async () => {
    const tabDay = "2001-05-10";
    const order = await prisma.order.create({
      data: {
        clientRequestId: randomUUID(), origin: "QR", status: "CONFIRMED", totalCents: 2500, createdAt: new Date(`${tabDay}T15:00:00.000Z`),
        items: { create: { productName: `Cuenta ${randomUUID()}`, quantity: 1, unitBaseCents: 2500, optionsTotalCents: 0, lineTotalCents: 2500, station: "GENERAL", fulfillment: "TABLE" } },
        payments: { create: { method: "ON_TAB", status: "UNPAID", amountCents: 2500, idempotencyKey: randomUUID() } },
      },
      include: { payments: true },
    });
    orderIds.push(order.id);
    const open = await buildSalesReport({ from: tabDay, to: tabDay });
    expect(open).toMatchObject({ totalCents: 2500, onTabOrders: 1, onTabCents: 2500, byPaymentMethod: [] });

    await prisma.paymentAttempt.update({ where: { id: order.payments[0]!.id }, data: { method: "CASH", status: "APPROVED" } });
    const settled = await buildSalesReport({ from: tabDay, to: tabDay });
    expect(settled).toMatchObject({ totalCents: 2500, onTabOrders: 0, onTabCents: 0, byPaymentMethod: [{ method: "CASH", totalCents: 2500, payments: 1 }] });
  });

  it("reports profit only for units with a known cost", async () => {
    const day2 = "2001-04-20";
    const costed = `Con costo ${randomUUID()}`;
    const saved = at.getTime();
    at.setTime(new Date(`${day2}T15:00:00.000Z`).getTime());
    await createOrder("DELIVERED", "CASH", 3, 400, costed);
    await createOrder("DELIVERED", "CASH", 2, null);
    await createOrder("CANCELLED", "CASH", 9, 400, costed);
    at.setTime(saved);

    const report = await buildSalesReport({ from: day2, to: day2 });

    expect(report).toMatchObject({ totalCents: 5000, costCents: 1200, profitCents: 1800, uncostedCents: 2000 });
    expect(report.byProduct).toEqual([
      { productName: costed, quantity: 3, totalCents: 3000, costCents: 1200, profitCents: 1800 },
      { productName, quantity: 2, totalCents: 2000, costCents: null, profitCents: null },
    ]);
  });

  it("rejects malformed and inverted ranges", async () => {
    await expect(buildSalesReport({ from: "ayer", to: day })).rejects.toThrow();
    await expect(buildSalesReport({ from: "2001-03-16", to: day })).rejects.toMatchObject({ code: "INVALID_REPORT_RANGE" });
  });
});
