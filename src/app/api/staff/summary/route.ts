import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { resolveServiceMode } from "@/modules/operations/service-mode";
import { LOW_STOCK_THRESHOLD } from "@/modules/orders/stock";

const roles = ["ADMIN", "OPERATOR"] as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const principal = await requireStaff(request, roles);
  if (principal instanceof NextResponse) return principal;
  try {
    const [pendingPayments, activeCommands, settings, windows, lowStock, paymentsToReturn, tabPayments] = await Promise.all([
      prisma.order.count({ where: { status: "AWAITING_PAYMENT", payments: { some: { status: "UNPAID", method: { in: ["CASH", "CARD_AT_COUNTER", "BANK_TRANSFER"] } } } } }),
      prisma.order.count({ where: { status: { in: ["CONFIRMED", "PREPARING", "READY"] } } }),
      prisma.businessSettings.findUnique({ where: { id: "default" } }),
      prisma.serviceWindow.findMany(),
      prisma.product.findMany({
        where: { visible: true, stockQuantity: { lte: LOW_STOCK_THRESHOLD } },
        orderBy: [{ stockQuantity: "asc" }, { name: "asc" }],
        select: { id: true, name: true, stockQuantity: true },
      }),
      // Money that was accepted for an order that is now cancelled and has not been marked as returned.
      prisma.paymentAttempt.findMany({
        where: { status: "APPROVED", order: { status: "CANCELLED" } },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, method: true, amountCents: true, order: { select: { number: true } } },
      }),
      // Cuentas de mesa sin cobrar: pedidos "pagar al final" que siguen vivos.
      prisma.paymentAttempt.findMany({
        where: { method: "ON_TAB", status: "UNPAID", order: { status: { not: "CANCELLED" }, tableId: { not: null } } },
        select: { amountCents: true, order: { select: { tableId: true, table: { select: { billRequestedAt: true } } } } },
      }),
    ]);
    const openTabTables = new Map<string, { cents: number; billRequested: boolean }>();
    for (const payment of tabPayments) {
      const tableId = payment.order.tableId!;
      const entry = openTabTables.get(tableId) ?? { cents: 0, billRequested: Boolean(payment.order.table?.billRequestedAt) };
      entry.cents += payment.amountCents;
      openTabTables.set(tableId, entry);
    }
    const openTabs = {
      tables: openTabTables.size,
      totalCents: [...openTabTables.values()].reduce((sum, entry) => sum + entry.cents, 0),
      billRequested: [...openTabTables.values()].filter((entry) => entry.billRequested).length,
    };
    const refundsDue = paymentsToReturn.map((payment) => ({ id: payment.id, method: payment.method, amountCents: payment.amountCents, orderNumber: payment.order.number }));
    const qrMode = settings ? resolveServiceMode(new Date(), settings.timezone, windows, settings.manualMode) : "COUNTER_ONLY";
    return NextResponse.json({ pendingPayments, activeCommands, qrMode, lowStock, refundsDue, openTabs, role: principal.role }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
