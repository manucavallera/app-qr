import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as getSettings, PATCH as patchSettings } from "@/app/api/staff/settings/route";
import { GET as getSummary } from "@/app/api/staff/summary/route";
import { AuthService } from "@/modules/auth/auth-service";
import { sessionRepository } from "@/modules/auth/session-repository";
import { hashPassword } from "@/modules/auth/password";
import { prisma } from "@/lib/db";

const suffix = randomUUID();
const adminEmail = `settings-admin-${suffix}@local.test`;
const operatorEmail = `settings-operator-${suffix}@local.test`;
let adminToken = "";
let operatorToken = "";
let previousSettings: Awaited<ReturnType<typeof prisma.businessSettings.findUnique>> = null;
let previousPayments: Awaited<ReturnType<typeof prisma.paymentSettings.findUnique>> = null;
let previousWindows: Awaited<ReturnType<typeof prisma.serviceWindow.findMany>> = [];

function request(token: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/staff/settings", {
    method: body ? "PATCH" : "GET",
    headers: { ...(body ? { "content-type": "application/json" } : {}), cookie: `staff_session=${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const adminPatch = {
  timezone: "America/Argentina/Buenos_Aires",
  manualMode: "FORCE_QR_OPEN",
  windows: [{ weekday: 1, opensAtMinute: 600, closesAtMinute: 1439, enabled: true }],
  paymentSettings: {
    mercadoPagoEnabled: true,
    cashEnabled: true,
    cardAtCounterEnabled: true,
    bankTransferEnabled: true,
    bankAlias: "bar.prueba",
    bankCbuCvu: null,
    bankAccountHolder: "Bar de prueba",
    bankInstructions: "Enviar el importe exacto.",
  },
};

describe("staff settings integration", () => {
  beforeAll(async () => {
    previousSettings = await prisma.businessSettings.findUnique({ where: { id: "default" } });
    previousPayments = await prisma.paymentSettings.findUnique({ where: { id: "default" } });
    previousWindows = await prisma.serviceWindow.findMany({ orderBy: { weekday: "asc" } });
    const [admin, operator] = await Promise.all([
      prisma.staffUser.create({ data: { email: adminEmail, displayName: "Admin settings", passwordHash: await hashPassword("integration password"), role: "ADMIN" } }),
      prisma.staffUser.create({ data: { email: operatorEmail, displayName: "Operator settings", passwordHash: await hashPassword("integration password"), role: "OPERATOR" } }),
    ]);
    const auth = new AuthService(sessionRepository);
    adminToken = (await auth.login(admin.email, "integration password")).token;
    operatorToken = (await auth.login(operator.email, "integration password")).token;
  });

  afterAll(async () => {
    await prisma.staffUser.deleteMany({ where: { email: { in: [adminEmail, operatorEmail] } } });
    await prisma.serviceWindow.deleteMany();
    if (previousWindows.length) await prisma.serviceWindow.createMany({ data: previousWindows.map(({ id: _id, ...window }) => window) });
    if (previousSettings) {
      await prisma.businessSettings.update({ where: { id: "default" }, data: { name: previousSettings.name, timezone: previousSettings.timezone, manualMode: previousSettings.manualMode } });
    }
    if (previousPayments) {
      await prisma.paymentSettings.upsert({ where: { id: "default" }, create: { ...previousPayments, id: "default" }, update: { mercadoPagoEnabled: previousPayments.mercadoPagoEnabled, cashEnabled: previousPayments.cashEnabled, cardAtCounterEnabled: previousPayments.cardAtCounterEnabled, bankTransferEnabled: previousPayments.bankTransferEnabled, bankAlias: previousPayments.bankAlias, bankCbuCvu: previousPayments.bankCbuCvu, bankAccountHolder: previousPayments.bankAccountHolder, bankInstructions: previousPayments.bankInstructions } });
    } else {
      await prisma.paymentSettings.deleteMany({ where: { id: "default" } });
    }
  });

  it("lets an admin save payment settings and returns them without secrets", async () => {
    const response = await patchSettings(request(adminToken, adminPatch));
    expect(response.status).toBe(200);
    const read = await getSettings(request(adminToken));
    expect(read.status).toBe(200);
    await expect(read.json()).resolves.toMatchObject({
      settings: { manualMode: "FORCE_QR_OPEN" },
      paymentSettings: { bankTransferEnabled: true, bankAlias: "bar.prueba" },
      mercadoPagoConfigured: expect.any(Boolean),
    });

    const summary = await getSummary(new NextRequest("http://localhost/api/staff/summary", { headers: { cookie: `staff_session=${adminToken}` } }));
    expect(summary.status).toBe(200);
    await expect(summary.json()).resolves.toEqual(expect.objectContaining({
      pendingPayments: expect.any(Number),
      activeCommands: expect.any(Number),
      qrMode: "QR_OPEN",
    }));
  });

  it("prevents an operator from changing payment settings but allows a pause", async () => {
    const forbidden = await patchSettings(request(operatorToken, adminPatch));
    expect(forbidden.status).toBe(403);

    const paused = await patchSettings(request(operatorToken, {
      timezone: "America/Argentina/Buenos_Aires",
      manualMode: "FORCE_PAUSED",
      windows: [],
    }));
    expect(paused.status).toBe(200);
  });
});
