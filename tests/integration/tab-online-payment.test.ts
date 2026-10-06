import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { orderRepository } from "@/modules/orders/order-repository";
import { tableTabRepository } from "@/modules/orders/table-tab";

const created: { tableIds: string[]; staffIds: string[] } = { tableIds: [], staffIds: [] };

async function openTab(lines: { amountCents: number; sessionId?: string }[]) {
  const suffix = randomUUID();
  const table = await prisma.diningTable.create({ data: { label: `Mesa-${suffix}`, qrToken: `qr-${suffix}` } });
  created.tableIds.push(table.id);
  const session = await prisma.customerSession.create({ data: { tableId: table.id, nickname: "Ana", tokenHash: `hash-${suffix}`, expiresAt: new Date(Date.now() + 3_600_000) } });
  const other = await prisma.customerSession.create({ data: { tableId: table.id, nickname: "Beto", tokenHash: `hash2-${suffix}`, expiresAt: new Date(Date.now() + 3_600_000) } });
  const tab = await prisma.tableTab.create({ data: { tableId: table.id } });
  const orders = [];
  for (const [index, line] of lines.entries()) {
    const owner = line.sessionId === "other" ? other : session;
    const order = await prisma.order.create({
      data: { clientRequestId: `tab-pay-${suffix}-${index}`, origin: "QR", totalCents: line.amountCents, status: "CONFIRMED", tableId: table.id, tabId: tab.id, customerSessionId: owner.id },
    });
    await prisma.paymentAttempt.create({ data: { orderId: order.id, method: "ON_TAB", status: "UNPAID", amountCents: line.amountCents, idempotencyKey: `tab-pay-key-${suffix}-${index}` } });
    orders.push(order);
  }
  return { table, tab, session, other, orders };
}

const update = (externalReference: string, overrides: Partial<{ status: string; statusDetail: string; totalPaidCents: number }> = {}) =>
  orderRepository.processGatewayUpdate({ providerOrderId: `MP-${externalReference}`, externalReference, status: "processed", statusDetail: "accredited", totalPaidCents: 0, raw: { source: "test" }, ...overrides });

