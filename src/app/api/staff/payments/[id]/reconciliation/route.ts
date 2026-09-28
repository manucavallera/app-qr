import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { validateRefundRequest } from "@/modules/payments/refund-validation";
const schema = z.object({ status: z.enum(["REFUNDED", "PARTIALLY_REFUNDED"]), refundedCents: z.number().int().positive(), note: z.string().trim().min(1).max(500) });
type RouteContext = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, { params }: RouteContext) {
  const principal = await requireStaff(request, ["ADMIN"]);
  if (principal instanceof NextResponse) return principal;
  try {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "PaymentAttempt" WHERE id = ${id} FOR UPDATE`;
      if (locked.length === 0) return null;
      const payment = await tx.paymentAttempt.findUnique({ where: { id } });
      if (!payment) return null;
      validateRefundRequest({
        paymentStatus: payment.status,
        amountCents: payment.amountCents,
        refundedCents: payment.refundedCents,
        requestedStatus: body.status,
        requestedRefundedCents: body.refundedCents,
      });
      const updated = await tx.paymentAttempt.update({ where: { id }, data: { status: body.status, refundedCents: body.refundedCents } });
      await tx.auditEvent.create({ data: { actorStaffId: principal.userId, action: "PAYMENT_RECONCILED", entityType: "PaymentAttempt", entityId: id, metadata: { note: body.note, refundedCents: body.refundedCents } } });
      return updated;
    });
    if (!result) return NextResponse.json({ error: "PAYMENT_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ id: result.id, status: result.status, refundedCents: result.refundedCents });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
