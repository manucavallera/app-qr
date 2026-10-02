import { type NextRequest, NextResponse } from "next/server";
import { cancelStaleUnpaidOrders } from "@/modules/orders/stale-orders";
import { closeExpiredSessions } from "@/modules/tables/session-cleanup";
import { getServerEnv } from "@/lib/env";

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
  return NextResponse.json({ ok: true, closed: sessions.closed, cancelledOrders: orders.cancelled });
}
