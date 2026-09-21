import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { assertOrderTransition, type OrderStatus, type StaffRole } from "./order-state";
import type { CommandRepository } from "./command-service";
import type { ItemTransitionInput, OrderTransitionInput } from "./command-contracts";
import { DomainError } from "./errors";

const commandInclude = {
  table: { select: { label: true } },
  customerSession: { select: { nickname: true } },
  items: { include: { options: true } },
} satisfies Prisma.OrderInclude;

const itemTransitions: Record<string, readonly string[]> = {
  QUEUED: ["PREPARING"],
  PREPARING: ["READY"],
  READY: ["DELIVERED"],
  DELIVERED: [],
};

export class PrismaCommandRepository implements CommandRepository {
  constructor(private readonly db: PrismaClient) {}

  async listCommands(station: "GENERAL" | "KITCHEN" | "BAR") {
    return this.db.order.findMany({
      where: {
        status: { in: ["CONFIRMED", "PREPARING", "READY"] },
        ...(station === "GENERAL" ? {} : { items: { some: { station } } }),
      },
      orderBy: { createdAt: "asc" },
      include: commandInclude,
    });
  }

  async transitionOrder(orderId: string, input: OrderTransitionInput, actorStaffId: string, role: StaffRole) {
    return this.db.$transaction(async (tx) => {
      const current = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!current) throw new DomainError("ORDER_NOT_FOUND", "No encontramos ese pedido.");
      if (current.version !== input.expectedVersion) throw new DomainError("ORDER_VERSION_CONFLICT", "El pedido cambió. Actualizá la pantalla.");
      assertOrderTransition(current.status as OrderStatus, input.targetStatus as OrderStatus, role, input.reason);
      const updated = await tx.order.update({ where: { id: orderId }, data: { status: input.targetStatus, version: { increment: 1 }, cancellationReason: input.targetStatus === "CANCELLED" ? input.reason : undefined }, include: commandInclude });
      await tx.orderStatusEvent.create({ data: { orderId, fromStatus: current.status, toStatus: input.targetStatus, actorStaffId, reason: input.reason } });
      await tx.auditEvent.create({ data: { actorStaffId, action: "ORDER_STATUS_CHANGED", entityType: "Order", entityId: orderId, metadata: { from: current.status, to: input.targetStatus } } });
      return updated;
    });
  }

  async transitionItem(itemId: string, input: ItemTransitionInput, actorStaffId: string) {
    return this.db.$transaction(async (tx) => {
      const item = await tx.orderItem.findUnique({ where: { id: itemId }, include: { order: true } });
      if (!item) throw new DomainError("ORDER_ITEM_NOT_FOUND", "No encontramos ese ítem.");
      if (item.order.version !== input.expectedOrderVersion) throw new DomainError("ORDER_VERSION_CONFLICT", "El pedido cambió. Actualizá la pantalla.");
      if (!itemTransitions[item.status]?.includes(input.targetStatus)) throw new DomainError("INVALID_ITEM_TRANSITION", "El estado del ítem no permite esa transición.");
      await tx.orderItem.update({ where: { id: itemId }, data: { status: input.targetStatus } });
      const items = await tx.orderItem.findMany({ where: { orderId: item.orderId } });
      const targetOrderStatus = items.every((row) => row.status === "DELIVERED") ? "DELIVERED" : items.every((row) => row.status === "READY") ? "READY" : items.some((row) => row.status === "PREPARING") ? "PREPARING" : item.order.status;
      const shouldUpdateOrder = targetOrderStatus !== item.order.status && ["CONFIRMED", "PREPARING", "READY"].includes(item.order.status);
      const order = shouldUpdateOrder ? await tx.order.update({ where: { id: item.orderId, version: input.expectedOrderVersion }, data: { status: targetOrderStatus as never, version: { increment: 1 } }, include: commandInclude }) : await tx.order.findUnique({ where: { id: item.orderId }, include: commandInclude });
      if (!order) throw new DomainError("ORDER_VERSION_CONFLICT", "El pedido cambió. Actualizá la pantalla.");
      if (shouldUpdateOrder) await tx.orderStatusEvent.create({ data: { orderId: item.orderId, fromStatus: item.order.status, toStatus: targetOrderStatus as never, actorStaffId } });
      return order;
    });
  }
}

export const commandRepository = new PrismaCommandRepository(prisma);
