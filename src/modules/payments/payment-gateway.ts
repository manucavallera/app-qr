export type CheckoutInput = Readonly<{
  externalReference: string;
  idempotencyKey: string;
  totalCents: number;
  items: readonly { title: string; quantity: number; unitPriceCents: number }[];
  notificationUrl: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
}>;

export type RemotePaymentOrder = Readonly<{
  providerOrderId: string;
  externalReference: string;
  status: string;
  statusDetail: string;
  totalPaidCents: number;
  raw: unknown;
}>;

export interface PaymentGateway {
  createCheckout(input: CheckoutInput): Promise<{ providerOrderId: string; checkoutUrl: string; raw: unknown }>;
  getOrder(providerOrderId: string): Promise<RemotePaymentOrder>;
}
