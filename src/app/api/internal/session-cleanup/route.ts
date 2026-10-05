import { type NextRequest, NextResponse } from "next/server";
import { cancelStaleUnpaidOrders } from "@/modules/orders/stale-orders";
import { closeExpiredSessions, purgeExpiredRecords } from "@/modules/tables/session-cleanup";
import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import { resolveServiceMode } from "@/modules/operations/service-mode";
import { tableTabRepository } from "@/modules/orders/table-tab";

/**
 * Internal endpoint to trigger session cleanup and unpaid-order expiry manually
 * or from an external cron.
 * Protected by INTERNAL_SECRET env var.
 *
 * Example:
 *   curl -H "Authorization: Bearer <secret>" https://example.com/api/internal/session-cleanup
 *
 * Production runs this endpoint from an external cron every minute. The
 * instrumentation hook performs only a startup cleanup pass.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const env = getServerEnv();
  if (!env.INTERNAL_SECRET) {
    return NextResponse.json({ error: "ENDPOINT_DISABLED" }, { status: 404 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.INTERNAL_SECRET}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  // Orders first: a session with an unpaid order stays open until that order expires.
  const orders = await cancelStaleUnpaidOrders();
  const sessions = await closeExpiredSessions();
  await purgeExpiredRecords();
  // Fuera del horario del QR (por ejemplo a la 1 am) las cuentas abiertas pasan solas a "pidió la cuenta".
  const [settings, windows] = await Promise.all([prisma.businessSettings.findUnique({ where: { id: "default" } }), prisma.serviceWindow.findMany()]);
  // Solo al cierre del horario: una pausa momentánea del QR no debe pedir la cuenta de todas las mesas.
  const hoursEnded = settings ? resolveServiceMode(new Date(), settings.timezone, windows, settings.manualMode) === "COUNTER_ONLY" : false;
  const billsRequested = hoursEnded ? await tableTabRepository.requestBillForOpenTabs() : 0;
  return NextResponse.json({ ok: true, closed: sessions.closed, cancelledOrders: orders.cancelled, billsRequested });
}
