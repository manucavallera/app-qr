import { afterEach, describe, expect, it, vi } from "vitest";
import { MercadoPagoGateway } from "./mercado-pago-gateway";

afterEach(() => vi.unstubAllGlobals());

describe("MercadoPagoGateway", () => {
  it("sends every request with a timeout signal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ external_reference: "order-1", status: "processed" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await new MercadoPagoGateway("token").getOrder("ORD1");
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("turns a timeout into a readable error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("The operation timed out", "TimeoutError")));
    await expect(new MercadoPagoGateway("token").getOrder("ORD1")).rejects.toThrow("Mercado Pago request timed out");
  });

  it("keeps the original id when fetching the order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "processed" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await new MercadoPagoGateway("token").getOrder("ORD1ABC");
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api.mercadopago.com/v1/orders/ORD1ABC");
  });
});
