import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { tableTabRepository } from "@/modules/orders/table-tab";
import { createPaymentGateway } from "@/modules/payments/gateway-factory";
import { TabPaymentService } from "@/modules/payments/tab-payment-service";
import { authenticateCustomerSession, CUSTOMER_SESSION_COOKIE } from "@/modules/tables/customer-session-auth";

const bodySchema = z.object({ scope: z.enum(["mine", "table"]) }).strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  const principal = await authenticateCustomerSession(request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
  if (!principal) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    const env = getServerEnv();
    const settings = await prisma.paymentSettings.findUnique({ where: { id: "default" } });
    const service = new TabPaymentService(tableTabRepository, createPaymentGateway(), { appUrl: env.APP_URL, webhookUrl: `${env.APP_URL}/api/payments/mercado-pago/webhook` });
    const mercadoPagoConfigured = env.PAYMENT_PROVIDER === "mercadopago" && Boolean(env.MERCADOPAGO_ACCESS_TOKEN);
    return NextResponse.json(await service.createCheckout(principal, parsed.data.scope, { mercadoPagoEnabled: settings?.mercadoPagoEnabled ?? false, tabEnabled: settings?.tabEnabled ?? false }, mercadoPagoConfigured));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
