import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { OrderService } from "@/modules/orders/order-service";
import { orderRepository } from "@/modules/orders/order-repository";
import { toOrderView } from "@/modules/orders/order-view";

type RouteContext = { params: Promise<{ id: string }> };
const orders = new OrderService(orderRepository);
const roles = ["ADMIN", "OPERATOR"] as const;

export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const principal = await requireStaff(request, roles);
  if (principal instanceof NextResponse) return principal;
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  try {
    const order = await orders.confirmTraditionalPayment(id, body, principal.userId);
    return NextResponse.json(toOrderView(order));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
