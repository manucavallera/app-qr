import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { createSupply, listSupplies } from "@/modules/supplies/supply-service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const principal = await requireStaff(request, ["ADMIN"]);
  if (principal instanceof NextResponse) return principal;
  try {
    return NextResponse.json(await listSupplies(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const principal = await requireStaff(request, ["ADMIN"]);
  if (principal instanceof NextResponse) return principal;
  const body: unknown = await request.json().catch(() => null);
  try {
    return NextResponse.json(await createSupply(body, principal.userId), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
