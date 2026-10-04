import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/modules/auth/password";
import { purgeExpiredRecords } from "@/modules/tables/session-cleanup";

const unique = randomUUID();
const email = `purge-${unique}@local.test`;
const bucketKeys = { expired: `purge-test:${unique}:expired`, active: `purge-test:${unique}:active` };
let userId = "";

describe("purgeExpiredRecords", () => {
  beforeAll(async () => {
    const user = await prisma.staffUser.create({ data: { email, displayName: "Purga", passwordHash: await hashPassword("integration password"), role: "OPERATOR" } });
    userId = user.id;
    await prisma.staffSession.createMany({ data: [
      { tokenHash: `${unique}-old`, userId, expiresAt: new Date(Date.now() - 60_000) },
      { tokenHash: `${unique}-live`, userId, expiresAt: new Date(Date.now() + 3_600_000) },
    ] });
    await prisma.rateLimitBucket.createMany({ data: [
      { key: bucketKeys.expired, count: 3, resetsAt: new Date(Date.now() - 60_000) },
      { key: bucketKeys.active, count: 1, resetsAt: new Date(Date.now() + 3_600_000) },
    ] });
  });

  afterAll(async () => {
    await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: `purge-test:${unique}` } } });
    await prisma.staffSession.deleteMany({ where: { userId } });
    await prisma.staffUser.delete({ where: { id: userId } });
  });

  it("removes expired sessions and rate-limit buckets but keeps the active ones", async () => {
    const result = await purgeExpiredRecords();
    expect(result.purged).toBeGreaterThanOrEqual(2);
    expect((await prisma.staffSession.findMany({ where: { userId } })).map((session) => session.tokenHash)).toEqual([`${unique}-live`]);
    expect((await prisma.rateLimitBucket.findMany({ where: { key: { startsWith: `purge-test:${unique}` } } })).map((bucket) => bucket.key)).toEqual([bucketKeys.active]);
  });
});
