import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as createOrderRoute } from "@/app/api/public/orders/route";
import { GET as customerTabRoute } from "@/app/api/public/tab/route";
import { POST as requestBillRoute } from "@/app/api/public/tab/bill/route";
import { GET as staffTabsRoute } from "@/app/api/staff/tabs/route";
import { POST as settleRoute } from "@/app/api/staff/tabs/settle/route";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/security/token";
import { hashPassword } from "@/modules/auth/password";
import { STAFF_SESSION_COOKIE } from "@/modules/auth/auth-service";
import { customerSessionService } from "@/modules/tables/customer-session-service";

const suffix = randomUUID();
const qrToken = randomBytes(24).toString("base64url");
const clientIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
let tableId = "";
let categoryId = "";
let productId = "";
let staffId = "";
let staffToken = "";
let anaToken = "";
let betoToken = "";
let anaSessionId = "";
let previousBusinessSettings: Awaited<ReturnType<typeof prisma.businessSettings.findUnique>> = null;
let previousPaymentSettings: Awaited<ReturnType<typeof prisma.paymentSettings.findUnique>> = null;

function call(url: string, init: ConstructorParameters<typeof NextRequest>[1] = {}) {
  return new NextRequest(url, init);
}
const customerHeaders = (token: string) => ({ "content-type": "application/json", cookie: `customer_session=${token}`, "x-forwarded-for": clientIp });
const staffHeaders = () => ({ "content-type": "application/json", cookie: `${STAFF_SESSION_COOKIE}=${staffToken}`, origin: "http://localhost" });

async function orderOnTab(token: string, quantity = 1) {
  return createOrderRoute(call("http://localhost/api/public/orders", {
    method: "POST",
    headers: customerHeaders(token),
    body: JSON.stringify({ clientRequestId: randomUUID(), expectedTotalCents: 1000 * quantity, paymentMethod: "ON_TAB", items: [{ productId, quantity, optionValueIds: [] }] }),
  }));
}

