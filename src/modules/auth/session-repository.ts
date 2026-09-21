import type { PrismaClient } from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import type { AuthRepository, AuthSession, AuthUser } from "./auth-service";

export type RateLimitDecision = {
  allowed: boolean;
  count: number;
  resetsAt: Date;
};

export class PrismaSessionRepository implements AuthRepository {
  constructor(private readonly db: PrismaClient) {}

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const user = await this.db.staffUser.findUnique({ where: { email } });
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      passwordHash: user.passwordHash,
      role: user.role,
      active: user.active,
    };
  }

  async createSession(session: Omit<AuthSession, "user">): Promise<void> {
    await this.db.staffSession.create({
      data: {
        tokenHash: session.tokenHash,
        userId: session.userId,
        expiresAt: session.expiresAt,
      },
    });
  }

  async findSessionByTokenHash(tokenHash: string): Promise<AuthSession | null> {
    const session = await this.db.staffSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!session) return null;

    return {
      tokenHash: session.tokenHash,
      userId: session.userId,
      expiresAt: session.expiresAt,
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName,
        passwordHash: session.user.passwordHash,
        role: session.user.role,
        active: session.user.active,
      },
    };
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    await this.db.staffSession.deleteMany({ where: { tokenHash } });
  }

  async consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowSeconds) || windowSeconds < 1) {
      throw new RangeError("Rate-limit limit and window must be positive integers.");
    }

    const [bucket] = await this.db.$queryRaw<Array<{ count: number; resetsAt: Date }>>`
      INSERT INTO "RateLimitBucket" ("key", "count", "resetsAt", "updatedAt")
      VALUES (
        ${key},
        1,
        CURRENT_TIMESTAMP + (${windowSeconds} * INTERVAL '1 second'),
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitBucket"."resetsAt" <= CURRENT_TIMESTAMP THEN 1
          ELSE "RateLimitBucket"."count" + 1
        END,
        "resetsAt" = CASE
          WHEN "RateLimitBucket"."resetsAt" <= CURRENT_TIMESTAMP
            THEN CURRENT_TIMESTAMP + (${windowSeconds} * INTERVAL '1 second')
          ELSE "RateLimitBucket"."resetsAt"
        END,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "count", "resetsAt"
    `;

    return { allowed: bucket.count <= limit, count: bucket.count, resetsAt: bucket.resetsAt };
  }

  async clearRateLimit(key: string): Promise<void> {
    await this.db.rateLimitBucket.deleteMany({ where: { key } });
  }
}

export const sessionRepository = new PrismaSessionRepository(prisma);
