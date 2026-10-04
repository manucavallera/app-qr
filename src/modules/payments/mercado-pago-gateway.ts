import type { CheckoutInput, PaymentGateway } from "./payment-gateway";

const REQUEST_TIMEOUT_MS = 10_000;

export class MercadoPagoGateway implements PaymentGateway {
  constructor(private readonly accessToken: string) {}

  private async request(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
    const response = await fetch(`https://api.mercadopago.com${path}`, {
      ...init,
      headers: { authorization: `Bearer ${this.accessToken}`, "content-type": "application/json", ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch((error: unknown) => {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw new Error("Mercado Pago request timed out");
      throw error;
    });
    const body = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok || !body) throw new Error(`Mercado Pago request failed (${response.status})`);
    return body;
  }

  async createCheckout(input: CheckoutInput) {
    const body = await this.request("/v1/orders", {
      method: "POST",
      headers: { "x-idempotency-key": input.idempotencyKey },
      body: JSON.stringify({
        type: "online",
        external_reference: input.externalReference,
        total_amount: (input.totalCents / 100).toFixed(2),
        transactions: { payments: [{ amount: (input.totalCents / 100).toFixed(2) }] },
        items: input.items.map((item) => ({ title: item.title, quantity: item.quantity, unit_price: (item.unitPriceCents / 100).toFixed(2), currency_id: "ARS" })),
        processing_mode: "automatic",
        notification_url: input.notificationUrl,
        back_urls: { success: input.successUrl, failure: input.failureUrl, pending: input.pendingUrl },
      }),
    });
    const providerOrderId = String(body.id ?? "");
    const checkoutUrl = String(body.checkout_url ?? body.init_point ?? "");
    if (!providerOrderId || !checkoutUrl) throw new Error("Mercado Pago returned no checkout URL");
    return { providerOrderId, checkoutUrl, raw: body };
  }

  async getOrder(providerOrderId: string) {
    const body = await this.request(`/v1/orders/${encodeURIComponent(providerOrderId)}`);
    const payment = Array.isArray(body.transactions && (body.transactions as Record<string, unknown>).payments)
      ? ((body.transactions as Record<string, unknown>).payments as Array<Record<string, unknown>>)[0]
      : undefined;
    return {
      providerOrderId,
      externalReference: String(body.external_reference ?? ""),
      status: String(body.status ?? payment?.status ?? ""),
      statusDetail: String(body.status_detail ?? payment?.status_detail ?? ""),
      totalPaidCents: Math.round(Number(payment?.amount ?? body.total_amount ?? 0) * 100),
      raw: body,
    };
  }
}
