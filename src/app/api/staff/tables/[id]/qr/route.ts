import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getServerEnv } from "@/lib/env";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { tableService } from "@/modules/tables/table-service";
import { DomainError } from "@/modules/orders/errors";

const staffRoles = ["ADMIN", "OPERATOR"] as const;
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const principal = await requireStaff(request, staffRoles);
  if (principal instanceof NextResponse) return principal;

  try {
    const { id } = await context.params;
    const table = await tableService.findById(id);
    if (!table) throw new DomainError("TABLE_NOT_FOUND", "No encontramos esa mesa.");

    const appUrl = getServerEnv().APP_URL;
    const target = new URL(`/m/${table.qrToken}`, appUrl).toString();
    const svg = await QRCode.toString(target, {
      type: "svg",
      errorCorrectionLevel: "H",
      margin: 2,
      width: 512,
    });

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `inline; filename="table-${table.id}.svg"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const principal = await requireStaff(request, staffRoles);
  if (principal instanceof NextResponse) return principal;

  try {
    const { id } = await context.params;
    const table = await tableService.regenerateQr(id, principal.userId);
    return NextResponse.json({ id: table.id, label: table.label, qrConfigured: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
