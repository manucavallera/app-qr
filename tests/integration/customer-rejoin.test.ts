import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as createSessionRoute, GET as currentSessionRoute } from "@/app/api/public/qr/[qrToken]/session/route";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/security/token";
import { customerSessionService } from "@/modules/tables/customer-session-service";

const suffix = randomUUID();
const qrToken = randomBytes(24).toString("base64url");
const context = { params: Promise.resolve({ qrToken }) };
let tableId = "";
let calls = 0;

// Every call comes from a different address so the hourly limit per QR and IP never interferes.
function start(body: { nickname: string; rejoin?: boolean }) {
  calls += 1;
  return createSessionRoute(
    new NextRequest(`http://localhost/api/public/qr/${qrToken}/session`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${calls}` },
      body: JSON.stringify(body),
    }),
    context,
  );
}

const tokenOf = (response: Response & { cookies: { get(name: string): { value: string } | undefined } }) => response.cookies.get("customer_session")!.value;

async function people(): Promise<string[]> {
  const response = await currentSessionRoute(new NextRequest(`http://localhost/api/public/qr/${qrToken}/session`), context);
  return (await response.json() as { people: string[] }).people;
}

/** Puts an order on the table's tab for that session: unpaid unless told otherwise. */
async function orderOnTab(token: string, tabId: string, paid = false) {
  const session = await prisma.customerSession.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
  await prisma.order.create({
    data: {
      clientRequestId: randomUUID(), origin: "QR", status: "DELIVERED", totalCents: 1000, tableId, tabId, customerSessionId: session.id,
      payments: { create: { method: paid ? "CASH" : "ON_TAB", status: paid ? "APPROVED" : "UNPAID", amountCents: 1000, idempotencyKey: randomUUID() } },
    },
  });
  return session.id;
}

describe("coming back to a table", () => {
  let tabId = "";

  beforeAll(async () => {
    tableId = (await prisma.diningTable.create({ data: { label: `Rejoin ${suffix}`, qrToken } })).id;
    tabId = (await prisma.tableTab.create({ data: { tableId } })).id;
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { tableId } });
    await prisma.tableTab.deleteMany({ where: { tableId } });
    await prisma.customerSession.deleteMany({ where: { tableId } });
    await prisma.diningTable.delete({ where: { id: tableId } });
  });

  it("offers nobody while no one owes anything, so the same name is just a new person", async () => {
    const first = await start({ nickname: "Dana" });
    expect(first.status).toBe(201);
    expect(await people()).toEqual([]);

    const second = await start({ nickname: "Dana" });
    expect(second.status).toBe(201);
    expect(tokenOf(second)).not.toBe(tokenOf(first));
  });

  it("asks before sharing the name of someone who owes on the tab, whatever the capitals", async () => {
    const beto = await start({ nickname: "Beto" });
    await orderOnTab(tokenOf(beto), tabId);

    expect(await people()).toEqual(["Beto"]);
    const sameName = await start({ nickname: "  beto " });
    expect(sameName.status).toBe(409);
    await expect(sameName.json()).resolves.toEqual({ error: "NICKNAME_IN_USE" });
    expect(sameName.cookies.get("customer_session")).toBeUndefined();

    const other = await start({ nickname: "Beto R." });
    expect(other.status).toBe(201);
  });

  it("continues as that person from another phone and signs the first phone out", async () => {
    const caro = await start({ nickname: "Caro" });
    const caroId = await orderOnTab(tokenOf(caro), tabId);

    const back = await start({ nickname: "caro", rejoin: true });
    expect(back.status).toBe(201);
    await expect(back.json()).resolves.toEqual({ nickname: "Caro" });

    await expect(customerSessionService.authenticate(tokenOf(back), qrToken)).resolves.toMatchObject({ id: caroId, nickname: "Caro" });
    await expect(customerSessionService.authenticate(tokenOf(caro), qrToken)).resolves.toBeNull();
    expect(await prisma.customerSession.count({ where: { tableId, nickname: "Caro" } })).toBe(1);
  });

  it("brings back a session that had expired or been closed while it still owes", async () => {
    const eli = await start({ nickname: "Eli" });
    const eliId = await orderOnTab(tokenOf(eli), tabId);
    await prisma.customerSession.update({ where: { id: eliId }, data: { closedAt: new Date(), expiresAt: new Date(Date.now() - 1000) } });

    const back = await start({ nickname: "Eli", rejoin: true });
    await expect(customerSessionService.authenticate(tokenOf(back), qrToken)).resolves.toMatchObject({ id: eliId });
  });

  it("never offers someone who already paid or whose tab is closed", async () => {
    const paid = await start({ nickname: "Fede" });
    await orderOnTab(tokenOf(paid), tabId, true);
    const oldTab = await prisma.tableTab.create({ data: { tableId, closedAt: new Date() } });
    const earlier = await start({ nickname: "Gabi" });
    await orderOnTab(tokenOf(earlier), oldTab.id);

    const offered = await people();
    expect(offered).not.toContain("Fede");
    expect(offered).not.toContain("Gabi");

    // With nobody to continue as, asking to rejoin is just a new person: the earlier party's orders stay theirs.
    const newcomer = await start({ nickname: "Gabi", rejoin: true });
    expect(newcomer.status).toBe(201);
    expect(tokenOf(newcomer)).not.toBe(tokenOf(earlier));
    await expect(customerSessionService.authenticate(tokenOf(earlier), qrToken)).resolves.toMatchObject({ nickname: "Gabi" });
  });

  it("does not leak the people of one table to another QR", async () => {
    const otherToken = randomBytes(24).toString("base64url");
    const other = await prisma.diningTable.create({ data: { label: `Rejoin other ${suffix}`, qrToken: otherToken } });
    try {
      const response = await currentSessionRoute(new NextRequest(`http://localhost/api/public/qr/${otherToken}/session`), { params: Promise.resolve({ qrToken: otherToken }) });
      await expect(response.json()).resolves.toEqual({ nickname: null, people: [] });
    } finally {
      await prisma.diningTable.delete({ where: { id: other.id } });
    }
  });
});
