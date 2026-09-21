import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { CUSTOMER_SESSION_COOKIE } from "@/modules/tables/customer-session-service";
import { authenticateCustomerSession } from "@/modules/tables/customer-session-auth";
import { PaymentService } from "@/modules/payments/payment-service";
import { createPaymentGateway } from "@/modules/payments/gateway-factory";
import { orderRepository } from "@/modules/orders/order-repository";
import { getServerEnv } from "@/lib/env";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const token = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
  const principal = await authenticateCustomerSession(token);
  if (!principal) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id } = await params;
  try {
    const env = getServerEnv();
    const service = new PaymentService(orderRepository, createPaymentGateway(), { appUrl: env.APP_URL, webhookUrl: `${env.APP_URL}/api/payments/mercado-pago/webhook` });
    return NextResponse.json(await service.createCheckout(id, principal.id));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
