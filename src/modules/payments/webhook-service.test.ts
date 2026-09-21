import { describe, expect, it, vi } from "vitest";
import { WebhookService } from "./webhook-service";

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
