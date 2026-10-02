import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as createOrderRoute } from "@/app/api/public/orders/route";
import { GET as ownOrderRoute } from "@/app/api/public/orders/[id]/route";
import { POST as confirmPaymentRoute } from "@/app/api/staff/orders/[id]/confirm-traditional/route";
import { POST as counterOrderRoute } from "@/app/api/staff/orders/route";
import { GET as pendingPaymentsRoute } from "@/app/api/staff/payments/pending/route";
import { GET as commandsRoute } from "@/app/api/staff/commands/route";
import { POST as rejectPaymentRoute } from "@/app/api/staff/orders/[id]/reject-payment/route";
import { prisma } from "@/lib/db";
import { AuthService } from "@/modules/auth/auth-service";
import { customerSessionService } from "@/modules/tables/customer-session-service";
import { hashPassword } from "@/modules/auth/password";
import { cancelStaleUnpaidOrders, UNPAID_CANCELLATION_REASON, UNPAID_ORDER_TTL_MS } from "@/modules/orders/stale-orders";

const suffix = randomUUID();
const firstQrToken = randomBytes(24).toString("base64url");
const secondQrToken = randomBytes(24).toString("base64url");
const clientIp = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
const clientRequestId = randomUUID();
let tableId = "";
let categoryId = "";
let productId = "";
let optionValueId = "";
let adminId = "";
let adminToken = "";
let firstSessionToken = "";
let secondSessionToken = "";
let previousBusinessSettings: Awaited<ReturnType<typeof prisma.businessSettings.findUnique>> = null;
let previousPaymentSettings: Awaited<ReturnType<typeof prisma.paymentSettings.findUnique>> = null;

const createBody = (expectedTotalCents = 5100, id = clientRequestId, paymentMethod: "MERCADO_PAGO" | "CASH" | "CARD_AT_COUNTER" | "BANK_TRANSFER" = "CASH") => ({
  clientRequestId: id,
  expectedTotalCents,
  paymentMethod,
  items: [{ productId, quantity: 1, optionValueIds: [optionValueId], notes: "sin cebolla" }],
});

function request(url: string, options: ConstructorParameters<typeof NextRequest>[1] = {}) {
  return new NextRequest(url, options);
}

async function createQrOrder(token: string, body: unknown = createBody()) {
  return createOrderRoute(request("http://localhost/api/public/orders", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `customer_session=${token}`, "x-forwarded-for": clientIp },
    body: JSON.stringify(body),
  }));
}

