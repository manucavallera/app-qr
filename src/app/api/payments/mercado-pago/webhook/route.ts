import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getServerEnv } from "@/lib/env";
import { orderRepository } from "@/modules/orders/order-repository";
import { createPaymentGateway } from "@/modules/payments/gateway-factory";
import { validateMercadoPagoSignature, WebhookService } from "@/modules/payments/webhook-service";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const env = getServerEnv();
    const service = new WebhookService(createPaymentGateway(), orderRepository, (input) => validateMercadoPagoSignature({ ...input, secret: env.MERCADOPAGO_WEBHOOK_SECRET ?? "" }));
    const dataId = request.nextUrl.searchParams.get("data.id") ?? request.nextUrl.searchParams.get("id");
    await service.process({ xSignature: request.headers.get("x-signature"), xRequestId: request.headers.get("x-request-id"), dataId });
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "INVALID_WEBHOOK_SIGNATURE") {
      return NextResponse.json({ error: "INVALID_WEBHOOK_SIGNATURE" }, { status: 401 });
    }
    return apiErrorResponse(error);
  }
}
