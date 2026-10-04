import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as reconcile } from "@/app/api/staff/payments/[id]/reconciliation/route";
import { GET as summary } from "@/app/api/staff/summary/route";
import { hashToken } from "@/lib/security/token";
import { prisma } from "@/lib/db";
import { STAFF_SESSION_COOKIE, type StaffRole } from "@/modules/auth/auth-service";
import { hashPassword } from "@/modules/auth/password";

const unique = randomUUID();
const tokens: Record<StaffRole, string> = { ADMIN: `refund-admin-${unique}`, OPERATOR: `refund-operator-${unique}` };
const userIds: string[] = [];
let orderId = "";
let attemptId = "";
let orderNumber = 0;

async function makeSession(role: StaffRole) {
  const user = await prisma.staffUser.create({ data: { email: `refund-${role.toLowerCase()}-${unique}@local.test`, displayName: role, passwordHash: await hashPassword("integration password"), role } });
  userIds.push(user.id);
  await prisma.staffSession.create({ data: { tokenHash: hashToken(tokens[role]), userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) } });
}

const asRole = (role: StaffRole, url: string, init?: { method?: string; body?: unknown }) => new NextRequest(`http://localhost${url}`, {
  method: init?.method ?? "GET",
  headers: { "content-type": "application/json", cookie: `${STAFF_SESSION_COOKIE}=${tokens[role]}` },
  ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
});

const dueNumbers = async () => ((await (await summary(asRole("ADMIN", "/api/staff/summary"))).json()) as { refundsDue: { orderNumber: number }[] }).refundsDue.map((payment) => payment.orderNumber);
const refundRequest = (role: StaffRole) => reconcile(asRole(role, `/api/staff/payments/${attemptId}/reconciliation`, { method: "POST", body: { status: "REFUNDED", refundedCents: 9500, note: "Devuelto" } }), { params: Promise.resolve({ id: attemptId }) });

describe("money to return after a cancelled paid order", () => {
  beforeAll(async () => {
    await makeSession("ADMIN");
    await makeSession("OPERATOR");
    const order = await prisma.order.create({ data: { clientRequestId: `refund-${unique}`, origin: "QR", totalCents: 9500, status: "CANCELLED" } });
    orderId = order.id;
    orderNumber = order.number;
    attemptId = (await prisma.paymentAttempt.create({ data: { orderId, method: "MERCADO_PAGO", status: "APPROVED", amountCents: 9500, idempotencyKey: `refund-key-${unique}` } })).id;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { OR: [{ entityId: attemptId }, { actorStaffId: { in: userIds } }] } });
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.staffSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.staffUser.deleteMany({ where: { id: { in: userIds } } });
  });

  it("lists an approved payment whose order was cancelled", async () => {
    expect(await dueNumbers()).toContain(orderNumber);
  });

  it("does not let an operator register the return", async () => {
    expect((await refundRequest("OPERATOR")).status).toBe(403);
    expect(await dueNumbers()).toContain(orderNumber);
  });

  it("stops listing it once an administrator marks it as returned", async () => {
    expect((await refundRequest("ADMIN")).status).toBe(200);
    expect(await dueNumbers()).not.toContain(orderNumber);
  });
});
