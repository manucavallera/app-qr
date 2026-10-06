import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { authenticateCustomerSession, CUSTOMER_SESSION_COOKIE } from "@/modules/tables/customer-session-auth";
import { tableTabRepository } from "@/modules/orders/table-tab";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const principal = await authenticateCustomerSession(request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
  if (!principal) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  try {
    const env = getServerEnv();
    const [tab, settings] = await Promise.all([
      tableTabRepository.getCustomerTab(principal.id, principal.tableId),
      prisma.paymentSettings.findUnique({ where: { id: "default" } }),
    ]);
    const canPayOnline = Boolean(settings?.tabEnabled && settings.mercadoPagoEnabled && env.PAYMENT_PROVIDER === "mercadopago" && env.MERCADOPAGO_ACCESS_TOKEN);
    return NextResponse.json({ ...tab, canPayOnline }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
