import { createHash } from "node:crypto";
import type { CheckoutInput, PaymentGateway, RemotePaymentOrder } from "./payment-gateway";

export class FakePaymentGateway implements PaymentGateway {
  private readonly orders = new Map<string, { providerOrderId: string; externalReference: string; status: string; statusDetail: string; totalPaidCents: number; raw: unknown; input: CheckoutInput }>();
  private readonly idempotency = new Map<string, string>();

  async createCheckout(input: CheckoutInput) {
    const existing = this.idempotency.get(input.idempotencyKey);
    if (existing) {
      const order = this.orders.get(existing)!;
      return { providerOrderId: order.providerOrderId, checkoutUrl: `http://fake-payments.local/checkout/${order.providerOrderId}`, raw: order.raw };
    }
    const providerOrderId = `fake-${createHash("sha256").update(`${input.externalReference}:${input.idempotencyKey}`).digest("hex").slice(0, 24)}`;
    const remote: RemotePaymentOrder & { input: CheckoutInput } = {
      providerOrderId,
      externalReference: input.externalReference,
      status: "created",
      statusDetail: "pending",
      totalPaidCents: 0,
      raw: { provider: "fake", totalCents: input.totalCents },
      input,
    };
    this.orders.set(providerOrderId, remote);
    this.idempotency.set(input.idempotencyKey, providerOrderId);
    return { providerOrderId, checkoutUrl: `http://fake-payments.local/checkout/${providerOrderId}`, raw: remote.raw };
  }

  async getOrder(providerOrderId: string): Promise<RemotePaymentOrder> {
    const order = this.orders.get(providerOrderId);
    if (!order) throw new Error("Fake payment order not found");
    return { providerOrderId: order.providerOrderId, externalReference: order.externalReference, status: order.status, statusDetail: order.statusDetail, totalPaidCents: order.totalPaidCents, raw: order.raw };
  }

  approve(providerOrderId: string): void {
    const order = this.orders.get(providerOrderId);
    if (!order) throw new Error("Fake payment order not found");
    order.status = "processed";
    order.statusDetail = "accredited";
    order.totalPaidCents = order.input.totalCents;
  }

  reject(providerOrderId: string): void {
    const order = this.orders.get(providerOrderId);
    if (!order) throw new Error("Fake payment order not found");
    order.status = "processed";
    order.statusDetail = "rejected";
  }
}
