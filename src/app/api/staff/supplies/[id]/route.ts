import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { updateSupply } from "@/modules/supplies/supply-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const principal = await requireStaff(request, ["ADMIN"]);
  if (principal instanceof NextResponse) return principal;
  const body: unknown = await request.json().catch(() => null);
  try {
    const { id } = await context.params;
    return NextResponse.json(await updateSupply(id, body, principal.userId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
