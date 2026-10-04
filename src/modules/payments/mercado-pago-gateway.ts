import type { CheckoutInput, PaymentGateway, RemotePaymentOrder } from "./payment-gateway";

const REQUEST_TIMEOUT_MS = 10_000;
// Matches the cron that cancels unpaid online orders after two hours.
const PAYMENT_LINK_LIFETIME_MS = 2 * 60 * 60 * 1000;

/**
 * Checkout Pro: a payment preference gives the customer a link to pay on Mercado Pago.
 * The webhook reports a payment id, which is read back from the payments API.
 */
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
    const body = await this.request("/checkout/preferences", {
      method: "POST",
      body: JSON.stringify({
        external_reference: input.externalReference,
        items: input.items.map((item) => ({ title: item.title, quantity: item.quantity, unit_price: item.unitPriceCents / 100, currency_id: "ARS" })),
        back_urls: { success: input.successUrl, failure: input.failureUrl, pending: input.pendingUrl },
        // Mercado Pago only accepts public HTTPS addresses for these two fields.
        ...(input.successUrl.startsWith("https://") ? { auto_return: "approved" } : {}),
        ...(input.notificationUrl.startsWith("https://") ? { notification_url: input.notificationUrl } : {}),
        expires: true,
        expiration_date_to: new Date(Date.now() + PAYMENT_LINK_LIFETIME_MS).toISOString(),
      }),
    });
    const providerOrderId = String(body.id ?? "");
    const checkoutUrl = String(body.init_point ?? "");
    if (!providerOrderId || !checkoutUrl) throw new Error("Mercado Pago returned no checkout URL");
    return { providerOrderId, checkoutUrl, raw: body };
  }

  async getOrder(paymentId: string): Promise<RemotePaymentOrder> {
    const body = await this.request(`/v1/payments/${encodeURIComponent(paymentId)}`);
    const status = String(body.status ?? "");
    // The rest of the system speaks "processed" + detail; translate the payment status once, here.
    const mapped = status === "approved" ? { status: "processed", statusDetail: "accredited" }
      : status === "rejected" ? { status: "processed", statusDetail: "rejected" }
      : status === "cancelled" ? { status: "processed", statusDetail: "cancelled" }
      : { status: "created", statusDetail: status || "pending" };
    return {
      providerOrderId: String(body.id ?? paymentId),
      externalReference: String(body.external_reference ?? ""),
      ...mapped,
      totalPaidCents: Math.round(Number(body.transaction_amount ?? 0) * 100),
      raw: body,
    };
  }
}
