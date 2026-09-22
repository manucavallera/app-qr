import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { resolveServiceMode } from "@/modules/operations/service-mode";

const roles = ["ADMIN", "OPERATOR"] as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const principal = await requireStaff(request, roles);
  if (principal instanceof NextResponse) return principal;
  try {
    const [pendingPayments, activeCommands, settings, windows] = await Promise.all([
      prisma.order.count({ where: { status: "AWAITING_PAYMENT", payments: { some: { status: "UNPAID", method: { in: ["CASH", "CARD_AT_COUNTER", "BANK_TRANSFER"] } } } } }),
      prisma.order.count({ where: { status: { in: ["CONFIRMED", "PREPARING", "READY"] } } }),
      prisma.businessSettings.findUnique({ where: { id: "default" } }),
      prisma.serviceWindow.findMany(),
    ]);
    const qrMode = settings ? resolveServiceMode(new Date(), settings.timezone, windows, settings.manualMode) : "COUNTER_ONLY";
    return NextResponse.json({ pendingPayments, activeCommands, qrMode }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
