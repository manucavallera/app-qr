import { describe, expect, it, vi } from "vitest";
import { PaymentService } from "./payment-service";

describe("PaymentService", () => {
  it("reuses a pending attempt instead of creating another checkout", async () => {
    const repository = {
      findOrderForCustomer: vi.fn().mockResolvedValue({ id: "order-1", totalCents: 5000, status: "AWAITING_PAYMENT", items: [{ productName: "Burger", quantity: 1, unitBaseCents: 5000 }] }),
      findOrderForCounter: vi.fn(),
      findOrCreateCheckoutAttempt: vi.fn().mockResolvedValue({ idempotencyKey: "key-1", providerOrderId: "mp-1", checkoutUrl: "https://pay.test/1" }),
      saveCheckout: vi.fn(),
      processGatewayUpdate: vi.fn(),
    };
    const gateway = { createCheckout: vi.fn(), getOrder: vi.fn() };
    const service = new PaymentService(repository, gateway, { appUrl: "https://bar.test", webhookUrl: "https://bar.test/api/webhook" });
    await expect(service.createCheckout("order-1", "session-1")).resolves.toEqual({ checkoutUrl: "https://pay.test/1", providerOrderId: "mp-1" });
    expect(gateway.createCheckout).not.toHaveBeenCalled();
  });

  it("creates a checkout for a counter order without a customer session", async () => {
    const repository = {
      findOrderForCustomer: vi.fn(),
      findOrderForCounter: vi.fn().mockResolvedValue({ id: "order-counter", totalCents: 5000, status: "AWAITING_PAYMENT", items: [{ productName: "Burger", quantity: 1, unitBaseCents: 5000 }] }),
      findOrCreateCheckoutAttempt: vi.fn().mockResolvedValue({ id: "attempt-counter", idempotencyKey: "counter-key", providerOrderId: null, checkoutUrl: null }),
      saveCheckout: vi.fn(),
      processGatewayUpdate: vi.fn(),
    };
    const gateway = { createCheckout: vi.fn().mockResolvedValue({ providerOrderId: "mp-counter", checkoutUrl: "https://pay.test/counter", raw: {} }), getOrder: vi.fn() };
    const service = new PaymentService(repository, gateway, { appUrl: "https://bar.test", webhookUrl: "https://bar.test/api/webhook" });

    await expect(service.createCounterCheckout("order-counter")).resolves.toEqual({ checkoutUrl: "https://pay.test/counter", providerOrderId: "mp-counter" });
    expect(repository.findOrderForCounter).toHaveBeenCalledWith("order-counter");
    expect(repository.findOrCreateCheckoutAttempt).toHaveBeenCalledWith("order-counter", null);
    expect(gateway.createCheckout).toHaveBeenCalledWith(expect.objectContaining({ externalReference: "attempt-counter" }));
  });
});
