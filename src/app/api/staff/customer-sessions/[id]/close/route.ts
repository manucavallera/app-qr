import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/modules/auth/require-staff";
type RouteContext = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, { params }: RouteContext) { const principal = await requireStaff(request, ["ADMIN", "OPERATOR"]); if (principal instanceof NextResponse) return principal; const { id } = await params; await prisma.customerSession.update({ where: { id }, data: { closedAt: new Date() } }); await prisma.auditEvent.create({ data: { actorStaffId: principal.userId, action: "CUSTOMER_SESSION_CLOSED", entityType: "CustomerSession", entityId: id, metadata: {} } }); return NextResponse.json({ ok: true }); }
