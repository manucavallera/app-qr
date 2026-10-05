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
