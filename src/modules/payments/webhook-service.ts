import { createHmac, timingSafeEqual } from "node:crypto";
import { DomainError } from "../orders/errors";
import type { PaymentRepository } from "./payment-service";
import type { PaymentGateway } from "./payment-gateway";

export type WebhookInput = Readonly<{ xSignature: string | null; xRequestId: string | null; dataId: string | null }>;
export type SignatureValidator = (input: WebhookInput & { secret: string }) => boolean;

export function validateMercadoPagoSignature(input: WebhookInput & { secret: string }): boolean {
  if (!input.xSignature || !input.xRequestId || !input.dataId || !input.secret) return false;
  const parts = Object.fromEntries(input.xSignature.split(",").map((part) => part.trim().split("=", 2) as [string, string]));
  const timestamp = parts.ts;
  const signature = parts.v1;
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  // Mercado Pago signs alphanumeric ids in lowercase; the original id is still the one used to fetch the order.
  const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.xRequestId};ts:${timestamp};`;
  const expected = createHmac("sha256", input.secret).update(manifest).digest("hex");
  const actual = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export class WebhookService {
  constructor(
    private readonly gateway: Pick<PaymentGateway, "getOrder">,
    private readonly repository: Pick<PaymentRepository, "processGatewayUpdate">,
    private readonly isValid: (input: WebhookInput) => boolean,
  ) {}

  async process(input: WebhookInput): Promise<unknown> {
    if (!this.isValid(input)) throw new DomainError("INVALID_WEBHOOK_SIGNATURE", "La firma del webhook no es válida.");
    if (!input.dataId) throw new DomainError("INVALID_WEBHOOK", "Falta el identificador del pago.");
    const remote = await this.gateway.getOrder(input.dataId);
    return this.repository.processGatewayUpdate(remote);
  }
}
