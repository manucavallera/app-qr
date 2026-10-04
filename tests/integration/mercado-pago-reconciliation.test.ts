import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { orderRepository } from "@/modules/orders/order-repository";

const created: { orderIds: string[]; attemptIds: string[] } = { orderIds: [], attemptIds: [] };

async function createPendingOrder(totalCents = 9500) {
  const suffix = randomUUID();
  const order = await prisma.order.create({ data: { clientRequestId: `mp-recon-${suffix}`, origin: "QR", totalCents, status: "AWAITING_PAYMENT" } });
  const attempt = await prisma.paymentAttempt.create({ data: { orderId: order.id, method: "MERCADO_PAGO", status: "PENDING", amountCents: totalCents, idempotencyKey: `mp-recon-key-${suffix}`, providerOrderId: `ORD-${suffix}` } });
  created.orderIds.push(order.id);
  created.attemptIds.push(attempt.id);
  return { order, attempt };
}

const update = (providerOrderId: string, externalReference: string, overrides: Partial<{ status: string; statusDetail: string; totalPaidCents: number }> = {}) => orderRepository.processGatewayUpdate({
  providerOrderId, externalReference, status: "processed", statusDetail: "accredited", totalPaidCents: 9500, raw: { source: "test" }, ...overrides,
});

const snapshot = async (orderId: string, attemptId: string) => ({
  order: await prisma.order.findUniqueOrThrow({ where: { id: orderId } }),
  attempt: await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } }),
  events: await prisma.orderStatusEvent.count({ where: { orderId } }),
  audits: (await prisma.auditEvent.findMany({ where: { entityId: attemptId } })).map((audit) => audit.action),
});

describe("Mercado Pago reconciliation", () => {
  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: created.attemptIds } } });
    await prisma.order.deleteMany({ where: { id: { in: created.orderIds } } });
  });

  it("confirms the order when the exact amount is accredited", async () => {
    const { order, attempt } = await createPendingOrder();
    await update(attempt.providerOrderId!, order.id);
    const after = await snapshot(order.id, attempt.id);
    expect(after.attempt.status).toBe("APPROVED");
    expect(after.order.status).toBe("CONFIRMED");
    expect(after.events).toBe(1);
  });

  it("ignores a repeated notification without confirming twice", async () => {
    const { order, attempt } = await createPendingOrder();
    await update(attempt.providerOrderId!, order.id);
    const once = await snapshot(order.id, attempt.id);
    await update(attempt.providerOrderId!, order.id);
    const twice = await snapshot(order.id, attempt.id);
    expect(twice.order.version).toBe(once.order.version);
    expect(twice.events).toBe(1);
  });

  it("does not confirm an accredited payment with a different amount and audits it", async () => {
    const { order, attempt } = await createPendingOrder();
    await update(attempt.providerOrderId!, order.id, { totalPaidCents: 100 });
    const after = await snapshot(order.id, attempt.id);
    expect(after.order.status).toBe("AWAITING_PAYMENT");
    expect(after.attempt.status).toBe("PENDING");
    expect(after.audits).toContain("PAYMENT_AMOUNT_MISMATCH");
  });

  it("marks a rejected payment and leaves the order waiting", async () => {
    const { order, attempt } = await createPendingOrder();
    await update(attempt.providerOrderId!, order.id, { statusDetail: "rejected", totalPaidCents: 0 });
    const after = await snapshot(order.id, attempt.id);
    expect(after.attempt.status).toBe("REJECTED");
    expect(after.order.status).toBe("AWAITING_PAYMENT");
  });

  it("records money that arrives for an order that was already cancelled", async () => {
    const { order, attempt } = await createPendingOrder();
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    await update(attempt.providerOrderId!, order.id);
    const after = await snapshot(order.id, attempt.id);
    expect(after.order.status).toBe("CANCELLED");
    expect(after.attempt.status).toBe("APPROVED");
    expect(after.audits).toContain("PAYMENT_APPROVED_AFTER_CANCELLATION");
  });

  it("refuses unknown payments and payments that point to another order", async () => {
    const { order, attempt } = await createPendingOrder();
    await expect(update(`ORD-unknown-${randomUUID()}`, order.id)).rejects.toMatchObject({ code: "PAYMENT_NOT_FOUND" });
    await expect(update(attempt.providerOrderId!, randomUUID())).rejects.toMatchObject({ code: "PAYMENT_NOT_FOUND" });
    expect((await snapshot(order.id, attempt.id)).order.status).toBe("AWAITING_PAYMENT");
  });

  it("finds the attempt by the reference sent to Mercado Pago when the payment id is new", async () => {
    const { order, attempt } = await createPendingOrder();
    await update(`payment-${randomUUID()}`, attempt.id);
    const after = await snapshot(order.id, attempt.id);
    expect(after.attempt.status).toBe("APPROVED");
    expect(after.order.status).toBe("CONFIRMED");
  });

  it("does not let a reference of another attempt or payment method confirm an order", async () => {
    const first = await createPendingOrder();
    const second = await createPendingOrder();
    await expect(update(`payment-${randomUUID()}`, "not-an-attempt")).rejects.toMatchObject({ code: "PAYMENT_NOT_FOUND" });
    const cash = await prisma.paymentAttempt.create({ data: { orderId: second.order.id, method: "CASH", status: "UNPAID", amountCents: 9500, idempotencyKey: `cash-${randomUUID()}` } });
    created.attemptIds.push(cash.id);
    await expect(update(`payment-${randomUUID()}`, cash.id)).rejects.toMatchObject({ code: "PAYMENT_NOT_FOUND" });
    expect((await snapshot(first.order.id, first.attempt.id)).order.status).toBe("AWAITING_PAYMENT");
    expect((await snapshot(second.order.id, second.attempt.id)).order.status).toBe("AWAITING_PAYMENT");
  });
});
