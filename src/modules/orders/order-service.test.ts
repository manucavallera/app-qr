import { describe, expect, it, vi } from "vitest";
import { OrderService } from "./order-service";

const request = {
  clientRequestId: "123e4567-e89b-42d3-a456-426614174000",
  expectedTotalCents: 5100,
  paymentMethod: "CASH" as const,
  items: [{ productId: "123e4567-e89b-42d3-a456-426614174001", quantity: 1, optionValueIds: ["123e4567-e89b-42d3-a456-426614174002"] }],
};

describe("OrderService", () => {
  it("validates the customer payload before repository access", async () => {
    const repository = {
      createQrOrder: vi.fn(), createCounterOrder: vi.fn(), confirmTraditionalPayment: vi.fn(),
      findCustomerOrder: vi.fn(), listPendingTraditionalPayments: vi.fn(), listStaffOrders: vi.fn(),
    };
    const service = new OrderService(repository);
    await expect(service.createQrOrder({ ...request, items: [{ ...request.items[0]!, quantity: 21 }] }, "session-token", "198.51.100.1"))
      .rejects.toMatchObject({ name: "ZodError" });
    expect(repository.createQrOrder).not.toHaveBeenCalled();
  });

  it("normalizes the validated QR order input and passes the opaque session token and client IP", async () => {
    const order = { id: "order-1", status: "AWAITING_PAYMENT" };
    const repository = {
      createQrOrder: vi.fn().mockResolvedValue({ order, created: true }),
      createCounterOrder: vi.fn(),
      confirmTraditionalPayment: vi.fn(),
      findCustomerOrder: vi.fn(),
      listPendingTraditionalPayments: vi.fn(),
      listStaffOrders: vi.fn(),
    };
    const service = new OrderService(repository);

    await expect(service.createQrOrder({
      ...request,
      items: [{ ...request.items[0]!, notes: "  sin cebolla  " }],
    }, "raw-session-token", "203.0.113.9")).resolves.toEqual({ order, created: true });
    expect(repository.createQrOrder).toHaveBeenCalledWith({
      ...request,
      items: [{ ...request.items[0]!, notes: "sin cebolla" }],
    }, "raw-session-token", "203.0.113.9");
  });
});
