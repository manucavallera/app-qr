import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-errors";

// Ready orders leave the bar display after this long even if nobody marks them delivered.
const READY_VISIBLE_MS = 30 * 60 * 1000;

/** Public feed for the bar display: order numbers only, never names or items. */
export async function GET(): Promise<NextResponse> {
  try {
    const [preparing, ready] = await Promise.all([
      prisma.order.findMany({
        where: { status: { in: ["CONFIRMED", "PREPARING"] } },
        orderBy: { createdAt: "asc" },
        select: { number: true },
        take: 40,
      }),
      prisma.order.findMany({
        where: { status: "READY", updatedAt: { gte: new Date(Date.now() - READY_VISIBLE_MS) } },
        orderBy: { updatedAt: "desc" },
        select: { number: true },
        take: 20,
      }),
    ]);
    return NextResponse.json(
      { preparing: preparing.map((order) => order.number), ready: ready.map((order) => order.number) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
