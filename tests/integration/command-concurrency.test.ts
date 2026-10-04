import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/modules/auth/password";
import { commandRepository } from "@/modules/orders/command-repository";

const unique = randomUUID();
const orderIds: string[] = [];
let actorId = "";
let categoryId = "";

async function confirmedOrder() {
  const order = await prisma.order.create({ data: { clientRequestId: `concurrency-${randomUUID()}`, origin: "COUNTER", totalCents: 1000, status: "CONFIRMED" } });
  orderIds.push(order.id);
  return order;
}

describe("command board concurrency", () => {
  beforeAll(async () => {
    actorId = (await prisma.staffUser.create({ data: { email: `concurrency-${unique}@local.test`, displayName: "Operador", passwordHash: await hashPassword("integration password"), role: "OPERATOR" } })).id;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { actorStaffId: actorId } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    if (categoryId) {
      await prisma.product.deleteMany({ where: { categoryId } });
      await prisma.category.deleteMany({ where: { id: categoryId } });
    }
    await prisma.staffUser.deleteMany({ where: { id: actorId } });
  });

  it("lets only one of several operators move the same order from the same version", async () => {
    for (let round = 0; round < 5; round++) {
      const order = await confirmedOrder();
      const results = await Promise.allSettled(Array.from({ length: 6 }, () => commandRepository.transitionOrder(order.id, { targetStatus: "PREPARING", expectedVersion: order.version }, actorId, "OPERATOR")));
      const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(failures.every((failure) => failure.reason?.code === "ORDER_VERSION_CONFLICT")).toBe(true);
      const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(after.status).toBe("PREPARING");
      expect(after.version).toBe(order.version + 1);
      expect(await prisma.orderStatusEvent.count({ where: { orderId: order.id } })).toBe(1);
    }
  });

  it("rejects a stale version after the order already moved on", async () => {
    const order = await confirmedOrder();
    await commandRepository.transitionOrder(order.id, { targetStatus: "PREPARING", expectedVersion: order.version }, actorId, "OPERATOR");
    await expect(commandRepository.transitionOrder(order.id, { targetStatus: "READY", expectedVersion: order.version }, actorId, "OPERATOR")).rejects.toMatchObject({ code: "ORDER_VERSION_CONFLICT" });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PREPARING");
  });

  it("returns stock only once when several operators cancel the same order", async () => {
    categoryId = (await prisma.category.create({ data: { name: `Concurrencia ${unique}` } })).id;
    const product = await prisma.product.create({ data: { categoryId, name: "Con stock", description: "x", priceCents: 1000, stockQuantity: 5 } });
    const order = await confirmedOrder();
    await prisma.orderItem.create({ data: { orderId: order.id, productId: product.id, productName: "Con stock", quantity: 2, unitBaseCents: 1000, optionsTotalCents: 0, lineTotalCents: 2000, station: "GENERAL", fulfillment: "TABLE" } });

    const results = await Promise.allSettled(Array.from({ length: 4 }, () => commandRepository.transitionOrder(order.id, { targetStatus: "CANCELLED", expectedVersion: order.version, reason: "Prueba" }, actorId, "ADMIN")));

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockQuantity).toBe(7);
  });
});
