import { beforeEach, describe, expect, it } from "vitest";
import {
  AuthService,
  loginRateLimitKey,
  type AuthRepository,
  type AuthSession,
  type AuthUser,
} from "./auth-service";
import { hashPassword } from "./password";

const rawToken = "AbCdEf0123456789AbCdEf0123456789AbCdEf01234";

class MemoryAuthRepository implements AuthRepository {
  sessions = new Map<string, AuthSession>();

  constructor(readonly user: AuthUser) {}

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    return email === this.user.email ? this.user : null;
  }

  async createSession(session: Omit<AuthSession, "user">): Promise<void> {
    this.sessions.set(session.tokenHash, { ...session, user: this.user });
  }

  async findSessionByTokenHash(tokenHash: string): Promise<AuthSession | null> {
    return this.sessions.get(tokenHash) ?? null;
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }
}

describe("AuthService", () => {
  let repository: MemoryAuthRepository;
  let service: AuthService;
  let now: Date;

  beforeEach(async () => {
    now = new Date("2026-09-21T12:00:00.000Z");
    repository = new MemoryAuthRepository({
      id: "staff-1",
      email: "admin@local.test",
      displayName: "Administración",
      passwordHash: await hashPassword("correct password"),
      role: "ADMIN",
      active: true,
    });
    service = new AuthService(repository, {
      clock: () => now,
      createToken: () => rawToken,
    });
  });

  it("creates a 12-hour session for a correct password", async () => {
    const result = await service.login(" ADMIN@LOCAL.TEST ", "correct password");

    expect(result.user).toEqual({ id: "staff-1", displayName: "Administración", role: "ADMIN" });
    expect(result.expiresAt).toEqual(new Date("2026-09-22T00:00:00.000Z"));
    expect(await service.authenticate(result.token)).toEqual({
      userId: "staff-1",
      displayName: "Administración",
      role: "ADMIN",
    });
  });

  it("returns INVALID_CREDENTIALS for a wrong password", async () => {
    await expect(service.login("admin@local.test", "wrong password")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("rejects inactive users with the same credential error", async () => {
    repository.user.active = false;

    await expect(service.login("admin@local.test", "correct password")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("stores only a SHA-256 hash of the cookie token", async () => {
    const result = await service.login("admin@local.test", "correct password");
    const [storedSession] = repository.sessions.values();

    expect(storedSession?.tokenHash).not.toBe(result.token);
    expect(storedSession?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a session after its expiry", async () => {
    const result = await service.login("admin@local.test", "correct password");
    now = new Date(result.expiresAt.getTime() + 1);

    await expect(service.authenticate(result.token)).resolves.toBeNull();
  });
});

describe("loginRateLimitKey", () => {
  it("normalizes email and stores only a hash of the IP address", () => {
    const key = loginRateLimitKey(" ADMIN@LOCAL.TEST ", "203.0.113.8");

    expect(key).toMatch(/^staff-login:admin@local\.test:[a-f0-9]{64}$/);
    expect(key).not.toContain("203.0.113.8");
  });
});
