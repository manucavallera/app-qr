import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as loginRoute } from "@/app/api/staff/auth/login/route";
import { POST as logoutRoute } from "@/app/api/staff/auth/logout/route";
import { AuthService, type StaffRole } from "@/modules/auth/auth-service";
import { requireStaff } from "@/modules/auth/require-staff";
import { PrismaSessionRepository, sessionRepository } from "@/modules/auth/session-repository";
import { hashPassword } from "@/modules/auth/password";
import { hashToken } from "@/lib/security/token";
import { prisma } from "@/lib/db";

const unique = randomUUID();
const adminEmail = `admin-${unique}@local.test`;
const operatorEmail = `operator-${unique}@local.test`;
const rateLimitedEmail = `limited-${unique}@local.test`;
const clientIp = `198.51.100.${Math.floor(Math.random() * 255) + 1}`;

async function makeStaff(email: string, role: StaffRole) {
  return prisma.staffUser.create({
    data: {
      email,
      displayName: role === "ADMIN" ? "Admin de prueba" : "Operador de prueba",
      passwordHash: await hashPassword("integration password"),
      role,
    },
  });
}

describe("staff authentication integration", () => {
  beforeAll(async () => {
    await makeStaff(adminEmail, "ADMIN");
    await makeStaff(operatorEmail, "OPERATOR");
  });

  afterAll(async () => {
    await prisma.staffUser.deleteMany({ where: { email: { in: [adminEmail, operatorEmail] } } });
    await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: `staff-login:${adminEmail}:` } } });
    await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: `staff-login:${rateLimitedEmail}:` } } });
  });

  it("sets an HttpOnly cookie and returns only the public staff identity", async () => {
    const response = await loginRoute(
      new NextRequest("http://localhost/api/staff/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": clientIp,
        },
        body: JSON.stringify({ email: adminEmail.toUpperCase(), password: "integration password" }),
      }),
    );
    const body = await response.json();
    const cookie = response.cookies.get("staff_session");

    expect(response.status).toBe(200);
    expect(body).toEqual({ id: expect.any(String), displayName: "Admin de prueba", role: "ADMIN" });
    expect(Object.keys(body).sort()).toEqual(["displayName", "id", "role"]);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const stored = await prisma.staffSession.findUnique({ where: { tokenHash: hashToken(cookie!.value) } });
    expect(stored?.tokenHash).not.toBe(cookie?.value);
    expect(stored?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("returns 401 without a session and 403 when the role is not allowed", async () => {
    const repository = new PrismaSessionRepository(prisma);
    const authService = new AuthService(repository);
    const unauthenticated = await requireStaff(
      new NextRequest("http://localhost/api/staff/protected"),
      ["ADMIN"],
      authService,
    );
    expect(unauthenticated).toHaveProperty("status", 401);

    const session = await authService.login(operatorEmail, "integration password");
    const request = new NextRequest("http://localhost/api/staff/protected", {
      headers: { cookie: `staff_session=${session.token}` },
    });
    const forbidden = await requireStaff(request, ["ADMIN"], authService);
    expect(forbidden).toHaveProperty("status", 403);

    const allowed = await requireStaff(request, ["OPERATOR"], authService);
    expect(allowed).toEqual({ userId: expect.any(String), displayName: "Operador de prueba", role: "OPERATOR" });
  });

  it("revokes the session and expires the cookie on logout", async () => {
    const authService = new AuthService(sessionRepository);
    const session = await authService.login(adminEmail, "integration password");
    const response = await logoutRoute(
      new NextRequest("http://localhost/api/staff/auth/logout", {
        method: "POST",
        headers: { cookie: `staff_session=${session.token}` },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.cookies.get("staff_session")?.maxAge).toBe(0);
    await expect(authService.authenticate(session.token)).resolves.toBeNull();
  });

  it("allows five login attempts per email and IP, then returns 429", async () => {
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        loginRoute(
          new NextRequest("http://localhost/api/staff/auth/login", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-forwarded-for": clientIp,
            },
            body: JSON.stringify({ email: rateLimitedEmail, password: "wrong" }),
          }),
        ),
      ),
    );

    expect(responses.filter((response) => response.status === 401)).toHaveLength(5);
    const limited = responses.find((response) => response.status === 429);
    expect(limited?.headers.get("Retry-After")).toMatch(/^\d+$/);
  });

  it("limits each normalized-email and hashed-IP bucket and clears it after success", async () => {
    const key = `integration-rate-limit:${unique}`;
    const first = await sessionRepository.consumeRateLimit(key, 2, 60);
    const second = await sessionRepository.consumeRateLimit(key, 2, 60);
    const third = await sessionRepository.consumeRateLimit(key, 2, 60);

    expect([first.allowed, second.allowed, third.allowed]).toEqual([true, true, false]);
    await sessionRepository.clearRateLimit(key);
    await expect(sessionRepository.consumeRateLimit(key, 2, 60)).resolves.toMatchObject({
      allowed: true,
      count: 1,
    });
    await sessionRepository.clearRateLimit(key);
  });
});
