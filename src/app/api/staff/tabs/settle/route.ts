import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { settleTabInputSchema } from "@/modules/orders/tab-summary";
import { tableTabRepository } from "@/modules/orders/table-tab";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const principal = await requireStaff(request, ["ADMIN", "OPERATOR"]);
  if (principal instanceof NextResponse) return principal;
  const parsed = settleTabInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  try {
    return NextResponse.json(await tableTabRepository.settleTab(parsed.data, principal.userId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
