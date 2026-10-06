import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { DomainError } from "./errors";
import { summarizeTab, type SettleTabInput, type TabOrder } from "./tab-summary";

type Tx = Prisma.TransactionClient;

/** Pedidos de una cuenta que todavía hay que cobrar. */
const unpaidTabOrders = {
  status: { not: "CANCELLED" as const },
  payments: { some: { method: "ON_TAB" as const, status: "UNPAID" as const } },
} satisfies Prisma.OrderWhereInput;

const tabOrderSelect = {
  number: true,
  customerSessionId: true,
  customerName: true,
  totalCents: true,
  customerSession: { select: { nickname: true } },
  items: { select: { productName: true, quantity: true, lineTotalCents: true } },
} satisfies Prisma.OrderSelect;

type TabOrderRow = Prisma.OrderGetPayload<{ select: typeof tabOrderSelect }>;

function toTabOrder(row: TabOrderRow): TabOrder {
  return {
    number: row.number,
    customerSessionId: row.customerSessionId,
    personName: row.customerSession?.nickname ?? row.customerName ?? "Sin nombre",
    totalCents: row.totalCents,
    items: row.items,
  };
}

/** Filtro de pedidos de una persona, a partir de la clave que arma summarizeTab. */
function personFilter(personKey: string): Prisma.OrderWhereInput {
  return personKey.startsWith("name:")
    ? { customerSessionId: null, customerName: personKey.slice("name:".length) }
    : { customerSessionId: personKey };
}

/**
 * Cuenta abierta de la mesa, creándola si no hay. Bloquea la fila de la mesa para que dos
 * pedidos simultáneos no abran dos cuentas.
 */
export async function openTabForTable(tx: Tx, tableId: string): Promise<string> {
  await tx.$queryRaw`SELECT id FROM "DiningTable" WHERE id = ${tableId} FOR UPDATE`;
  const open = await tx.tableTab.findFirst({ where: { tableId, closedAt: null }, select: { id: true } });
  if (open) return open.id;
  return (await tx.tableTab.create({ data: { tableId }, select: { id: true } })).id;
}

/** Cierra la cuenta cuando ya no queda nada por cobrar (todo pagado o cancelado). */
export async function closeTabIfSettled(tx: Tx, tabId: string): Promise<boolean> {
  const remaining = await tx.order.count({ where: { tabId, ...unpaidTabOrders } });
  if (remaining > 0) return false;
  await tx.tableTab.updateMany({ where: { id: tabId, closedAt: null }, data: { closedAt: new Date() } });
  return true;
}


/** Un link de pago de Mercado Pago dura 2 horas; se reutiliza solo mientras siga vigente. */
const ONLINE_PAYMENT_REUSE_MS = 90 * 60 * 1000;

export type GatewayUpdate = { providerOrderId: string; externalReference: string; status: string; statusDetail: string; totalPaidCents: number; raw: unknown };

/**
 * Aplica el aviso de Mercado Pago a un pago online de cuenta. Devuelve false si el aviso no
 * corresponde a ninguno (es de un pedido común). Un pago acreditado cobra los pedidos que
 * cubría; si cambió algo en el medio queda en auditoría para que el personal lo revise.
 */
