import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
const schema = z.object({ status: z.enum(["REFUNDED", "PARTIALLY_REFUNDED"]), refundedCents: z.number().int().positive(), note: z.string().trim().min(1).max(500) });
type RouteContext = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, { params }: RouteContext) { const principal = await requireStaff(request, ["ADMIN"]); if (principal instanceof NextResponse) return principal; try { const { id } = await params; const body = schema.parse(await request.json()); const payment = await prisma.paymentAttempt.findUnique({ where: { id } }); if (!payment || body.refundedCents > payment.amountCents) return NextResponse.json({ error: "INVALID_REFUND_AMOUNT" }, { status: 400 }); const result = await prisma.$transaction(async (tx) => { const updated = await tx.paymentAttempt.update({ where: { id }, data: { status: body.status, refundedCents: body.refundedCents } }); await tx.auditEvent.create({ data: { actorStaffId: principal.userId, action: "PAYMENT_RECONCILED", entityType: "PaymentAttempt", entityId: id, metadata: { note: body.note, refundedCents: body.refundedCents } } }); return updated; }); return NextResponse.json({ id: result.id, status: result.status, refundedCents: result.refundedCents }); } catch (error) { return apiErrorResponse(error); } }