describe("table tab: order now, pay at the end", () => {
  beforeAll(async () => {
    previousBusinessSettings = await prisma.businessSettings.findUnique({ where: { id: "default" } });
    previousPaymentSettings = await prisma.paymentSettings.findUnique({ where: { id: "default" } });
    await prisma.businessSettings.upsert({ where: { id: "default" }, create: { id: "default", name: "Bar de integración", manualMode: "FORCE_QR_OPEN" }, update: { manualMode: "FORCE_QR_OPEN" } });
    await prisma.paymentSettings.upsert({ where: { id: "default" }, create: { id: "default", tabEnabled: true }, update: { tabEnabled: true } });
    tableId = (await prisma.diningTable.create({ data: { label: `Cuenta ${suffix}`, qrToken } })).id;
    categoryId = (await prisma.category.create({ data: { name: `Cuenta ${suffix}` } })).id;
    productId = (await prisma.product.create({ data: { categoryId, name: `Cerveza ${suffix}`, description: "", priceCents: 1000 } })).id;
    const staff = await prisma.staffUser.create({ data: { email: `tab-${suffix}@local.test`, displayName: "Mozo prueba", passwordHash: await hashPassword("integration password"), role: "OPERATOR" } });
    staffId = staff.id;
    staffToken = randomBytes(32).toString("base64url");
    await prisma.staffSession.create({ data: { tokenHash: hashToken(staffToken), userId: staffId, expiresAt: new Date(Date.now() + 3_600_000) } });
    const ana = await customerSessionService.create(qrToken, "Ana", clientIp);
    const beto = await customerSessionService.create(qrToken, "Beto", `${clientIp}-b`);
    anaToken = ana.token;
    anaSessionId = ana.principal.id;
    betoToken = beto.token;
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { tableId } });
    await prisma.auditEvent.deleteMany({ where: { actorStaffId: staffId } });
    await prisma.staffSession.deleteMany({ where: { userId: staffId } });
    if (staffId) await prisma.staffUser.delete({ where: { id: staffId } });
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.customerSession.deleteMany({ where: { tableId } });
    await prisma.diningTable.deleteMany({ where: { id: tableId } });
    await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: "qr-order:" } } });
    if (previousBusinessSettings) await prisma.businessSettings.update({ where: { id: "default" }, data: { manualMode: previousBusinessSettings.manualMode } });
    else await prisma.businessSettings.deleteMany({ where: { id: "default" } });
    if (previousPaymentSettings) await prisma.paymentSettings.update({ where: { id: "default" }, data: previousPaymentSettings });
    else await prisma.paymentSettings.deleteMany({ where: { id: "default" } });
  });

  it("sends the order to the kitchen unpaid and shows each person only their own part", async () => {
    const first = await orderOnTab(anaToken, 2);
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({ status: "CONFIRMED", totalCents: 2000 });
    expect((await orderOnTab(betoToken, 1)).status).toBe(201);

    const anaTab = await (await customerTabRoute(call("http://localhost/api/public/tab", { headers: customerHeaders(anaToken) }))).json();
    expect(anaTab.mine.totalCents).toBe(2000);
    expect(anaTab.tableTotalCents).toBe(3000);
    expect(JSON.stringify(anaTab)).not.toContain("Beto");
  });

  it("flags the table when it asks for the bill and lists it first for staff", async () => {
    const response = await requestBillRoute(call("http://localhost/api/public/tab/bill", { method: "POST", headers: customerHeaders(betoToken) }));
    expect(response.status).toBe(200);
    const tabs = await (await staffTabsRoute(call("http://localhost/api/staff/tabs", { headers: staffHeaders() }))).json();
    const table = tabs.find((entry: { id: string }) => entry.id === tableId);
    expect(table.billRequestedAt).not.toBeNull();
    expect(table.totalCents).toBe(3000);
    expect(table.people.map((person: { name: string }) => person.name).sort()).toEqual(["Ana", "Beto"]);
  });

  it("settles one person, then the rest, and clears the bill request", async () => {
    const settle = (body: object) => settleRoute(call("http://localhost/api/staff/tabs/settle", { method: "POST", headers: staffHeaders(), body: JSON.stringify(body) }));
    const ana = await settle({ tableId, customerSessionId: anaSessionId, method: "CASH" });
    expect(await ana.json()).toEqual({ settledOrders: 1, settledCents: 2000 });
    expect((await prisma.diningTable.findUnique({ where: { id: tableId } }))?.billRequestedAt).not.toBeNull();

    const rest = await settle({ tableId, method: "BANK_TRANSFER" });
    expect(await rest.json()).toEqual({ settledOrders: 1, settledCents: 1000 });
    expect((await prisma.diningTable.findUnique({ where: { id: tableId } }))?.billRequestedAt).toBeNull();
    const payments = await prisma.paymentAttempt.findMany({ where: { order: { tableId } }, orderBy: { amountCents: "desc" } });
    expect(payments.map((payment) => [payment.method, payment.status])).toEqual([["CASH", "APPROVED"], ["BANK_TRANSFER", "APPROVED"]]);

    const again = await settle({ tableId, method: "CASH" });
    expect(again.status).toBe(409);
  });

  it("refuses pay-at-the-end when the owner has it switched off", async () => {
    await prisma.paymentSettings.update({ where: { id: "default" }, data: { tabEnabled: false } });
    const response = await orderOnTab(anaToken);
    expect(response.status).toBe(409);
    await prisma.paymentSettings.update({ where: { id: "default" }, data: { tabEnabled: true } });
  });

  it("does not let a stranger read or settle a tab", async () => {
    expect((await staffTabsRoute(call("http://localhost/api/staff/tabs"))).status).toBe(401);
    expect((await customerTabRoute(call("http://localhost/api/public/tab"))).status).toBe(401);
  });
});