describe("tab online payment", () => {
  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { OR: [{ entityType: "TabPayment" }, { actorStaffId: { in: created.staffIds } }] } });
    await prisma.order.deleteMany({ where: { tableId: { in: created.tableIds } } });
    await prisma.tableTab.deleteMany({ where: { tableId: { in: created.tableIds } } });
    await prisma.customerSession.deleteMany({ where: { tableId: { in: created.tableIds } } });
    await prisma.diningTable.deleteMany({ where: { id: { in: created.tableIds } } });
    await prisma.staffUser.deleteMany({ where: { id: { in: created.staffIds } } });
    await prisma.staffUser.deleteMany({ where: { id: { in: created.staffIds } } });
    await prisma.staffUser.deleteMany({ where: { id: { in: created.staffIds } } });
  });

  it("covers only the customer's own orders when paying their share", async () => {
    const { table, session, orders } = await openTab([{ amountCents: 1000 }, { amountCents: 500, sessionId: "other" }, { amountCents: 250 }]);
    const prepared = await tableTabRepository.prepareOnlinePayment({ tableId: table.id, customerSessionId: session.id, scope: "mine" });
    expect(prepared.payment.amountCents).toBe(1250);
    expect(prepared.payment.orderIds.sort()).toEqual([orders[0].id, orders[2].id].sort());
  });

  it("covers the whole table and reuses the pending payment", async () => {
    const { table, session } = await openTab([{ amountCents: 1000 }, { amountCents: 500, sessionId: "other" }]);
    const first = await tableTabRepository.prepareOnlinePayment({ tableId: table.id, customerSessionId: session.id, scope: "table" });
    expect(first.payment.amountCents).toBe(1500);
    await tableTabRepository.saveOnlineCheckout({ paymentId: first.payment.id, providerOrderId: "pref-1", checkoutUrl: "https://mp.test/1", raw: {} });
    const again = await tableTabRepository.prepareOnlinePayment({ tableId: table.id, customerSessionId: session.id, scope: "table" });
    expect(again.payment.id).toBe(first.payment.id);
    expect(again.payment.checkoutUrl).toBe("https://mp.test/1");
  });

  it("settles the covered orders and closes the tab when everything is paid", async () => {
    const { table, tab, session, orders } = await openTab([{ amountCents: 1000 }, { amountCents: 500, sessionId: "other" }]);
    const { payment } = await tableTabRepository.prepareOnlinePayment({ tableId: table.id, customerSessionId: session.id, scope: "table" });
    await update(payment.id, { totalPaidCents: 1500 });
    const attempts = await prisma.paymentAttempt.findMany({ where: { orderId: { in: orders.map((order) => order.id) } } });
    expect(attempts.every((attempt) => attempt.status === "APPROVED" && attempt.method === "MERCADO_PAGO")).toBe(true);
    expect((await prisma.tableTab.findUniqueOrThrow({ where: { id: tab.id } })).closedAt).not.toBeNull();
    expect((await prisma.tabPayment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("APPROVED");
  });

  it("settles only the share and leaves the tab open for the others", async () => {
    const { table, tab, session, orders } = await openTab([{ amountCents: 1000 }, { amountCents: 500, sessionId: "other" }]);
    const { payment } = await tableTabRepository.prepareOnlinePayment({ tableId: table.id, customerSessionId: session.id, scope: "mine" });
    await update(payment.id, { totalPaidCents: 1000 });
    const paid = await prisma.paymentAttempt.findFirstOrThrow({ where: { orderId: orders[0].id } });
    const unpaid = await prisma.paymentAttempt.findFirstOrThrow({ where: { orderId: orders[1].id } });
    expect(paid.status).toBe("APPROVED");
    expect(unpaid.status).toBe("UNPAID");
    expect((await prisma.tableTab.findUniqueOrThrow({ where: { id: tab.id } })).closedAt).toBeNull();
  });

  it("ignores a repeated notification", async () => {
    const { table, session } = await openTab([{ amountCents: 700 }]);
    const { payment } = await tableTabRepository.prepareOnlinePayment({ tableId: table.id, customerSessionId: session.id, scope: "mine" });
    await update(payment.id, { totalPaidCents: 700 });
    await update(payment.id, { totalPaidCents: 700 });
    expect(await prisma.auditEvent.count({ where: { entityId: payment.id, action: "TAB_PAID_ONLINE" } })).toBe(1);
  });

  it("does not settle when the amount differs and audits it", async () => {
    const { table, session, orders } = await openTab([{ amountCents: 700 }]);
    const { payment } = await tableTabRepository.prepareOnlinePayment({ tableId: table.id, customerSessionId: session.id, scope: "mine" });
    await update(payment.id, { totalPaidCents: 100 });
    expect((await prisma.paymentAttempt.findFirstOrThrow({ where: { orderId: orders[0].id } })).status).toBe("UNPAID");
    expect(await prisma.auditEvent.count({ where: { entityId: payment.id, action: "TAB_PAYMENT_AMOUNT_MISMATCH" } })).toBe(1);
  });

  it("flags money to refund when staff already collected the orders", async () => {
    const { table, tab, session, orders } = await openTab([{ amountCents: 700 }]);
    const { payment } = await tableTabRepository.prepareOnlinePayment({ tableId: table.id, customerSessionId: session.id, scope: "mine" });
    const staff = await prisma.staffUser.create({ data: { email: `tab-pay-${randomUUID()}@test.local`, displayName: "Caja", passwordHash: "x", role: "ADMIN" } });
    created.staffIds.push(staff.id);
    await tableTabRepository.settleTab({ tabId: tab.id, method: "CASH" }, staff.id);
    await update(payment.id, { totalPaidCents: 700 });
    expect(await prisma.auditEvent.count({ where: { entityId: payment.id, action: "TAB_PAYMENT_NEEDS_REFUND" } })).toBe(1);
    expect((await prisma.paymentAttempt.findFirstOrThrow({ where: { orderId: orders[0].id } })).method).toBe("CASH");
  });

  it("marks the payment rejected without touching the orders", async () => {
    const { table, session, orders } = await openTab([{ amountCents: 700 }]);
    const { payment } = await tableTabRepository.prepareOnlinePayment({ tableId: table.id, customerSessionId: session.id, scope: "mine" });
    await update(payment.id, { statusDetail: "rejected" });
    expect((await prisma.tabPayment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("REJECTED");
    expect((await prisma.paymentAttempt.findFirstOrThrow({ where: { orderId: orders[0].id } })).status).toBe("UNPAID");
  });
});
