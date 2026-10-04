import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { orderRepository } from "@/modules/orders/order-repository";
import { toOrderView } from "@/modules/orders/order-view";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const principal = await requireStaff(request, ["ADMIN", "OPERATOR"]);
  if (principal instanceof NextResponse) return principal;
  try {
    const { id } = await params;
    const [order, settings] = await Promise.all([
      orderRepository.findStaffOrder(id),
      prisma.businessSettings.findUnique({ where: { id: "default" }, select: { name: true } }),
    ]);
    if (!order) return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ order: toOrderView(order), businessName: settings?.name ?? "Bar" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
