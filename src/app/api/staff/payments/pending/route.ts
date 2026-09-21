import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { OrderService } from "@/modules/orders/order-service";
import { orderRepository } from "@/modules/orders/order-repository";
import { toOrderView } from "@/modules/orders/order-view";

const orders = new OrderService(orderRepository);
const roles = ["ADMIN", "OPERATOR"] as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const principal = await requireStaff(request, roles);
  if (principal instanceof NextResponse) return principal;
  try {
    const pending = await orders.listPendingTraditionalPayments();
    return NextResponse.json(pending.map(toOrderView), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
