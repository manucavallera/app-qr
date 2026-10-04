import { afterEach, describe, expect, it, vi } from "vitest";
import { MercadoPagoGateway } from "./mercado-pago-gateway";

afterEach(() => vi.unstubAllGlobals());

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const input = {
  externalReference: "attempt-1",
  idempotencyKey: "key-1",
  totalCents: 1950000,
  items: [{ title: "Hamburguesa clásica", quantity: 2, unitPriceCents: 950000 }, { title: "Limonada", quantity: 1, unitPriceCents: 50000 }],
  notificationUrl: "https://bar.test/api/payments/mercado-pago/webhook",
  successUrl: "https://bar.test/payment/return?status=success",
  failureUrl: "https://bar.test/payment/return?status=failure",
  pendingUrl: "https://bar.test/payment/return?status=pending",
};

describe("MercadoPagoGateway checkout", () => {
  it("creates a Checkout Pro preference and returns its payment link", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "pref-1", init_point: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new MercadoPagoGateway("token").createCheckout(input);

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api.mercadopago.com/checkout/preferences");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      external_reference: "attempt-1",
      items: [{ title: "Hamburguesa clásica", quantity: 2, unit_price: 9500, currency_id: "ARS" }, { title: "Limonada", quantity: 1, unit_price: 500, currency_id: "ARS" }],
      back_urls: { success: input.successUrl, failure: input.failureUrl, pending: input.pendingUrl },
      auto_return: "approved",
      notification_url: input.notificationUrl,
      expires: true,
    });
    expect(result).toMatchObject({ providerOrderId: "pref-1", checkoutUrl: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-1" });
  });

  it("leaves out the fields Mercado Pago rejects on local, non-HTTPS addresses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "pref-2", init_point: "https://pay.test/2" }));
    vi.stubGlobal("fetch", fetchMock);
    await new MercadoPagoGateway("token").createCheckout({ ...input, notificationUrl: "http://localhost:3000/hook", successUrl: "http://localhost:3000/ok" });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).not.toHaveProperty("auto_return");
    expect(body).not.toHaveProperty("notification_url");
  });

  it("fails when Mercado Pago returns no link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ id: "pref-3" })));
    await expect(new MercadoPagoGateway("token").createCheckout(input)).rejects.toThrow("no checkout URL");
  });
});

describe("MercadoPagoGateway payment lookup", () => {
  const lookup = async (payment: Record<string, unknown>) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(payment)));
    return new MercadoPagoGateway("token").getOrder("123");
  };

  it("reads the payment by its id and keeps the original id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 123, status: "approved", status_detail: "accredited", transaction_amount: 9500, external_reference: "attempt-1" }));
    vi.stubGlobal("fetch", fetchMock);
    await new MercadoPagoGateway("token").getOrder("123");
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api.mercadopago.com/v1/payments/123");
  });

  it("maps an approved payment to processed and accredited with the amount in cents", async () => {
    expect(await lookup({ id: 123, status: "approved", status_detail: "accredited", transaction_amount: 9500.5, external_reference: "attempt-1" }))
      .toMatchObject({ providerOrderId: "123", externalReference: "attempt-1", status: "processed", statusDetail: "accredited", totalPaidCents: 950050 });
  });

  it("maps rejected and cancelled payments", async () => {
    expect(await lookup({ id: 1, status: "rejected", status_detail: "cc_rejected_other_reason", transaction_amount: 10, external_reference: "a" })).toMatchObject({ status: "processed", statusDetail: "rejected" });
    expect(await lookup({ id: 2, status: "cancelled", transaction_amount: 10, external_reference: "a" })).toMatchObject({ status: "processed", statusDetail: "cancelled" });
  });

  it("keeps pending, in-process and refunded payments out of the approved path", async () => {
    for (const status of ["pending", "in_process", "authorized", "refunded", "charged_back"]) {
      expect(await lookup({ id: 3, status, transaction_amount: 10, external_reference: "a" })).toMatchObject({ status: "created" });
    }
  });
});

describe("MercadoPagoGateway requests", () => {
  it("sends every request with a timeout signal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 1, status: "pending", external_reference: "a" }));
    vi.stubGlobal("fetch", fetchMock);
    await new MercadoPagoGateway("token").getOrder("1");
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("turns a timeout into a readable error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("The operation timed out", "TimeoutError")));
    await expect(new MercadoPagoGateway("token").getOrder("1")).rejects.toThrow("Mercado Pago request timed out");
  });
});
