import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/modules/auth/require-staff";
export async function GET(request: NextRequest) { const principal = await requireStaff(request, ["ADMIN"]); if (principal instanceof NextResponse) return principal; const params = request.nextUrl.searchParams; return NextResponse.json(await prisma.auditEvent.findMany({ where: { action: params.get("action") || undefined, actorStaffId: params.get("actor") || undefined, entityType: params.get("entityType") || undefined }, orderBy: { createdAt: "desc" }, take: Math.min(Number(params.get("take") || 50), 100) })); }
