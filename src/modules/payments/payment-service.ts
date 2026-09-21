import { randomUUID } from "node:crypto";
import { DomainError } from "../orders/errors";
import type { PaymentGateway } from "./payment-gateway";

export type PaymentOrder = Readonly<{
  id: string;
  status: string;
  totalCents: number;
  items: readonly { productName: string; quantity: number; unitBaseCents: number; optionsTotalCents?: number }[];
}>;

export type PaymentRepository = {
  findOrderForCustomer(orderId: string, customerSessionId: string): Promise<PaymentOrder | null>;
  findOrCreateCheckoutAttempt(orderId: string, customerSessionId: string): Promise<{ id: string; idempotencyKey: string; providerOrderId: string | null; checkoutUrl: string | null } | null>;
  saveCheckout(input: { attemptId: string; providerOrderId: string; checkoutUrl: string; raw: unknown }): Promise<void>;
  processGatewayUpdate(input: { providerOrderId: string; externalReference: string; status: string; statusDetail: string; totalPaidCents: number; raw: unknown }): Promise<unknown>;
};

export class PaymentService {
  constructor(
    private readonly repository: PaymentRepository,
    private readonly gateway: PaymentGateway,
    private readonly urls: { appUrl: string; webhookUrl: string },
  ) {}

  async createCheckout(orderId: string, customerSessionId: string): Promise<{ checkoutUrl: string; providerOrderId: string }> {
    const order = await this.repository.findOrderForCustomer(orderId, customerSessionId);
    if (!order) throw new DomainError("ORDER_NOT_FOUND", "No encontramos ese pedido.");
    if (order.status !== "AWAITING_PAYMENT") throw new DomainError("ORDER_NOT_AWAITING_PAYMENT", "Este pedido ya no espera un pago.");
    const attempt = await this.repository.findOrCreateCheckoutAttempt(order.id, customerSessionId);
    if (!attempt) throw new DomainError("PAYMENT_ATTEMPT_NOT_FOUND", "No pudimos preparar el pago.");
    if (attempt.providerOrderId && attempt.checkoutUrl) return { providerOrderId: attempt.providerOrderId, checkoutUrl: attempt.checkoutUrl };
    const checkout = await this.gateway.createCheckout({
      externalReference: order.id,
      idempotencyKey: attempt.idempotencyKey,
      totalCents: order.totalCents,
      items: order.items.map((item) => ({ title: item.productName, quantity: item.quantity, unitPriceCents: item.unitBaseCents + (item.optionsTotalCents ?? 0) })),
      notificationUrl: this.urls.webhookUrl,
      successUrl: `${this.urls.appUrl}/payment/return?order=${encodeURIComponent(order.id)}&status=success`,
      failureUrl: `${this.urls.appUrl}/payment/return?order=${encodeURIComponent(order.id)}&status=failure`,
      pendingUrl: `${this.urls.appUrl}/payment/return?order=${encodeURIComponent(order.id)}&status=pending`,
    });
    await this.repository.saveCheckout({ attemptId: attempt.id, providerOrderId: checkout.providerOrderId, checkoutUrl: checkout.checkoutUrl, raw: checkout.raw });
    return { providerOrderId: checkout.providerOrderId, checkoutUrl: checkout.checkoutUrl };
  }
}

export function createCheckoutIdempotencyKey(): string {
  return randomUUID();
}
