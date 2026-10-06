import { DomainError } from "../orders/errors";
import type { PaymentGateway } from "./payment-gateway";
import type { PaymentSettingsView } from "./payment-methods";

export type PreparedTabPayment = Readonly<{
  payment: { id: string; idempotencyKey: string; amountCents: number; checkoutUrl: string | null; providerOrderId: string | null };
  lines: readonly { orderId: string; number: number; amountCents: number }[];
  tableLabel: string;
  qrToken: string;
}>;

export type TabPaymentRepository = {
  prepareOnlinePayment(input: { tableId: string; customerSessionId: string; scope: "mine" | "table" }): Promise<PreparedTabPayment>;
  saveOnlineCheckout(input: { paymentId: string; providerOrderId: string; checkoutUrl: string; raw: unknown }): Promise<void>;
};

/** El cliente paga su parte o la mesa entera con Mercado Pago; el aviso del webhook cobra los pedidos. */
export class TabPaymentService {
  constructor(
    private readonly repository: TabPaymentRepository,
    private readonly gateway: PaymentGateway,
    private readonly urls: { appUrl: string; webhookUrl: string },
  ) {}

  async createCheckout(
    principal: Readonly<{ id: string; tableId: string }>,
    scope: "mine" | "table",
    settings: Pick<PaymentSettingsView, "mercadoPagoEnabled" | "tabEnabled">,
    mercadoPagoConfigured: boolean,
  ): Promise<{ checkoutUrl: string }> {
    if (!settings.tabEnabled || !settings.mercadoPagoEnabled || !mercadoPagoConfigured) {
      throw new DomainError("TAB_ONLINE_PAYMENT_UNAVAILABLE", "El pago online de la cuenta no está disponible. Pagá en caja o con el mozo.");
    }
    const prepared = await this.repository.prepareOnlinePayment({ tableId: principal.tableId, customerSessionId: principal.id, scope });
    if (prepared.payment.checkoutUrl) return { checkoutUrl: prepared.payment.checkoutUrl };
    const back = (status: string) => `${this.urls.appUrl}/m/${encodeURIComponent(prepared.qrToken)}/account?pago=${status}`;
    const checkout = await this.gateway.createCheckout({
      externalReference: prepared.payment.id,
      idempotencyKey: prepared.payment.idempotencyKey,
      totalCents: prepared.payment.amountCents,
      items: prepared.lines.map((line) => ({ title: `${prepared.tableLabel} · Pedido #${line.number}`, quantity: 1, unitPriceCents: line.amountCents })),
      notificationUrl: this.urls.webhookUrl,
      successUrl: back("ok"),
      failureUrl: back("error"),
      pendingUrl: back("pendiente"),
    });
    await this.repository.saveOnlineCheckout({ paymentId: prepared.payment.id, providerOrderId: checkout.providerOrderId, checkoutUrl: checkout.checkoutUrl, raw: checkout.raw });
    return { checkoutUrl: checkout.checkoutUrl };
  }
}
