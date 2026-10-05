import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { authenticateCustomerSession, CUSTOMER_SESSION_COOKIE } from "@/modules/tables/customer-session-auth";
import { tableTabRepository } from "@/modules/orders/table-tab";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const principal = await authenticateCustomerSession(request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
  if (!principal) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  try {
    return NextResponse.json(await tableTabRepository.requestBill(principal.tableId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
