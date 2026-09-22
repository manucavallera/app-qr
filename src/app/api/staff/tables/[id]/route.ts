import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { tableService } from "@/modules/tables/table-service";

type RouteContext = { params: Promise<{ id: string }> };
const staffRoles = ["ADMIN", "OPERATOR"] as const;

export async function PATCH(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const principal = await requireStaff(request, staffRoles);
  if (principal instanceof NextResponse) return principal;
  try {
    const { id } = await params;
    const body = await request.json() as { active?: unknown };
    if (typeof body.active !== "boolean") return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    const table = await tableService.setActive(id, body.active, principal.userId);
    return NextResponse.json({ id: table.id, label: table.label, active: table.active, qrConfigured: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
