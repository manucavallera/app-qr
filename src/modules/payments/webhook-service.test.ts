import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { validateMercadoPagoSignature, WebhookService } from "./webhook-service";

const secret = "test-secret";
const sign = (manifest: string) => createHmac("sha256", secret).update(manifest).digest("hex");

describe("validateMercadoPagoSignature", () => {
  it("accepts a numeric id signed as sent", () => {
    const v1 = sign("id:123456;request-id:req-1;ts:1700000000;");
    expect(validateMercadoPagoSignature({ xSignature: `ts=1700000000,v1=${v1}`, xRequestId: "req-1", dataId: "123456", secret })).toBe(true);
  });

  it("accepts an uppercase alphanumeric id because Mercado Pago signs it in lowercase", () => {
    const v1 = sign("id:ord01abc;request-id:req-1;ts:1700000000;");
    expect(validateMercadoPagoSignature({ xSignature: `ts=1700000000,v1=${v1}`, xRequestId: "req-1", dataId: "ORD01ABC", secret })).toBe(true);
  });

  it("rejects a tampered signature, another id, a missing secret and malformed headers", () => {
    const v1 = sign("id:123456;request-id:req-1;ts:1700000000;");
    const header = `ts=1700000000,v1=${v1}`;
    expect(validateMercadoPagoSignature({ xSignature: `ts=1700000000,v1=${v1.slice(0, -1)}0`, xRequestId: "req-1", dataId: "123456", secret })).toBe(false);
    expect(validateMercadoPagoSignature({ xSignature: header, xRequestId: "req-1", dataId: "999999", secret })).toBe(false);
    expect(validateMercadoPagoSignature({ xSignature: header, xRequestId: "req-1", dataId: "123456", secret: "" })).toBe(false);
    expect(validateMercadoPagoSignature({ xSignature: "garbage", xRequestId: "req-1", dataId: "123456", secret })).toBe(false);
    expect(validateMercadoPagoSignature({ xSignature: null, xRequestId: "req-1", dataId: "123456", secret })).toBe(false);
  });
});

describe("WebhookService", () => {
  it("rejects an invalid signature before retrieving or changing a payment", async () => {
    const gateway = { getOrder: vi.fn() };
    const repository = { processGatewayUpdate: vi.fn() };
    const service = new WebhookService(gateway, repository, () => false);
    await expect(service.process({ xSignature: "bad", xRequestId: "req", dataId: "1" })).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
    expect(gateway.getOrder).not.toHaveBeenCalled();
    expect(repository.processGatewayUpdate).not.toHaveBeenCalled();
  });

  it("retrieves the remote order and delegates the idempotent update", async () => {
    const gateway = { getOrder: vi.fn().mockResolvedValue({ providerOrderId: "mp-1", externalReference: "order-1", status: "processed", statusDetail: "accredited", totalPaidCents: 5000, raw: {} }) };
    const repository = { processGatewayUpdate: vi.fn().mockResolvedValue({ id: "order-1", status: "CONFIRMED" }) };
    const service = new WebhookService(gateway, repository, () => true);
    await expect(service.process({ xSignature: "ok", xRequestId: "req", dataId: "mp-1" })).resolves.toEqual({ id: "order-1", status: "CONFIRMED" });
    expect(repository.processGatewayUpdate).toHaveBeenCalledWith(expect.objectContaining({ providerOrderId: "mp-1", totalPaidCents: 5000 }));
  });
});