export async function applyTabPaymentUpdate(tx: Tx, update: GatewayUpdate): Promise<boolean> {
  const payment = await tx.tabPayment.findFirst({ where: { OR: [{ id: update.externalReference }, { providerOrderId: update.providerOrderId }] } });
  if (!payment) return false;
  const accredited = update.status === "processed" && update.statusDetail === "accredited";
  const failed = update.status === "processed" && ["rejected", "cancelled"].includes(update.statusDetail);
  const raw = update.raw as Prisma.InputJsonValue;

  if (failed) {
    if (payment.status === "PENDING") await tx.tabPayment.update({ where: { id: payment.id }, data: { status: "REJECTED", providerPayload: raw } });
    return true;
  }
  if (!accredited) {
    if (payment.status === "PENDING") await tx.tabPayment.update({ where: { id: payment.id }, data: { providerPayload: raw } });
    return true;
  }
  if (payment.status === "APPROVED") return true;

  await tx.$queryRaw`SELECT id FROM "TableTab" WHERE id = ${payment.tabId} FOR UPDATE`;
  const audit = (action: string, metadata: Prisma.InputJsonObject) =>
    tx.auditEvent.create({ data: { action, entityType: "TabPayment", entityId: payment.id, metadata: { tabId: payment.tabId, providerOrderId: update.providerOrderId, ...metadata } } });

  if (update.totalPaidCents !== payment.amountCents) {
    // Se cobró un monto que no es el de la cuenta: no se toca ningún pedido y hay que devolver todo lo cobrado.
    await tx.tabPayment.update({ where: { id: payment.id }, data: { status: "APPROVED", providerPayload: raw, refundDueCents: update.totalPaidCents } });
    await audit("TAB_PAYMENT_AMOUNT_MISMATCH", { expected: payment.amountCents, received: update.totalPaidCents, refundCents: update.totalPaidCents });
    await tx.$executeRaw`SELECT pg_notify('appqr_order_events', ${JSON.stringify({ type: "tab.changed", tabId: payment.tabId, occurredAt: new Date().toISOString() })})`;
    return true;
  }
  const attempts = await tx.paymentAttempt.findMany({
    where: { method: "ON_TAB", status: "UNPAID", orderId: { in: payment.orderIds }, order: { tabId: payment.tabId, status: { not: "CANCELLED" } } },
  });
  await tx.tabPayment.update({ where: { id: payment.id }, data: { status: "APPROVED", providerPayload: raw } });
  if (attempts.length > 0) {
    await tx.paymentAttempt.updateMany({ where: { id: { in: attempts.map((attempt) => attempt.id) } }, data: { method: "MERCADO_PAGO", status: "APPROVED" } });
  }
  const settledCents = attempts.reduce((sum, attempt) => sum + attempt.amountCents, 0);
  const closed = attempts.length > 0 && await closeTabIfSettled(tx, payment.tabId);
  if (settledCents !== payment.amountCents) {
    // Se cobró algo que ya no estaba pendiente (pagó el personal o se canceló un pedido): hay que devolver la diferencia.
    await tx.tabPayment.update({ where: { id: payment.id }, data: { refundDueCents: payment.amountCents - settledCents } });
    await audit("TAB_PAYMENT_NEEDS_REFUND", { paidCents: payment.amountCents, settledCents, refundCents: payment.amountCents - settledCents });
  } else {
    await audit("TAB_PAID_ONLINE", { amountCents: settledCents, orders: attempts.length, closed });
  }
  await tx.$executeRaw`SELECT pg_notify('appqr_order_events', ${JSON.stringify({ type: "tab.changed", tabId: payment.tabId, occurredAt: new Date().toISOString() })})`;
  return true;
}

export class PrismaTableTabRepository {
  constructor(private readonly db: PrismaClient) {}

  /** La cuenta que ve el cliente: solo sus propios pedidos y el total de la mesa. */
  async getCustomerTab(customerSessionId: string, tableId: string) {
    const [table, tab] = await Promise.all([
      this.db.diningTable.findUnique({ where: { id: tableId }, select: { label: true } }),
      this.db.tableTab.findFirst({
        where: { tableId, closedAt: null },
        select: { id: true, number: true, billRequestedAt: true, orders: { where: unpaidTabOrders, select: tabOrderSelect, orderBy: { createdAt: "asc" } } },
      }),
    ]);
    if (!table) throw new DomainError("TABLE_NOT_FOUND", "No encontramos la mesa.");
    const summary = summarizeTab((tab?.orders ?? []).map(toTabOrder));
    const mine = summary.people.find((person) => person.customerSessionId === customerSessionId);
    return {
      tableLabel: table.label,
      tabNumber: tab?.number ?? null,
      billRequestedAt: tab?.billRequestedAt ?? null,
      mine: mine ? { totalCents: mine.totalCents, orders: mine.orders } : { totalCents: 0, orders: [] },
      tableTotalCents: summary.totalCents,
    };
  }

