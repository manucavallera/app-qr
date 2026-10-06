import { describe, expect, it, vi } from "vitest";
import { FakePaymentGateway } from "./fake-payment-gateway";
import { TabPaymentService, type PreparedTabPayment, type TabPaymentRepository } from "./tab-payment-service";

const principal = { id: "session-1", tableId: "table-1" };
const enabled = { mercadoPagoEnabled: true, tabEnabled: true };
const urls = { appUrl: "https://bar.test", webhookUrl: "https://bar.test/api/payments/mercado-pago/webhook" };

function prepared(overrides: Partial<PreparedTabPayment["payment"]> = {}): PreparedTabPayment {
  return {
    payment: { id: "pay-1", idempotencyKey: "key-1", amountCents: 1500, checkoutUrl: null, providerOrderId: null, ...overrides },
    lines: [{ orderId: "o1", number: 7, amountCents: 1000 }, { orderId: "o2", number: 8, amountCents: 500 }],
    tableLabel: "Mesa 3",
    qrToken: "qr token",
  };
}

function repository(value: PreparedTabPayment): TabPaymentRepository & { saved: unknown[] } {
  const saved: unknown[] = [];
  return { saved, prepareOnlinePayment: vi.fn(async () => value), saveOnlineCheckout: vi.fn(async (input) => { saved.push(input); }) };
}

describe("TabPaymentService", () => {
  it("creates a checkout with one line per order and returns to the account page", async () => {
    const gateway = new FakePaymentGateway();
    const spy = vi.spyOn(gateway, "createCheckout");
    const repo = repository(prepared());
    const result = await new TabPaymentService(repo, gateway, urls).createCheckout(principal, "table", enabled, true);
    expect(result.checkoutUrl).toContain("fake-payments.local");
    const input = spy.mock.calls[0][0];
    expect(input.externalReference).toBe("pay-1");
    expect(input.totalCents).toBe(1500);
    expect(input.items).toEqual([
      { title: "Mesa 3 · Pedido #7", quantity: 1, unitPriceCents: 1000 },
      { title: "Mesa 3 · Pedido #8", quantity: 1, unitPriceCents: 500 },
    ]);
    expect(input.successUrl).toBe("https://bar.test/m/qr%20token/account?pago=ok");
    expect(repo.saved).toHaveLength(1);
  });

  it("returns the saved link without creating another checkout", async () => {
    const gateway = new FakePaymentGateway();
    const spy = vi.spyOn(gateway, "createCheckout");
    const repo = repository(prepared({ checkoutUrl: "https://mp.test/saved" }));
    const result = await new TabPaymentService(repo, gateway, urls).createCheckout(principal, "mine", enabled, true);
    expect(result.checkoutUrl).toBe("https://mp.test/saved");
    expect(spy).not.toHaveBeenCalled();
  });

  it.each([
    [{ mercadoPagoEnabled: false, tabEnabled: true }, true],
    [{ mercadoPagoEnabled: true, tabEnabled: false }, true],
    [enabled, false],
  ])("refuses when online payment is not available (%o, configured=%s)", async (settings, configured) => {
    const repo = repository(prepared());
    await expect(new TabPaymentService(repo, new FakePaymentGateway(), urls).createCheckout(principal, "mine", settings, configured)).rejects.toMatchObject({ code: "TAB_ONLINE_PAYMENT_UNAVAILABLE" });
    expect(repo.prepareOnlinePayment).not.toHaveBeenCalled();
  });
});
