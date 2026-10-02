import { prisma } from "../../lib/db";

/** Unpaid orders are cancelled after this long so Caja's pending list stays real. */
export const UNPAID_ORDER_TTL_MS = 30 * 60 * 1000;
/** Orders with an online checkout in progress get longer: the provider may still confirm. */
export const PENDING_ONLINE_ORDER_TTL_MS = 2 * 60 * 60 * 1000;
export const UNPAID_CANCELLATION_REASON = "Pago no recibido a tiempo";

/**
 * Cancels orders still waiting for payment after their time limit.
 * Runs from the same external cron as the session cleanup.
 */
export async function cancelStaleUnpaidOrders(now = new Date()): Promise<{ cancelled: number }> {
  const candidates = await prisma.order.findMany({
    where: { status: "AWAITING_PAYMENT", createdAt: { lt: new Date(now.getTime() - UNPAID_ORDER_TTL_MS) } },
    select: { id: true, createdAt: true, payments: { select: { status: true } } },
  });

  let cancelled = 0;
  for (const candidate of candidates) {
    if (candidate.payments.some((payment) => payment.status === "APPROVED")) continue;
    const onlineCheckoutOpen = candidate.payments.some((payment) => payment.status === "PENDING");
    if (onlineCheckoutOpen && candidate.createdAt.getTime() > now.getTime() - PENDING_ONLINE_ORDER_TTL_MS) continue;

    const expired = await prisma.$transaction(async (tx) => {
      // The status guard makes this a no-op if Caja confirmed the payment meanwhile.
      const updated = await tx.order.updateMany({
        where: { id: candidate.id, status: "AWAITING_PAYMENT" },
        data: { status: "CANCELLED", cancellationReason: UNPAID_CANCELLATION_REASON, version: { increment: 1 } },
      });
      if (updated.count === 0) return false;

      await tx.paymentAttempt.updateMany({
        where: { orderId: candidate.id, status: { in: ["UNPAID", "PENDING"] } },
        data: { status: "REJECTED" },
      });
      await tx.orderStatusEvent.create({
        data: { orderId: candidate.id, fromStatus: "AWAITING_PAYMENT", toStatus: "CANCELLED", reason: UNPAID_CANCELLATION_REASON },
      });
      await tx.auditEvent.create({
        data: { action: "ORDER_EXPIRED_UNPAID", entityType: "Order", entityId: candidate.id, metadata: {} },
      });
      const order = await tx.order.findUniqueOrThrow({ where: { id: candidate.id }, select: { version: true } });
      await tx.$executeRaw`SELECT pg_notify('appqr_order_events', ${JSON.stringify({ type: "order.changed", orderId: candidate.id, version: order.version, occurredAt: now.toISOString() })})`;
      return true;
    });
    if (expired) cancelled += 1;
  }

  if (cancelled > 0) {
    console.info(JSON.stringify({ event: "stale-orders-cancelled", cancelled, timestamp: now.toISOString() }));
  }
  return { cancelled };
}