  async requestBill(tableId: string): Promise<{ billRequestedAt: Date }> {
    return this.db.$transaction(async (tx) => {
      const tab = await tx.tableTab.findFirst({ where: { tableId, closedAt: null, orders: { some: unpaidTabOrders } }, select: { id: true, billRequestedAt: true } });
      if (!tab) throw new DomainError("TAB_EMPTY", "La mesa no tiene nada para pagar.");
      if (tab.billRequestedAt) return { billRequestedAt: tab.billRequestedAt };
      const billRequestedAt = new Date();
      await tx.tableTab.update({ where: { id: tab.id }, data: { billRequestedAt } });
      return { billRequestedAt };
    });
  }

  /** Al cerrar el horario del QR, toda cuenta abierta pasa a "pidió la cuenta" para que el staff la cobre. */
  async requestBillForOpenTabs(): Promise<number> {
    const result = await this.db.tableTab.updateMany({ where: { closedAt: null, billRequestedAt: null, orders: { some: unpaidTabOrders } }, data: { billRequestedAt: new Date() } });
    return result.count;
  }

  /**
   * Prepara el pago online de la parte del cliente o de toda la mesa: junta lo que falta cobrar y
   * reutiliza el pago pendiente igual si todavía sirve, para no abrir un link nuevo por cada toque.
   */
  async prepareOnlinePayment(input: { tableId: string; customerSessionId: string; scope: "mine" | "table" }) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "DiningTable" WHERE id = ${input.tableId} FOR UPDATE`;
      const tab = await tx.tableTab.findFirst({
        where: { tableId: input.tableId, closedAt: null },
        select: { id: true, table: { select: { label: true, qrToken: true } } },
      });
      if (!tab) throw new DomainError("TAB_EMPTY", "La mesa no tiene nada para pagar.");
      const orders = await tx.order.findMany({
        where: { tabId: tab.id, ...unpaidTabOrders, ...(input.scope === "mine" ? { customerSessionId: input.customerSessionId } : {}) },
        select: { id: true, number: true, payments: { where: { method: "ON_TAB", status: "UNPAID" }, select: { amountCents: true } } },
        orderBy: { createdAt: "asc" },
      });
      const lines = orders.map((order) => ({ orderId: order.id, number: order.number, amountCents: order.payments.reduce((sum, payment) => sum + payment.amountCents, 0) })).filter((line) => line.amountCents > 0);
      if (lines.length === 0) throw new DomainError("TAB_EMPTY", "No tenés nada para pagar.");
      const amountCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
      const orderIds = lines.map((line) => line.orderId).sort();
      const customerSessionId = input.scope === "mine" ? input.customerSessionId : null;
      const pending = await tx.tabPayment.findMany({
        where: { tabId: tab.id, status: "PENDING", customerSessionId, amountCents, createdAt: { gt: new Date(Date.now() - ONLINE_PAYMENT_REUSE_MS) } },
        orderBy: { createdAt: "desc" },
      });
      const reusable = pending.find((payment) => [...payment.orderIds].sort().join() === orderIds.join());
      const payment = reusable ?? await tx.tabPayment.create({ data: { tabId: tab.id, customerSessionId, orderIds, amountCents, idempotencyKey: randomUUID() } });
      return { payment, lines, tableLabel: tab.table.label, qrToken: tab.table.qrToken };
    });
  }

  /** Pagos online que cobraron de más y todavía no se devolvieron. */
  async listTabRefundsDue() {
    const payments = await this.db.tabPayment.findMany({
      where: { refundDueCents: { gt: 0 }, refundedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, refundDueCents: true, tab: { select: { table: { select: { label: true } } } } },
    });
    return payments.map((payment) => ({ id: payment.id, amountCents: payment.refundDueCents, tableLabel: payment.tab.table.label }));
  }

  /** Marca la devolución como hecha. Devuelve false si no existe o ya estaba devuelta. */
  async markTabRefundReturned(paymentId: string, staffId: string): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const claimed = await tx.tabPayment.updateMany({ where: { id: paymentId, refundDueCents: { gt: 0 }, refundedAt: null }, data: { refundedAt: new Date() } });
      if (claimed.count === 0) return false;
      await tx.auditEvent.create({ data: { actorStaffId: staffId, action: "TAB_PAYMENT_REFUNDED", entityType: "TabPayment", entityId: paymentId, metadata: {} } });
      return true;
    });
  }

  async saveOnlineCheckout(input: { paymentId: string; providerOrderId: string; checkoutUrl: string; raw: unknown }): Promise<void> {
    await this.db.tabPayment.update({
      where: { id: input.paymentId },
      data: { providerOrderId: input.providerOrderId, checkoutUrl: input.checkoutUrl, providerPayload: input.raw as Prisma.InputJsonValue },
    });
  }

  /** Cuentas abiertas; las que pidieron la cuenta van primero. */
  async listOpenTabs() {
    const tabs = await this.db.tableTab.findMany({
      where: { closedAt: null, orders: { some: unpaidTabOrders } },
      select: { id: true, number: true, openedAt: true, billRequestedAt: true, table: { select: { id: true, label: true } }, orders: { where: unpaidTabOrders, select: tabOrderSelect, orderBy: { createdAt: "asc" } } },
    });
    return tabs
      .map(({ orders, table, ...tab }) => ({ ...tab, tableId: table.id, label: table.label, ...summarizeTab(orders.map(toTabOrder)) }))
      .sort((a, b) => Number(Boolean(b.billRequestedAt)) - Number(Boolean(a.billRequestedAt)) || a.label.localeCompare(b.label, "es", { numeric: true }));
  }

  async settleTab(input: SettleTabInput, staffId: string): Promise<{ settledOrders: number; settledCents: number; closed: boolean }> {
    return this.db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "TableTab" WHERE id = ${input.tabId} FOR UPDATE`;
      if (locked.length === 0) throw new DomainError("TAB_NOT_FOUND", "No encontramos esa cuenta.");
      const payments = await tx.paymentAttempt.findMany({
        where: {
          method: "ON_TAB",
          status: "UNPAID",
          order: { tabId: input.tabId, status: { not: "CANCELLED" }, ...(input.personKey ? personFilter(input.personKey) : {}) },
        },
      });
      if (payments.length === 0) throw new DomainError("TAB_EMPTY", "No hay nada para cobrar en esta cuenta.");

      await tx.paymentAttempt.updateMany({
        where: { id: { in: payments.map((payment) => payment.id) } },
        data: { method: input.method, status: "APPROVED", confirmedByStaffId: staffId },
      });
      const settledCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
      const closed = await closeTabIfSettled(tx, input.tabId);
      await tx.auditEvent.create({
        data: {
          actorStaffId: staffId,
          action: "TAB_SETTLED",
          entityType: "TableTab",
          entityId: input.tabId,
          metadata: { method: input.method, settledCents, orders: payments.length, personKey: input.personKey ?? null, closed },
        },
      });
      await tx.$executeRaw`SELECT pg_notify('appqr_order_events', ${JSON.stringify({ type: "tab.changed", tabId: input.tabId, occurredAt: new Date().toISOString() })})`;
      return { settledOrders: payments.length, settledCents, closed };
    });
  }
}

export const tableTabRepository = new PrismaTableTabRepository(prisma);
