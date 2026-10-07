import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { tableTabRepository } from "@/modules/orders/table-tab";

type RouteContext = { params: Promise<{ id: string }> };

/** The open tab of a table with what is still unpaid, for the printable bill. */
export async function GET(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const principal = await requireStaff(request, ["ADMIN", "OPERATOR"]);
  if (principal instanceof NextResponse) return principal;
  try {
    const { id } = await params;
    const [tabs, settings] = await Promise.all([
      tableTabRepository.listOpenTabs(),
      prisma.businessSettings.findUnique({ where: { id: "default" }, select: { name: true } }),
    ]);
    const tab = tabs.find((candidate) => candidate.id === id);
    if (!tab) return NextResponse.json({ error: "TAB_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ tab, businessName: settings?.name ?? "Bar" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
