import { describe, expect, it } from "vitest";
import { FakePaymentGateway } from "./fake-payment-gateway";

describe("FakePaymentGateway", () => {
  it("creates an idempotent checkout and can approve it", async () => {
    const gateway = new FakePaymentGateway();
    const input = { externalReference: "order-1", idempotencyKey: "key-1", totalCents: 5000, items: [{ title: "Burger", quantity: 1, unitPriceCents: 5000 }], notificationUrl: "http://localhost/webhook", successUrl: "http://localhost/success", failureUrl: "http://localhost/failure", pendingUrl: "http://localhost/pending" };
    const first = await gateway.createCheckout(input);
    const retry = await gateway.createCheckout(input);
    expect(retry).toEqual(first);
    gateway.approve(first.providerOrderId);
    await expect(gateway.getOrder(first.providerOrderId)).resolves.toMatchObject({ status: "processed", statusDetail: "accredited", totalPaidCents: 5000, externalReference: "order-1" });
  });
});
