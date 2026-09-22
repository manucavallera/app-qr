import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { tableService } from "@/modules/tables/table-service";
import { getServerEnv } from "@/lib/env";

const staffRoles = ["ADMIN", "OPERATOR"] as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const principal = await requireStaff(request, staffRoles);
  if (principal instanceof NextResponse) return principal;

  try {
    const tables = await tableService.list();
    const appUrl = getServerEnv().APP_URL;
    return NextResponse.json(
      tables.map(({ id, label, qrToken, active, createdAt }) => ({ id, label, active, qrConfigured: true, createdAt, menuUrl: new URL(`/m/${qrToken}`, appUrl).toString() })),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const principal = await requireStaff(request, staffRoles);
  if (principal instanceof NextResponse) return principal;

  const body: unknown = await request.json().catch(() => null);
  try {
    const table = await tableService.create(body, principal.userId);
    return NextResponse.json(
      { id: table.id, label: table.label, active: table.active, qrConfigured: true, menuUrl: new URL(`/m/${table.qrToken}`, getServerEnv().APP_URL).toString() },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
