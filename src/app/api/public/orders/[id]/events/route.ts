import { NextRequest, NextResponse } from "next/server";
import { CUSTOMER_SESSION_COOKIE } from "@/modules/tables/customer-session-service";
import { authenticateCustomerSession } from "@/modules/tables/customer-session-auth";
import { orderRepository } from "@/modules/orders/order-repository";
import { orderEventStream } from "@/modules/realtime/sse-stream";

type RouteContext = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, { params }: RouteContext): Promise<Response> {
  const principal = await authenticateCustomerSession(request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
  const { id } = await params;
  if (!principal || !await orderRepository.findCustomerOrder(id, principal.id)) return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
  return orderEventStream(request, id);
}
