import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as listUsers, PATCH as updateUser } from "@/app/api/staff/users/route";
import { hashToken } from "@/lib/security/token";
import { prisma } from "@/lib/db";
import { STAFF_SESSION_COOKIE, type StaffRole } from "@/modules/auth/auth-service";
import { hashPassword } from "@/modules/auth/password";

const unique = randomUUID();
const tokens: Record<StaffRole, string> = { ADMIN: `admin-token-${unique}`, OPERATOR: `operator-token-${unique}` };
const ids: string[] = [];

async function makeSession(role: StaffRole) {
  const user = await prisma.staffUser.create({ data: { email: `authz-${role.toLowerCase()}-${unique}@local.test`, displayName: role, passwordHash: await hashPassword("integration password"), role } });
  ids.push(user.id);
  await prisma.staffSession.create({ data: { tokenHash: hashToken(tokens[role]), userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) } });
  return user.id;
}

const request = (role: StaffRole | null, init?: { method?: string; body?: unknown }) => new NextRequest("http://localhost/api/staff/users", {
  method: init?.method ?? "GET",
  headers: { "content-type": "application/json", ...(role ? { cookie: `${STAFF_SESSION_COOKIE}=${tokens[role]}` } : {}) },
  ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
});

describe("user administration authorization", () => {
  let operatorId = "";

  beforeAll(async () => {
    await makeSession("ADMIN");
    operatorId = await makeSession("OPERATOR");
  });

  afterAll(async () => {
    await prisma.staffSession.deleteMany({ where: { userId: { in: ids } } });
    await prisma.auditEvent.deleteMany({ where: { actorStaffId: { in: ids } } });
    await prisma.staffUser.deleteMany({ where: { id: { in: ids } } });
  });

  it("rejects requests without a session", async () => {
    expect((await listUsers(request(null))).status).toBe(401);
  });

  it("forbids operators from listing or changing users", async () => {
    expect((await listUsers(request("OPERATOR"))).status).toBe(403);
    expect((await updateUser(request("OPERATOR", { method: "PATCH", body: { id: operatorId, role: "ADMIN" } }))).status).toBe(403);
    expect((await prisma.staffUser.findUniqueOrThrow({ where: { id: operatorId } })).role).toBe("OPERATOR");
  });

  it("lets administrators list users", async () => {
    const response = await listUsers(request("ADMIN"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.arrayContaining([expect.objectContaining({ id: operatorId })]));
  });
});
