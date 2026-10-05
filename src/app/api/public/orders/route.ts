import { getClientIp } from "@/lib/http/client-ip";
import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { CUSTOMER_SESSION_COOKIE } from "@/modules/tables/customer-session-service";
import { authenticateCustomerSession } from "@/modules/tables/customer-session-auth";
import { OrderService } from "@/modules/orders/order-service";
import { orderRepository } from "@/modules/orders/order-repository";
import { toOrderView } from "@/modules/orders/order-view";

const orders = new OrderService(orderRepository);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const sessionToken = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!await authenticateCustomerSession(sessionToken)) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => null);
  try {
    const result = await orders.createQrOrder(body, sessionToken!, getClientIp(request));
    return NextResponse.json({ ...toOrderView(result.order), created: result.created }, { status: result.created ? 201 : 200 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
