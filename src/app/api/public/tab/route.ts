import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { authenticateCustomerSession, CUSTOMER_SESSION_COOKIE } from "@/modules/tables/customer-session-auth";
import { tableTabRepository } from "@/modules/orders/table-tab";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const principal = await authenticateCustomerSession(request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
  if (!principal) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  try {
    return NextResponse.json(await tableTabRepository.getCustomerTab(principal.id, principal.tableId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