describe("customer and counter order flow", () => {
  beforeAll(async () => {
    previousBusinessSettings = await prisma.businessSettings.findUnique({ where: { id: "default" } });
    previousPaymentSettings = await prisma.paymentSettings.findUnique({ where: { id: "default" } });
    await prisma.businessSettings.upsert({
      where: { id: "default" },
      create: { id: "default", name: "Bar de integración", manualMode: "FORCE_QR_OPEN" },
      update: { manualMode: "FORCE_QR_OPEN" },
    });
    await prisma.paymentSettings.upsert({
      where: { id: "default" },
      create: { id: "default", cashEnabled: true, cardAtCounterEnabled: true, bankTransferEnabled: true, bankAlias: "bar.prueba" },
      update: { cashEnabled: true, cardAtCounterEnabled: true, bankTransferEnabled: true, bankAlias: "bar.prueba" },
    });
    const table = await prisma.diningTable.create({
      data: { label: `Pedidos ${suffix}`, qrToken: firstQrToken },
    });
    tableId = table.id;
    const category = await prisma.category.create({ data: { name: `Pedidos ${suffix}` } });
    categoryId = category.id;
    const product = await prisma.product.create({
      data: {
        categoryId,
        name: `Hamburguesa ${suffix}`,
        description: "",
        priceCents: 4500,
        optionGroups: { create: { name: "Extra", required: true, minSelections: 1, maxSelections: 1, values: { create: { name: "Queso", priceDeltaCents: 600 } } } },
      },
      include: { optionGroups: { include: { values: true } } },
    });
    productId = product.id;
    optionValueId = product.optionGroups[0]!.values[0]!.id;
    const admin = await prisma.staffUser.create({
      data: { email: `order-${suffix}@local.test`, displayName: "Caja prueba", passwordHash: await hashPassword("integration password"), role: "ADMIN" },
    });
    adminId = admin.id;
    const adminSession = await new AuthService({
      findUserByEmail: async () => ({ ...admin, active: true }),
      createSession: async (session) => { await prisma.staffSession.create({ data: { tokenHash: session.tokenHash, userId: session.userId, expiresAt: session.expiresAt } }); },
      findSessionByTokenHash: async () => null,
      deleteSessionByTokenHash: async () => undefined,
    }).login(admin.email, "integration password");
    adminToken = adminSession.token;
    const first = await customerSessionService.create(firstQrToken, "Ana", clientIp);
    const secondTable = await prisma.diningTable.create({ data: { label: `Pedidos 2 ${suffix}`, qrToken: secondQrToken } });
    const second = await customerSessionService.create(secondQrToken, "Luis", `${clientIp}-second`);
    firstSessionToken = first.token;
    secondSessionToken = second.token;
    void secondTable;
  });

  afterAll(async () => {
    const orderIds = await prisma.order.findMany({ where: { OR: [{ customerSession: { table: { qrToken: { in: [firstQrToken, secondQrToken] } } } }, { createdByStaffId: adminId }] }, select: { id: true } });
    const ids = orderIds.map((order) => order.id);
    if (ids.length) await prisma.order.deleteMany({ where: { id: { in: ids } } });
    await prisma.auditEvent.deleteMany({ where: { actorStaffId: adminId } });
    await prisma.staffSession.deleteMany({ where: { userId: adminId } });
    if (adminId) await prisma.staffUser.delete({ where: { id: adminId } });
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.customerSession.deleteMany({ where: { table: { qrToken: { in: [firstQrToken, secondQrToken] } } } });
    await prisma.diningTable.deleteMany({ where: { qrToken: { in: [firstQrToken, secondQrToken] } } });
    await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: "qr-order:" } } });
    if (previousBusinessSettings) {
      await prisma.businessSettings.update({ where: { id: "default" }, data: { manualMode: previousBusinessSettings.manualMode } });
    } else {
      await prisma.businessSettings.deleteMany({ where: { id: "default" } });
    }
    if (previousPaymentSettings) {
      await prisma.paymentSettings.update({ where: { id: "default" }, data: previousPaymentSettings });
    } else {
      await prisma.paymentSettings.deleteMany({ where: { id: "default" } });
    }
  });

  it("creates one unpaid order and returns it for an idempotent retry", async () => {
    const first = await createQrOrder(firstSessionToken);
    const firstBody = await first.json();
    const retry = await createQrOrder(firstSessionToken);
    const retryBody = await retry.json();

    expect(first.status).toBe(201);
    expect(firstBody).toMatchObject({ status: "AWAITING_PAYMENT", totalCents: 5100 });
    expect(retry.status).toBe(200);
    expect(retryBody.id).toBe(firstBody.id);
    expect(await prisma.order.count({ where: { clientRequestId } })).toBe(1);
    await expect(prisma.paymentAttempt.findMany({ where: { orderId: firstBody.id } })).resolves.toMatchObject([
      expect.objectContaining({ method: "CASH", status: "UNPAID", amountCents: 5100 }),
    ]);

    const anotherCustomer = await ownOrderRoute(
      request(`http://localhost/api/public/orders/${firstBody.id}`, { headers: { cookie: `customer_session=${secondSessionToken}` } }),
      { params: Promise.resolve({ id: firstBody.id }) },
    );
    expect(anotherCustomer.status).toBe(404);
    const owner = await ownOrderRoute(
      request(`http://localhost/api/public/orders/${firstBody.id}`, { headers: { cookie: `customer_session=${firstSessionToken}` } }),
      { params: Promise.resolve({ id: firstBody.id }) },
    );
    expect(owner.status).toBe(200);
    expect(JSON.stringify(await owner.json())).not.toContain("Luis");
  });

  it("returns a fresh quote when the cart price changed and rejects invalid options and quantities", async () => {
    const priceChanged = await createQrOrder(firstSessionToken, createBody(4000, randomUUID()));
    expect(priceChanged.status).toBe(409);
    await expect(priceChanged.json()).resolves.toMatchObject({ error: "PRICE_CHANGED", quote: { totalCents: 5100 } });

    const missingOption = await createQrOrder(firstSessionToken, { ...createBody(4500, randomUUID()), items: [{ productId, quantity: 1, optionValueIds: [] }] });
    expect(missingOption.status).toBe(400);
    const invalidQuantity = await createQrOrder(firstSessionToken, { ...createBody(5100, randomUUID()), items: [{ productId, quantity: 21, optionValueIds: [optionValueId] }] });
    expect(invalidQuantity.status).toBe(400);

    await prisma.product.update({ where: { id: productId }, data: { available: false } });
    const unavailable = await createQrOrder(firstSessionToken, createBody(5100, randomUUID()));
    expect(unavailable.status).toBe(409);
    await expect(unavailable.json()).resolves.toMatchObject({ error: "PRODUCT_UNAVAILABLE" });
    await prisma.product.update({ where: { id: productId }, data: { available: true } });
  });

  it("blocks QR ordering outside the window but allows counter orders and confirms payments once", async () => {
    await prisma.businessSettings.update({ where: { id: "default" }, data: { manualMode: "FORCE_COUNTER_ONLY" } });
    const closed = await createQrOrder(firstSessionToken, createBody(5100, randomUUID()));
    expect(closed.status).toBe(409);
    await expect(closed.json()).resolves.toMatchObject({ error: "QR_ORDERING_CLOSED" });

    const counter = await counterOrderRoute(request("http://localhost/api/staff/orders", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `staff_session=${adminToken}` },
      body: JSON.stringify({ ...createBody(5100, randomUUID()), nickname: "Cliente de caja", tableId, paymentMethod: "CASH" }),
    }));
    expect(counter.status).toBe(201);
    const counterBody = await counter.json();
    expect(counterBody).toMatchObject({ status: "CONFIRMED", origin: "COUNTER", customerName: "Cliente de caja" });

    await prisma.businessSettings.update({ where: { id: "default" }, data: { manualMode: "FORCE_QR_OPEN" } });
    const pending = await createQrOrder(firstSessionToken, createBody(5100, randomUUID()));
    const pendingBody = await pending.json();
    const confirm = (version = pendingBody.version) => confirmPaymentRoute(
      request(`http://localhost/api/staff/orders/${pendingBody.id}/confirm-traditional`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `staff_session=${adminToken}` },
        body: JSON.stringify({ method: "CASH", expectedOrderVersion: version }),
      }),
      { params: Promise.resolve({ id: pendingBody.id }) },
    );
    const firstConfirmation = await confirm();
    const secondConfirmation = await confirm(2);
    expect(firstConfirmation.status).toBe(200);
    expect(secondConfirmation.status).toBe(200);
    expect(await prisma.orderStatusEvent.count({ where: { orderId: pendingBody.id } })).toBe(2);
    expect(await prisma.paymentAttempt.count({ where: { orderId: pendingBody.id, status: "APPROVED" } })).toBe(1);
  });

  it("keeps bank-transfer orders out of commands until Caja confirms them", async () => {
    const transfer = await createQrOrder(firstSessionToken, createBody(5100, randomUUID(), "BANK_TRANSFER"));
    const transferBody = await transfer.json();
    expect(transfer.status).toBe(201);
    expect(transferBody.payments).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: "BANK_TRANSFER", status: "UNPAID" }),
    ]));

    const pending = await pendingPaymentsRoute(new NextRequest("http://localhost/api/staff/payments/pending", { headers: { cookie: `staff_session=${adminToken}` } }));
    const pendingBody = await pending.json();
    expect(pendingBody).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: transferBody.id, payments: expect.arrayContaining([expect.objectContaining({ method: "BANK_TRANSFER" })]) }),
    ]));

    const beforeConfirmation = await commandsRoute(new NextRequest("http://localhost/api/staff/commands?station=GENERAL", { headers: { cookie: `staff_session=${adminToken}` } }));
    expect((await beforeConfirmation.json()).some((order: { id: string }) => order.id === transferBody.id)).toBe(false);

    const confirmRequest = new NextRequest(`http://localhost/api/staff/orders/${transferBody.id}/confirm-traditional`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `staff_session=${adminToken}` },
      body: JSON.stringify({ method: "BANK_TRANSFER", expectedOrderVersion: transferBody.version }),
    });
    const confirmed = await confirmPaymentRoute(confirmRequest, { params: Promise.resolve({ id: transferBody.id }) });
    expect(confirmed.status).toBe(200);
    expect((await confirmed.json()).status).toBe("CONFIRMED");

    const rejected = await createQrOrder(firstSessionToken, createBody(5100, randomUUID(), "BANK_TRANSFER"));
    const rejectedBody = await rejected.json();
    const reject = await rejectPaymentRoute(
      new NextRequest(`http://localhost/api/staff/orders/${rejectedBody.id}/reject-payment`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `staff_session=${adminToken}` },
        body: JSON.stringify({ reason: "No se encontró la transferencia.", expectedOrderVersion: rejectedBody.version }),
      }),
      { params: Promise.resolve({ id: rejectedBody.id }) },
    );
    expect(reject.status).toBe(200);
    expect((await reject.json()).status).toBe("CANCELLED");
  });

  it("cancels unpaid orders past the time limit and leaves recent ones waiting", async () => {
    const stale = await (await createQrOrder(firstSessionToken, createBody(5100, randomUUID()))).json();
    const recent = await (await createQrOrder(firstSessionToken, createBody(5100, randomUUID()))).json();
    const now = new Date();
    await prisma.order.update({ where: { id: stale.id }, data: { createdAt: new Date(now.getTime() - UNPAID_ORDER_TTL_MS - 60_000) } });

    await cancelStaleUnpaidOrders(now);

    await expect(prisma.order.findUnique({ where: { id: stale.id } })).resolves.toMatchObject({
      status: "CANCELLED",
      cancellationReason: UNPAID_CANCELLATION_REASON,
      version: stale.version + 1,
    });
    expect(await prisma.paymentAttempt.count({ where: { orderId: stale.id, status: "REJECTED" } })).toBe(1);
    expect(await prisma.orderStatusEvent.count({ where: { orderId: stale.id, toStatus: "CANCELLED" } })).toBe(1);
    await expect(prisma.order.findUnique({ where: { id: recent.id } })).resolves.toMatchObject({ status: "AWAITING_PAYMENT" });
    await prisma.auditEvent.deleteMany({ where: { action: "ORDER_EXPIRED_UNPAID", entityId: stale.id } });
  });

  it("reserves stock on order, returns it on rejection and blocks orders beyond what is left", async () => {
    const stock = async () => (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity;
    await prisma.product.update({ where: { id: productId }, data: { stockQuantity: 2 } });

    const ordered = await (await createQrOrder(firstSessionToken, createBody(5100, randomUUID()))).json();
    expect(await stock()).toBe(1);

    const reject = await rejectPaymentRoute(
      new NextRequest(`http://localhost/api/staff/orders/${ordered.id}/reject-payment`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `staff_session=${adminToken}` },
        body: JSON.stringify({ reason: "El cliente no pagó.", expectedOrderVersion: ordered.version }),
      }),
      { params: Promise.resolve({ id: ordered.id }) },
    );
    expect(reject.status).toBe(200);
    expect(await stock()).toBe(2);

    const tooMany = await createQrOrder(firstSessionToken, { ...createBody(15300, randomUUID()), items: [{ productId, quantity: 3, optionValueIds: [optionValueId] }] });
    expect(tooMany.status).toBe(409);
    await expect(tooMany.json()).resolves.toMatchObject({ error: "INSUFFICIENT_STOCK", available: 2 });
    expect(await stock()).toBe(2);

    await prisma.product.update({ where: { id: productId }, data: { stockQuantity: 0 } });
    const soldOut = await createQrOrder(firstSessionToken, createBody(5100, randomUUID()));
    expect(soldOut.status).toBe(409);
    await expect(soldOut.json()).resolves.toMatchObject({ error: "PRODUCT_UNAVAILABLE" });

    await prisma.product.update({ where: { id: productId }, data: { stockQuantity: null } });
  });
});
