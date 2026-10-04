import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { buildSalesReport } from "@/modules/reports/sales-report";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const principal = await requireStaff(request, ["ADMIN"]);
  if (principal instanceof NextResponse) return principal;
  try {
    const params = request.nextUrl.searchParams;
    const report = await buildSalesReport({ from: params.get("from"), to: params.get("to") });
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
