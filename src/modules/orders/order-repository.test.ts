import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/db", () => ({ prisma: {} }));

import { loadQrOrderConfiguration, PrismaOrderRepository } from "./order-repository";

function sequentialQuery<T>(value: T, calls: string[], name: string) {
  return async () => {
    calls.push(`${name}:start`);
    await new Promise((resolve) => setTimeout(resolve, 1));
    calls.push(`${name}:end`);
    return value;
  };
}

describe("loadQrOrderConfiguration", () => {
  it("does not queue concurrent queries on an interactive transaction client", async () => {
    const calls: string[] = [];
    const result = await loadQrOrderConfiguration({
      businessSettings: { findUnique: sequentialQuery({ id: "default" }, calls, "settings") },
      serviceWindow: { findMany: sequentialQuery([], calls, "windows") },
      paymentSettings: { findUnique: sequentialQuery({ id: "default" }, calls, "payments") },
    } as never);

    expect(result).toEqual({ settings: { id: "default" }, windows: [], paymentSettings: { id: "default" } });
    expect(calls).toEqual([
      "settings:start", "settings:end",
      "windows:start", "windows:end",
      "payments:start", "payments:end",
    ]);
  });
});

describe("PrismaOrderRepository", () => {
  async function createCounterOrder(paymentMethod: "CASH" | "BANK_TRANSFER" | "MERCADO_PAGO") {
    let createData: Record<string, unknown> | undefined;
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue([]),
      order: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => {
          createData = data;
          return { id: "order-1", number: 1, status: data.status, version: 1, tableId: null, totalCents: data.totalCents };
        }),
      },
      paymentSettings: {
        findUnique: vi.fn().mockResolvedValue({
          mercadoPagoEnabled: paymentMethod === "MERCADO_PAGO",
          cashEnabled: true,
          cardAtCounterEnabled: true,
          bankTransferEnabled: paymentMethod === "BANK_TRANSFER",
          bankAlias: "bar.alias",
          bankCbuCvu: null,
          bankAccountHolder: null,
          bankInstructions: null,
        }),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([{
          id: "f5c7bbcf-cbde-4a55-a3c4-a829f21691de",
          name: "Hamburguesa",
          priceCents: 5000,
          available: true,
          visible: true,
          category: { visible: true },
          station: "KITCHEN",
          fulfillment: "PICKUP",
          optionGroups: [],
        }]),
      },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const repository = new PrismaOrderRepository({
      $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    } as never);

    await repository.createCounterOrder({
      clientRequestId: "a245d56e-d0c7-495e-9075-7b34ccdc2a80",
      expectedTotalCents: 5000,
      paymentMethod,
      nickname: "Ana",
      items: [{ productId: "f5c7bbcf-cbde-4a55-a3c4-a829f21691de", quantity: 1, optionValueIds: [] }],
    }, "staff-1");

    return createData;
  }

  it("auto-approves a CASH counter order", async () => {
    const createData = await createCounterOrder("CASH");

    expect(createData).toMatchObject({
      status: "CONFIRMED",
      payments: { create: { method: "CASH", status: "APPROVED", amountCents: 5000, confirmedByStaffId: "staff-1" } },
      statusEvents: { create: { fromStatus: null, toStatus: "CONFIRMED", actorStaffId: "staff-1" } },
    });
  });

  it.each(["BANK_TRANSFER", "MERCADO_PAGO"] as const)("keeps %s counter orders awaiting payment", async (paymentMethod) => {
    const createData = await createCounterOrder(paymentMethod);

    expect(createData).toMatchObject({
      status: "AWAITING_PAYMENT",
      payments: { create: { method: paymentMethod, status: "UNPAID", amountCents: 5000 } },
      statusEvents: { create: { fromStatus: null, toStatus: "AWAITING_PAYMENT", actorStaffId: "staff-1" } },
    });
    const payment = (createData?.payments as { create?: { confirmedByStaffId?: string } } | undefined)?.create;
    expect(payment?.confirmedByStaffId).toBeUndefined();
  });
});
