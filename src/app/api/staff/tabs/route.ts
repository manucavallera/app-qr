import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { tableTabRepository } from "@/modules/orders/table-tab";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const principal = await requireStaff(request, ["ADMIN", "OPERATOR"]);
  if (principal instanceof NextResponse) return principal;
  try {
    return NextResponse.json(await tableTabRepository.listOpenTabs(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
