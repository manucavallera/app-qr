import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { buildDashboard } from "@/modules/reports/dashboard";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const principal = await requireStaff(request, ["ADMIN"]);
  if (principal instanceof NextResponse) return principal;
  try {
    return NextResponse.json(await buildDashboard(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
