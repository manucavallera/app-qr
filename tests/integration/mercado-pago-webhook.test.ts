import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as webhook } from "@/app/api/payments/mercado-pago/webhook/route";

const call = (query: string, headers: Record<string, string> = {}) => webhook(new NextRequest(`http://localhost/api/payments/mercado-pago/webhook?${query}`, { method: "POST", headers }));

describe("Mercado Pago webhook route", () => {
  it("acknowledges notifications that are not payments without reading anything", async () => {
    const response = await call("type=merchant_order&data.id=999");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, ignored: true });
  });

  it("rejects a payment notification with a missing or wrong signature", async () => {
    expect((await call("type=payment&data.id=123")).status).toBe(401);
    expect((await call("type=payment&data.id=123", { "x-signature": "ts=1700000000,v1=00", "x-request-id": "req-1" })).status).toBe(401);
  });
});
