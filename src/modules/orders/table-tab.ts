import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { DomainError } from "./errors";
import { summarizeTab, type SettleTabInput, type TabOrder } from "./tab-summary";

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

export class PrismaTableTabRepository {
  constructor(private readonly db: PrismaClient) {}

  /** La cuenta que ve el cliente: solo sus propios pedidos y el total de la mesa. */
  async getCustomerTab(customerSessionId: string, tableId: string) {
    const [table, rows] = await Promise.all([
      this.db.diningTable.findUnique({ where: { id: tableId }, select: { label: true, billRequestedAt: true } }),
      this.db.order.findMany({ where: { tableId, ...unpaidTabOrders }, select: tabOrderSelect, orderBy: { createdAt: "asc" } }),
    ]);
    if (!table) throw new DomainError("TABLE_NOT_FOUND", "No encontramos la mesa.");
    const summary = summarizeTab(rows.map(toTabOrder));
    const mine = summary.people.find((person) => person.customerSessionId === customerSessionId);
    return {
      tableLabel: table.label,
      billRequestedAt: table.billRequestedAt,
      mine: mine ? { totalCents: mine.totalCents, orders: mine.orders } : { totalCents: 0, orders: [] },
      tableTotalCents: summary.totalCents,
    };
  }

  async requestBill(tableId: string): Promise<{ billRequestedAt: Date }> {
    return this.db.$transaction(async (tx) => {
      const open = await tx.order.count({ where: { tableId, ...unpaidTabOrders } });
      if (open === 0) throw new DomainError("TAB_EMPTY", "La mesa no tiene nada para pagar.");
      const table = await tx.diningTable.findUnique({ where: { id: tableId }, select: { billRequestedAt: true } });
      if (table?.billRequestedAt) return { billRequestedAt: table.billRequestedAt };
      const updated = await tx.diningTable.update({ where: { id: tableId }, data: { billRequestedAt: new Date() }, select: { billRequestedAt: true } });
      return { billRequestedAt: updated.billRequestedAt! };
    });
  }

  /** Mesas con cuenta abierta; las que pidieron la cuenta van primero. */
  async listOpenTabs() {
    const rows = await this.db.order.findMany({
      where: { tableId: { not: null }, ...unpaidTabOrders },
      select: { ...tabOrderSelect, table: { select: { id: true, label: true, billRequestedAt: true } } },
      orderBy: { createdAt: "asc" },
    });
    const tables = new Map<string, { id: string; label: string; billRequestedAt: Date | null; orders: TabOrder[] }>();
    for (const row of rows) {
      if (!row.table) continue;
      const entry = tables.get(row.table.id) ?? { ...row.table, orders: [] };
      entry.orders.push(toTabOrder(row));
      tables.set(row.table.id, entry);
    }
    return [...tables.values()]
      .map(({ orders, ...table }) => ({ ...table, ...summarizeTab(orders) }))
      .sort((a, b) => Number(Boolean(b.billRequestedAt)) - Number(Boolean(a.billRequestedAt)) || a.label.localeCompare(b.label, "es", { numeric: true }));
  }

  async settleTab(input: SettleTabInput, staffId: string): Promise<{ settledOrders: number; settledCents: number }> {
    return this.db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "DiningTable" WHERE id = ${input.tableId} FOR UPDATE`;
      if (locked.length === 0) throw new DomainError("TABLE_NOT_FOUND", "No encontramos la mesa.");
      const payments = await tx.paymentAttempt.findMany({
        where: {
          method: "ON_TAB",
          status: "UNPAID",
          order: { tableId: input.tableId, status: { not: "CANCELLED" }, ...(input.customerSessionId ? { customerSessionId: input.customerSessionId } : {}) },
        },
      });
      if (payments.length === 0) throw new DomainError("TAB_EMPTY", "No hay nada para cobrar en esta cuenta.");

      for (const payment of payments) {
        await tx.paymentAttempt.update({
          where: { id: payment.id },
          data: { method: input.method, status: "APPROVED", confirmedByStaffId: staffId },
        });
      }
      const settledCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
      const remaining = await tx.order.count({ where: { tableId: input.tableId, ...unpaidTabOrders } });
      if (remaining === 0) await tx.diningTable.update({ where: { id: input.tableId }, data: { billRequestedAt: null } });
      await tx.auditEvent.create({
        data: {
          actorStaffId: staffId,
          action: "TAB_SETTLED",
          entityType: "DiningTable",
          entityId: input.tableId,
          metadata: { method: input.method, settledCents, orders: payments.length, customerSessionId: input.customerSessionId ?? null },
        },
      });
      await tx.$executeRaw`SELECT pg_notify('appqr_order_events', ${JSON.stringify({ type: "tab.changed", tableId: input.tableId, occurredAt: new Date().toISOString() })})`;
      return { settledOrders: payments.length, settledCents };
    });
  }
}

export const tableTabRepository = new PrismaTableTabRepository(prisma);
