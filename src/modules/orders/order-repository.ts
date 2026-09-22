import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { hashToken } from "../../lib/security/token";
import { resolveServiceMode } from "../operations/service-mode";
import { DomainError } from "./errors";
import { calculateQuote, type OrderQuote, type QuoteProduct, type QuoteRequest } from "./quote";
import type { CreateCounterOrderInput, CreateQrOrderInput, ConfirmTraditionalPaymentInput } from "./order-contracts";
import { createCheckoutIdempotencyKey } from "../payments/payment-service";
import { availablePaymentMethods, type PaymentSettingsView } from "../payments/payment-methods";

type Tx = Prisma.TransactionClient;
const defaultPaymentSettings: PaymentSettingsView = {
  mercadoPagoEnabled: false,
  cashEnabled: true,
  cardAtCounterEnabled: true,
  bankTransferEnabled: false,
  bankAlias: null,
  bankCbuCvu: null,
  bankAccountHolder: null,
  bankInstructions: null,
};
const orderInclude = {
  table: { select: { id: true, label: true } },
  customerSession: { select: { id: true, nickname: true } },
  items: { include: { options: true } },
  payments: true,
  statusEvents: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.OrderInclude;

function paymentSettingsView(value: PaymentSettingsView | null): PaymentSettingsView {
  return value ?? defaultPaymentSettings;
}

function assertPaymentMethodAvailable(settings: PaymentSettingsView, method: CreateQrOrderInput["paymentMethod"]): void {
  if (!availablePaymentMethods(settings, { mercadoPagoConfigured: true }).includes(method)) {
    throw new DomainError("PAYMENT_METHOD_UNAVAILABLE", "Ese medio de pago no está disponible en este momento.");
  }
}

async function transactionTime(tx: Tx): Promise<Date> {
  const [row] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`;
  return row!.now;
}

async function findQuoteProducts(tx: Tx, items: QuoteRequest["items"]): Promise<QuoteProduct[]> {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    include: {
      category: true,
      optionGroups: {
        include: { values: true },
      },
    },
  });
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    priceCents: product.priceCents,
    available: product.available,
    visible: product.visible && product.category.visible,
    station: product.station,
    fulfillment: product.fulfillment,
    optionGroups: product.optionGroups.map((group) => ({
      id: group.id,
      name: group.name,
      required: group.required,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      values: group.values.map((value) => ({
        id: value.id,
        name: value.name,
        priceDeltaCents: value.priceDeltaCents,
        available: value.available,
      })),
    })),
  }));
}

function quoteOrReportFresh(request: QuoteRequest, products: readonly QuoteProduct[]): OrderQuote {
  try {
    return calculateQuote(request, products);
  } catch (error) {
    if (!(error instanceof DomainError) || error.code !== "TOTAL_MISMATCH") throw error;
    const actual = error.details?.actualTotalCents;
    if (typeof actual !== "number") throw error;
    const quote = calculateQuote({ ...request, expectedTotalCents: actual }, products);
    throw new DomainError("PRICE_CHANGED", "El precio se actualizó. Revisá el total nuevo antes de confirmar.", { quote });
  }
}

function quoteItemCreates(quote: OrderQuote) {
  return quote.items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    unitBaseCents: item.unitBaseCents,
    optionsTotalCents: item.optionsTotalCents,
    lineTotalCents: item.lineTotalCents,
    station: item.station,
    fulfillment: item.fulfillment,
    notes: item.notes,
    options: {
      create: item.options.map((option) => ({
        optionValueId: option.optionValueId,
        groupName: option.groupName,
        valueName: option.valueName,
        priceDeltaCents: option.priceDeltaCents,
      })),
    },
  }));
}

async function notifyOrderChanged(tx: Tx, payload: { id: string; number: number; status: string; version: number; tableId: string | null }) {
  await tx.$executeRaw`SELECT pg_notify('appqr_order_events', ${JSON.stringify({ type: "order.changed", orderId: payload.id, version: payload.version, occurredAt: new Date().toISOString() })})`;
}

async function idempotencyLock(tx: Tx, clientRequestId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${clientRequestId}))`;
}

async function consumeOrderRateLimit(tx: Tx, key: string): Promise<{ allowed: boolean; resetsAt: Date }> {
  const [bucket] = await tx.$queryRaw<Array<{ count: number; resetsAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetsAt", "updatedAt")
    VALUES (${key}, 1, CURRENT_TIMESTAMP + INTERVAL '1 hour', CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetsAt" <= CURRENT_TIMESTAMP THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetsAt" = CASE WHEN "RateLimitBucket"."resetsAt" <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP + INTERVAL '1 hour' ELSE "RateLimitBucket"."resetsAt" END,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "count", "resetsAt"
  `;
  return { allowed: bucket!.count <= 20, resetsAt: bucket!.resetsAt };
}

export class PrismaOrderRepository {
  constructor(private readonly db: PrismaClient) {}

  async createQrOrder(input: CreateQrOrderInput, sessionToken: string, clientIp: string): Promise<{ order: unknown; created: boolean }> {
    const tokenHash = hashToken(sessionToken);
    const outcome = await this.db.$transaction(async (tx) => {
      const now = await transactionTime(tx);
      const session = await tx.customerSession.findUnique({ where: { tokenHash }, include: { table: true } });
      if (!session || session.closedAt || session.expiresAt <= now || !session.table.active) {
        throw new DomainError("CUSTOMER_SESSION_EXPIRED", "Tu sesión venció. Volvé a escanear el QR para continuar.");
      }

      await idempotencyLock(tx, input.clientRequestId);
      const existing = await tx.order.findUnique({ where: { clientRequestId: input.clientRequestId }, include: orderInclude });
      if (existing) {
        if (existing.customerSessionId !== session.id || existing.origin !== "QR") {
          throw new DomainError("ORDER_REQUEST_CONFLICT", "No se pudo reutilizar esta solicitud.");
        }
        return { kind: "existing" as const, order: existing };
      }

      const rateKey = `qr-order:${session.id}:${hashToken(clientIp || "unknown")}`;
      const limit = await consumeOrderRateLimit(tx, rateKey);
      if (!limit.allowed) return { kind: "limited" as const, resetsAt: limit.resetsAt };

      const [settings, windows, paymentSettings] = await Promise.all([
        tx.businessSettings.findUnique({ where: { id: "default" } }),
        tx.serviceWindow.findMany(),
        tx.paymentSettings.findUnique({ where: { id: "default" } }),
      ]);
      const mode = settings
        ? resolveServiceMode(now, settings.timezone, windows, settings.manualMode)
        : "COUNTER_ONLY";
      if (mode !== "QR_OPEN") {
        throw new DomainError("QR_ORDERING_CLOSED", "La autogestión por QR está cerrada en este momento.", { mode });
      }

      const paymentConfiguration = paymentSettingsView(paymentSettings);
      assertPaymentMethodAvailable(paymentConfiguration, input.paymentMethod);

      const products = await findQuoteProducts(tx, input.items);
      const quote = quoteOrReportFresh(input, products);
      const order = await tx.order.create({
        data: {
          clientRequestId: input.clientRequestId,
          tableId: session.tableId,
          customerSessionId: session.id,
          origin: "QR",
          status: "AWAITING_PAYMENT",
          totalCents: quote.totalCents,
          items: { create: quoteItemCreates(quote) },
          payments: {
            create: {
              method: input.paymentMethod,
              status: "UNPAID",
              amountCents: quote.totalCents,
              idempotencyKey: `${input.clientRequestId}:initial`,
            },
          },
          statusEvents: { create: { fromStatus: null, toStatus: "AWAITING_PAYMENT" } },
        },
        include: orderInclude,
      });
      await notifyOrderChanged(tx, { id: order.id, number: order.number, status: order.status, version: order.version, tableId: order.tableId });
      return { kind: "created" as const, order };
    });

    if (outcome.kind === "limited") {
      throw new DomainError("RATE_LIMITED", "Alcanzaste el límite de intentos para crear pedidos.", { resetsAt: outcome.resetsAt });
    }
    return { order: outcome.order, created: outcome.kind === "created" };
  }

  async createCounterOrder(input: CreateCounterOrderInput, staffId: string): Promise<{ order: unknown; created: boolean }> {
    const outcome = await this.db.$transaction(async (tx) => {
      await idempotencyLock(tx, input.clientRequestId);
      const existing = await tx.order.findUnique({ where: { clientRequestId: input.clientRequestId }, include: orderInclude });
      if (existing) {
        if (existing.origin !== "COUNTER" || existing.createdByStaffId !== staffId) {
          throw new DomainError("ORDER_REQUEST_CONFLICT", "No se pudo reutilizar esta solicitud.");
        }
        return { order: existing, created: false };
      }

      if (input.tableId) {
        const table = await tx.diningTable.findFirst({ where: { id: input.tableId, active: true } });
        if (!table) throw new DomainError("TABLE_NOT_FOUND", "La mesa seleccionada no está activa.");
      }
      const paymentConfiguration = paymentSettingsView(await tx.paymentSettings.findUnique({ where: { id: "default" } }));
      assertPaymentMethodAvailable(paymentConfiguration, input.paymentMethod);
      const products = await findQuoteProducts(tx, input.items);
      const quote = quoteOrReportFresh(input, products);
      const order = await tx.order.create({
        data: {
          clientRequestId: input.clientRequestId,
          tableId: input.tableId,
          customerName: input.nickname,
          createdByStaffId: staffId,
          origin: "COUNTER",
          status: "CONFIRMED",
          totalCents: quote.totalCents,
          items: { create: quoteItemCreates(quote) },
          payments: {
            create: {
              method: input.paymentMethod,
              status: "APPROVED",
              amountCents: quote.totalCents,
              idempotencyKey: `${input.clientRequestId}:initial`,
              confirmedByStaffId: staffId,
            },
          },
          statusEvents: { create: { fromStatus: null, toStatus: "CONFIRMED", actorStaffId: staffId } },
        },
        include: orderInclude,
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: staffId,
          action: "ORDER_COUNTER_CREATED",
          entityType: "Order",
          entityId: order.id,
          metadata: { paymentMethod: input.paymentMethod, totalCents: order.totalCents },
        },
      });
      await notifyOrderChanged(tx, { id: order.id, number: order.number, status: order.status, version: order.version, tableId: order.tableId });
      return { order, created: true };
    });
    return outcome;
  }

  async confirmTraditionalPayment(orderId: string, input: ConfirmTraditionalPaymentInput, staffId: string): Promise<unknown> {
    return this.db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      if (locked.length === 0) throw new DomainError("ORDER_NOT_FOUND", "No encontramos ese pedido.");
      const order = await tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
      if (!order) throw new DomainError("ORDER_NOT_FOUND", "No encontramos ese pedido.");
      if (order.status === "CONFIRMED") {
        const approved = order.payments.find((attempt) => attempt.method === input.method && attempt.status === "APPROVED");
        if (approved) return order;
        throw new DomainError("PAYMENT_METHOD_MISMATCH", "El pedido ya fue confirmado con otro medio de pago.");
      }
      if (order.status !== "AWAITING_PAYMENT") {
        throw new DomainError("ORDER_NOT_AWAITING_PAYMENT", "El pedido ya no espera confirmación de pago.");
      }
      if (order.version !== input.expectedOrderVersion) {
        throw new DomainError("ORDER_VERSION_CONFLICT", "El pedido cambió. Actualizá la pantalla e intentá de nuevo.");
      }
      const payment = order.payments.find((attempt) => attempt.method === input.method && attempt.status === "UNPAID");
      if (!payment) throw new DomainError("PAYMENT_METHOD_MISMATCH", "El medio de pago no coincide con el pedido pendiente.");

      await tx.paymentAttempt.update({
        where: { id: payment.id },
        data: { status: "APPROVED", confirmedByStaffId: staffId },
      });
      const confirmed = await tx.order.update({
        where: { id: order.id },
        data: { status: "CONFIRMED", version: { increment: 1 } },
        include: orderInclude,
      });
      await tx.orderStatusEvent.create({
        data: { orderId, fromStatus: "AWAITING_PAYMENT", toStatus: "CONFIRMED", actorStaffId: staffId },
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: staffId,
          action: "PAYMENT_TRADITIONAL_CONFIRMED",
          entityType: "Order",
          entityId: orderId,
          metadata: { method: input.method, amountCents: payment.amountCents },
        },
      });
      await notifyOrderChanged(tx, { id: confirmed.id, number: confirmed.number, status: confirmed.status, version: confirmed.version, tableId: confirmed.tableId });
      return confirmed;
    });
  }

  findCustomerOrder(orderId: string, customerSessionId: string) {
    return this.db.order.findFirst({
      where: { id: orderId, customerSessionId, origin: "QR" },
      include: orderInclude,
    });
  }

  async listPendingTraditionalPayments() {
    return this.db.order.findMany({
      where: {
        status: "AWAITING_PAYMENT",
        payments: { some: { status: "UNPAID", method: { in: ["CASH", "CARD_AT_COUNTER", "BANK_TRANSFER"] } } },
      },
      orderBy: { createdAt: "asc" },
      include: orderInclude,
    });
  }

  async rejectTraditionalPayment(orderId: string, input: { reason: string; expectedOrderVersion: number }, staffId: string): Promise<unknown> {
    return this.db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      if (locked.length === 0) throw new DomainError("ORDER_NOT_FOUND", "No encontramos ese pedido.");
      const order = await tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
      if (!order) throw new DomainError("ORDER_NOT_FOUND", "No encontramos ese pedido.");
      if (order.status === "CANCELLED" && order.cancellationReason === input.reason) return order;
      if (order.status !== "AWAITING_PAYMENT") throw new DomainError("ORDER_NOT_AWAITING_PAYMENT", "El pedido ya no espera confirmación de pago.");
      if (order.version !== input.expectedOrderVersion) throw new DomainError("ORDER_VERSION_CONFLICT", "El pedido cambió. Actualizá la pantalla e intentá de nuevo.");

      const payment = order.payments.find((attempt) => attempt.status === "UNPAID" && ["CASH", "CARD_AT_COUNTER", "BANK_TRANSFER"].includes(attempt.method));
      if (!payment) throw new DomainError("PAYMENT_NOT_FOUND", "No encontramos un pago manual pendiente para este pedido.");
      await tx.paymentAttempt.update({ where: { id: payment.id }, data: { status: "REJECTED", confirmedByStaffId: staffId } });
      const cancelled = await tx.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED", cancellationReason: input.reason, version: { increment: 1 } },
        include: orderInclude,
      });
      await tx.orderStatusEvent.create({ data: { orderId, fromStatus: "AWAITING_PAYMENT", toStatus: "CANCELLED", actorStaffId: staffId, reason: input.reason } });
      await tx.auditEvent.create({ data: { actorStaffId: staffId, action: "PAYMENT_TRADITIONAL_REJECTED", entityType: "Order", entityId: orderId, metadata: { method: payment.method, reason: input.reason } } });
      await notifyOrderChanged(tx, { id: cancelled.id, number: cancelled.number, status: cancelled.status, version: cancelled.version, tableId: cancelled.tableId });
      return cancelled;
    });
  }

  async listStaffOrders() {
    return this.db.order.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: orderInclude });
  }

  async findOrderForCustomer(orderId: string, customerSessionId: string) {
    return this.db.order.findFirst({
      where: { id: orderId, customerSessionId, origin: "QR" },
      include: { items: true },
    });
  }

  async findOrCreateCheckoutAttempt(orderId: string, customerSessionId: string) {
    return this.db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, customerSessionId, origin: "QR" }, include: { payments: true } });
      if (!order) return null;
      const existing = order.payments.find((payment) => payment.method === "MERCADO_PAGO" && ["PENDING", "APPROVED"].includes(payment.status));
      if (existing) return { id: existing.id, idempotencyKey: existing.idempotencyKey, providerOrderId: existing.providerOrderId, checkoutUrl: typeof existing.providerPayload === "object" && existing.providerPayload !== null && "checkoutUrl" in existing.providerPayload ? String((existing.providerPayload as { checkoutUrl?: unknown }).checkoutUrl ?? "") : null };
      const created = await tx.paymentAttempt.create({ data: { orderId, method: "MERCADO_PAGO", status: "PENDING", amountCents: order.totalCents, idempotencyKey: createCheckoutIdempotencyKey() } });
      return { id: created.id, idempotencyKey: created.idempotencyKey, providerOrderId: created.providerOrderId, checkoutUrl: null };
    });
  }

  async saveCheckout(input: { attemptId: string; providerOrderId: string; checkoutUrl: string; raw: unknown }): Promise<void> {
    await this.db.paymentAttempt.update({ where: { id: input.attemptId }, data: { providerOrderId: input.providerOrderId, providerPayload: { raw: input.raw as Prisma.InputJsonValue, checkoutUrl: input.checkoutUrl } } });
  }

  async processGatewayUpdate(input: { providerOrderId: string; externalReference: string; status: string; statusDetail: string; totalPaidCents: number; raw: unknown }) {
    return this.db.$transaction(async (tx) => {
      const attempt = await tx.paymentAttempt.findUnique({ where: { providerOrderId: input.providerOrderId }, include: { order: true } });
      if (!attempt || attempt.order.id !== input.externalReference) throw new DomainError("PAYMENT_NOT_FOUND", "No encontramos el pago asociado.");
      if (attempt.amountCents !== input.totalPaidCents && input.status === "processed" && input.statusDetail === "accredited") {
        await tx.auditEvent.create({ data: { action: "PAYMENT_AMOUNT_MISMATCH", entityType: "PaymentAttempt", entityId: attempt.id, metadata: { expected: attempt.amountCents, received: input.totalPaidCents, providerOrderId: input.providerOrderId } } });
        return tx.order.findUnique({ where: { id: attempt.orderId }, include: orderInclude });
      }
      if (input.status === "processed" && input.statusDetail === "accredited") {
        if (attempt.status !== "APPROVED") {
          await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "APPROVED", providerPayload: input.raw as Prisma.InputJsonValue } });
          if (attempt.order.status === "AWAITING_PAYMENT") {
            const order = await tx.order.update({ where: { id: attempt.orderId }, data: { status: "CONFIRMED", version: { increment: 1 } }, include: orderInclude });
            await tx.orderStatusEvent.create({ data: { orderId: attempt.orderId, fromStatus: "AWAITING_PAYMENT", toStatus: "CONFIRMED" } });
            await notifyOrderChanged(tx, { id: order.id, number: order.number, status: order.status, version: order.version, tableId: order.tableId });
          }
        }
      } else if (input.status === "processed" && ["rejected", "cancelled"].includes(input.statusDetail) && attempt.status !== "REJECTED") {
        await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "REJECTED", providerPayload: input.raw as Prisma.InputJsonValue } });
      } else if (attempt.status === "PENDING") {
        await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { providerPayload: input.raw as Prisma.InputJsonValue } });
      }
      return tx.order.findUnique({ where: { id: attempt.orderId }, include: orderInclude });
    });
  }
}

export const orderRepository = new PrismaOrderRepository(prisma);
