import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as createSessionRoute, GET as currentSessionRoute } from "@/app/api/public/qr/[qrToken]/session/route";
import { GET as publicMenuRoute } from "@/app/api/public/menu/[qrToken]/route";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/security/token";
import { customerSessionService } from "@/modules/tables/customer-session-service";

const suffix = randomUUID();
const qrToken = randomBytes(24).toString("base64url");
const ip = `198.51.100.${Math.floor(Math.random() * 255) + 1}`;
let tableId = "";
let categoryIds: string[] = [];
let productIds: string[] = [];

function request(url: string, options: ConstructorParameters<typeof NextRequest>[1] = {}) {
  return new NextRequest(url, options);
}

async function startSession(nickname: string, clientIp = ip) {
  const response = await createSessionRoute(
    request(`http://localhost/api/public/qr/${qrToken}/session`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": clientIp },
      body: JSON.stringify({ nickname }),
    }),
    { params: Promise.resolve({ qrToken }) },
  );
  return response;
}

describe("public QR customer sessions", () => {
  beforeAll(async () => {
    const table = await prisma.diningTable.create({ data: { label: `Test ${suffix}`, qrToken } });
    tableId = table.id;
    const visible = await prisma.category.create({ data: { name: `Visible ${suffix}`, sortOrder: 0 } });
    const hidden = await prisma.category.create({ data: { name: `Hidden ${suffix}`, visible: false, sortOrder: 1 } });
    categoryIds = [visible.id, hidden.id];
    const soldOut = await prisma.product.create({
      data: {
        categoryId: visible.id,
        name: `Agotado ${suffix}`,
        description: "Producto visible sin stock",
        priceCents: 2000,
        available: false,
        optionGroups: {
          create: {
            name: "Tamaño",
            required: false,
            minSelections: 0,
            maxSelections: 1,
            values: {
              create: [
                { name: "Disponible", available: true },
                { name: "No disponible", available: false },
              ],
            },
          },
        },
      },
    });
    const hiddenProduct = await prisma.product.create({
      data: { categoryId: hidden.id, name: `Privado ${suffix}`, description: "", priceCents: 100, visible: false },
    });
    productIds = [soldOut.id, hiddenProduct.id];
  });

  afterAll(async () => {
    await prisma.customerSession.deleteMany({ where: { tableId } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
    await prisma.diningTable.deleteMany({ where: { id: tableId } });
    await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: "customer-session:" } } });
  });

  it("keeps two people on one table private, stores only token hashes and expires after four hours", async () => {
    const firstResponse = await startSession("  Ana  ");
    const secondResponse = await startSession("Luis", `${ip}-other`);
    const firstToken = firstResponse.cookies.get("customer_session")?.value;
    const secondToken = secondResponse.cookies.get("customer_session")?.value;

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(firstToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(secondToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(firstToken).not.toBe(secondToken);
    expect(firstResponse.cookies.get("customer_session")?.httpOnly).toBe(true);
    expect(firstResponse.cookies.get("customer_session")?.path).toBe("/");

    const first = await prisma.customerSession.findUnique({ where: { tokenHash: hashToken(firstToken!) } });
    const second = await prisma.customerSession.findUnique({ where: { tokenHash: hashToken(secondToken!) } });
    expect(first?.nickname).toBe("Ana");
    expect(second?.nickname).toBe("Luis");
    expect(first?.tokenHash).not.toBe(firstToken);
    expect(first?.expiresAt.getTime()).toBeGreaterThan(Date.now() + 3 * 60 * 60 * 1000);
    expect(first?.expiresAt.getTime()).toBeLessThan(Date.now() + 4 * 60 * 60 * 1000 + 5000);

    await customerSessionService.close(firstToken!);
    await expect(customerSessionService.authenticate(firstToken!)).resolves.toBeNull();
    await expect(customerSessionService.authenticate(secondToken!)).resolves.toMatchObject({ nickname: "Luis" });

    const current = await currentSessionRoute(
      request(`http://localhost/api/public/qr/${qrToken}/session`, { headers: { cookie: `customer_session=${secondToken}` } }),
      { params: Promise.resolve({ qrToken }) },
    );
    expect(await current.json()).toEqual({ nickname: "Luis" });

    await prisma.customerSession.update({
      where: { id: second!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(customerSessionService.authenticate(secondToken!)).resolves.toBeNull();
  });

  it("returns a public menu without personal data and filters hidden records and unavailable option values", async () => {
    const response = await publicMenuRoute(
      request(`http://localhost/api/public/menu/${qrToken}`),
      { params: Promise.resolve({ qrToken }) },
    );
    const body = await response.json();
    const visibleCategory = body.categories.find((category: { id: string }) => category.id === categoryIds[0]);
    const product = visibleCategory.products.find((item: { id: string }) => item.id === productIds[0]);

    expect(response.status).toBe(200);
    expect(body.table).toEqual({ label: `Test ${suffix}` });
    expect(body).toHaveProperty("mode");
    expect(body).toHaveProperty("serverTime");
    expect(JSON.stringify(body)).not.toContain("Ana");
    expect(JSON.stringify(body)).not.toContain("Luis");
    expect(JSON.stringify(body)).not.toContain("Privado");
    expect(product.available).toBe(false);
    expect(product.optionGroups[0].values.map((value: { name: string }) => value.name)).toEqual(["Disponible"]);
  });

  it("rejects bad nicknames and unknown QR codes without creating a session", async () => {
    const badName = await createSessionRoute(
      request(`http://localhost/api/public/qr/${qrToken}/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname: "   " }),
      }),
      { params: Promise.resolve({ qrToken }) },
    );
    const unknown = await createSessionRoute(
      request("http://localhost/api/public/qr/unknown/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname: "Ana" }),
      }),
      { params: Promise.resolve({ qrToken: "unknown" }) },
    );

    expect(badName.status).toBe(400);
    expect(unknown.status).toBe(404);
  });

  it("limits new sessions to ten per QR and client IP each hour", async () => {
    const rateIp = `${ip}-limit`;
    const responses = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      responses.push(await startSession(`Visita ${attempt}`, rateIp));
    }
    expect(responses.slice(0, 10).map((response) => response.status)).toEqual(Array(10).fill(201));
    expect(responses[10]?.status).toBe(429);
  });
});
