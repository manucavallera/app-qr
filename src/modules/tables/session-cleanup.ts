import { prisma } from "../../lib/db";
import { resolveServiceMode } from "../operations/service-mode";
import type { ManualMode } from "../operations/service-mode";
import type { OrderStatus } from "../../generated/prisma/client";

/**
 * Closes idle CustomerSessions when the service window has ended.
 *
 * Called every 60 seconds by the instrumentation.ts background job, and also
 * available via GET /api/internal/session-cleanup for manual ops triggers.
 *
 * Logic:
 *   1. Load BusinessSettings + ServiceWindows from the DB.
 *   2. Resolve the current ServiceMode.
 *   3. If NOT QR_OPEN: close every session that has been open for at least
 *      15 minutes and has no in-progress orders.
 *      Sessions tied to active orders stay open so the customer can track them.
 */
export async function closeExpiredSessions(now = new Date()): Promise<{ closed: number }> {
  const [settings, windows] = await Promise.all([
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
    prisma.serviceWindow.findMany(),
  ]);

  if (!settings) return { closed: 0 };

  const mode = resolveServiceMode(
    now,
    settings.timezone,
    windows,
    settings.manualMode as ManualMode,
  );

  // Only close sessions when the bar is not actively serving QR orders.
  if (mode === "QR_OPEN") return { closed: 0 };

  // Keep sessions with an active in-progress order open so the customer can track them.
  const activeStatuses: OrderStatus[] = ["AWAITING_PAYMENT", "CONFIRMED", "PREPARING", "READY"];

  const result = await prisma.customerSession.updateMany({
    where: {
      closedAt: null,
      expiresAt: { gt: now },
      createdAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) },
      orders: { none: { status: { in: activeStatuses } } },
    },
    data: { closedAt: now },
  });

  if (result.count > 0) {
    console.info(JSON.stringify({
      event: "session-cleanup",
      closed: result.count,
      mode,
      timestamp: now.toISOString(),
    }));
  }

  return { closed: result.count };
}

/** Deletes rows that only grow: expired staff sessions and spent rate-limit buckets. */
export async function purgeExpiredRecords(now = new Date()): Promise<{ purged: number }> {
  const [sessions, buckets] = await Promise.all([
    prisma.staffSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.rateLimitBucket.deleteMany({ where: { resetsAt: { lt: now } } }),
  ]);
  return { purged: sessions.count + buckets.count };
}
