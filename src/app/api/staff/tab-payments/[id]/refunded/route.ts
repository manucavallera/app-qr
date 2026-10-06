import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { tableTabRepository } from "@/modules/orders/table-tab";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const principal = await requireStaff(request, ["ADMIN"]);
  if (principal instanceof NextResponse) return principal;
  try {
    const { id } = await params;
    if (!(await tableTabRepository.markTabRefundReturned(id, principal.userId))) return NextResponse.json({ error: "REFUND_NOT_PENDING" }, { status: 404 });
    return NextResponse.json({ id, returned: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
