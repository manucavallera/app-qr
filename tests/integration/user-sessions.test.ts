import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/modules/auth/password";
import { UserAdminService } from "@/modules/auth/user-admin-service";

const unique = randomUUID();
const emails = [`sessions-admin-${unique}@local.test`, `sessions-other-${unique}@local.test`];
let adminId = "";
let otherId = "";

async function openSessions(userId: string, count: number) {
  const hashes = Array.from({ length: count }, () => randomUUID());
  await prisma.staffSession.createMany({ data: hashes.map((tokenHash) => ({ tokenHash, userId, expiresAt: new Date(Date.now() + 3_600_000) })) });
  return hashes;
}

const remaining = async (userId: string) => (await prisma.staffSession.findMany({ where: { userId }, select: { tokenHash: true } })).map((session) => session.tokenHash);

describe("staff sessions after a password change", () => {
  beforeAll(async () => {
    const [admin, other] = await Promise.all(emails.map(async (email, index) => prisma.staffUser.create({ data: { email, displayName: `Prueba ${index}`, passwordHash: await hashPassword("integration password"), role: index === 0 ? "ADMIN" : "OPERATOR" } })));
    adminId = admin.id;
    otherId = other.id;
  });

  afterAll(async () => {
    await prisma.staffSession.deleteMany({ where: { userId: { in: [adminId, otherId] } } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: [adminId, otherId] } } });
    await prisma.staffUser.deleteMany({ where: { id: { in: [adminId, otherId] } } });
  });

  it("signs another user out of every session", async () => {
    await openSessions(otherId, 3);
    await new UserAdminService(prisma).update({ id: otherId, password: "a brand new password" }, adminId);
    expect(await remaining(otherId)).toEqual([]);
  });

  it("keeps only the current session when changing your own password", async () => {
    const [current] = await openSessions(adminId, 3);
    await new UserAdminService(prisma).update({ id: adminId, password: "another new password" }, adminId, current);
    expect(await remaining(adminId)).toEqual([current]);
  });

  it("does not touch sessions when the password is not changed", async () => {
    const [kept] = await openSessions(otherId, 2);
    await new UserAdminService(prisma).update({ id: otherId, displayName: "Nuevo nombre" }, adminId);
    expect((await remaining(otherId)).length).toBeGreaterThanOrEqual(2);
    expect(await remaining(otherId)).toContain(kept);
  });
});
