import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { apiErrorResponse } from "@/lib/api-errors";
import { getServerEnv } from "@/lib/env";
import { requireStaff } from "@/modules/auth/require-staff";
import { OrderService } from "@/modules/orders/order-service";
import { orderRepository } from "@/modules/orders/order-repository";
import { toOrderView } from "@/modules/orders/order-view";
import { PaymentService } from "@/modules/payments/payment-service";
import { createPaymentGateway } from "@/modules/payments/gateway-factory";

const orders = new OrderService(orderRepository);
const roles = ["ADMIN", "OPERATOR"] as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const principal = await requireStaff(request, roles);
  if (principal instanceof NextResponse) return principal;
  try {
    return NextResponse.json((await orders.listStaffOrders()).map(toOrderView), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const principal = await requireStaff(request, roles);
  if (principal instanceof NextResponse) return principal;
    const body: unknown = await request.json().catch(() => null);
  try {
    const result = await orders.createCounterOrder(body, principal.userId);
    const view = toOrderView(result.order);
    const paymentMethod = view.payments[0]?.method;
    if (paymentMethod === "MERCADO_PAGO" && view.status === "AWAITING_PAYMENT") {
      const env = getServerEnv();
      const service = new PaymentService(orderRepository, createPaymentGateway(), { appUrl: env.APP_URL, webhookUrl: `${env.APP_URL}/api/payments/mercado-pago/webhook` });
      const checkout = await service.createCounterCheckout(String(view.id));
      const paymentQrDataUrl = await QRCode.toDataURL(checkout.checkoutUrl, { errorCorrectionLevel: "M", margin: 2, width: 320 });
      return NextResponse.json({ ...view, created: result.created, paymentQrDataUrl }, { status: result.created ? 201 : 200 });
    }
    return NextResponse.json({ ...view, created: result.created }, { status: result.created ? 201 : 200 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
