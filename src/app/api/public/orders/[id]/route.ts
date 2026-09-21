import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { CUSTOMER_SESSION_COOKIE } from "@/modules/tables/customer-session-service";
import { authenticateCustomerSession } from "@/modules/tables/customer-session-auth";
import { OrderService } from "@/modules/orders/order-service";
import { orderRepository } from "@/modules/orders/order-repository";
import { toOrderView } from "@/modules/orders/order-view";

type RouteContext = { params: Promise<{ id: string }> };
const orders = new OrderService(orderRepository);

export async function GET(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const principal = await authenticateCustomerSession(request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
  if (!principal) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id } = await params;
  try {
    const order = await orders.findCustomerOrder(id, principal.id);
    if (!order) return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
    return NextResponse.json(toOrderView(order), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
