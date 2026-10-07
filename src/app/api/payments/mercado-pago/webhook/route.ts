import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getServerEnv } from "@/lib/env";
import { logRequest } from "@/lib/logger";
import { orderRepository } from "@/modules/orders/order-repository";
import { createPaymentGateway } from "@/modules/payments/gateway-factory";
import { diagnoseMercadoPagoSignature, validateMercadoPagoSignature, WebhookService } from "@/modules/payments/webhook-service";

const route = "mercado-pago-webhook";

/** One line per notification, so a rejected or ignored one can be found in the server logs. */
function logOutcome(request: NextRequest, startedAt: number, status: number, code: string, detail?: Record<string, unknown>): void {
  logRequest({ requestId: request.headers.get("x-request-id") ?? "-", route, status, durationMs: Date.now() - startedAt, code, detail });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();
  try {
    const env = getServerEnv();
    const service = new WebhookService(createPaymentGateway(), orderRepository, (input) => validateMercadoPagoSignature({ ...input, secret: env.MERCADOPAGO_WEBHOOK_SECRET ?? "" }));
    // Checkout Pro also sends merchant-order notifications; only payments carry an id we can read back.
    const notificationType = request.nextUrl.searchParams.get("type") ?? request.nextUrl.searchParams.get("topic");
    if (notificationType && notificationType !== "payment") {
      logOutcome(request, startedAt, 200, `IGNORED_${notificationType}`);
      return NextResponse.json({ received: true, ignored: true });
    }
    const dataId = request.nextUrl.searchParams.get("data.id") ?? request.nextUrl.searchParams.get("id");
    await service.process({ xSignature: request.headers.get("x-signature"), xRequestId: request.headers.get("x-request-id"), dataId });
    logOutcome(request, startedAt, 200, "PROCESSED");
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "INVALID_WEBHOOK_SIGNATURE") {
      // The reason and the shape of the request, never the key itself: lets a rejected real notification be diagnosed from the logs.
      const keyValue = getServerEnv().MERCADOPAGO_WEBHOOK_SECRET ?? "";
      const dataId = request.nextUrl.searchParams.get("data.id") ?? request.nextUrl.searchParams.get("id");
      logOutcome(request, startedAt, 401, "INVALID_WEBHOOK_SIGNATURE", {
        reason: diagnoseMercadoPagoSignature({ xSignature: request.headers.get("x-signature"), xRequestId: request.headers.get("x-request-id"), dataId, secret: keyValue }),
        dataId,
        queryNames: [...request.nextUrl.searchParams.keys()],
        keyLength: keyValue.length,
        keyHasWhitespace: keyValue !== keyValue.trim(),
      });
      return NextResponse.json({ error: "INVALID_WEBHOOK_SIGNATURE" }, { status: 401 });
    }
    const response = apiErrorResponse(error);
    logOutcome(request, startedAt, response.status, error instanceof Error && "code" in error ? String((error as { code?: unknown }).code) : "ERROR");
    return response;
  }
}
