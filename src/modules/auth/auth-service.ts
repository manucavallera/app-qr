import { DomainError } from "../orders/errors";
import { createSessionToken, hashToken, tokenMatchesHash } from "../../lib/security/token";
import { verifyPassword } from "./password";

export const STAFF_SESSION_COOKIE = "staff_session";
export const STAFF_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export type StaffRole = "ADMIN" | "OPERATOR";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: StaffRole;
  active: boolean;
};

export type AuthSession = {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  user: AuthUser;
};

export type AuthRepository = {
  findUserByEmail(email: string): Promise<AuthUser | null>;
  createSession(session: Omit<AuthSession, "user">): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<AuthSession | null>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
};

export type StaffPrincipal = {
  userId: string;
  displayName: string;
  role: StaffRole;
};

export type LoginResult = {
  token: string;
  expiresAt: Date;
  user: { id: string; displayName: string; role: StaffRole };
};

export type AuthServiceOptions = {
  clock?: () => Date;
  createToken?: () => string;
};

function principalFromUser(user: AuthUser): StaffPrincipal {
  return { userId: user.id, displayName: user.displayName, role: user.role };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function loginRateLimitKey(email: string, ipAddress: string): string {
  return `staff-login:${normalizeEmail(email)}:${hashToken(ipAddress)}`;
}

export class AuthService {
  private readonly clock: () => Date;
  private readonly createToken: () => string;

  constructor(
    private readonly repository: AuthRepository,
    options: AuthServiceOptions = {},
  ) {
    this.clock = options.clock ?? (() => new Date());
    this.createToken = options.createToken ?? createSessionToken;
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.repository.findUserByEmail(normalizedEmail);
    const validPassword = await verifyPassword(user?.passwordHash ?? "", password);

    if (!user || !user.active || !validPassword) {
      throw new DomainError("INVALID_CREDENTIALS", "El correo o la contraseña no son correctos.");
    }

    const token = this.createToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(this.clock().getTime() + STAFF_SESSION_MAX_AGE_SECONDS * 1000);
    await this.repository.createSession({ tokenHash, userId: user.id, expiresAt });

    return {
      token,
      expiresAt,
      user: { id: user.id, displayName: user.displayName, role: user.role },
    };
  }

  async logout(token: string | null | undefined): Promise<void> {
    if (!token || token.length > 1024) return;
    await this.repository.deleteSessionByTokenHash(hashToken(token));
  }

  async authenticate(token: string | null | undefined): Promise<StaffPrincipal | null> {
    if (!token || token.length > 1024) return null;

    const session = await this.repository.findSessionByTokenHash(hashToken(token));
    if (!session || !tokenMatchesHash(token, session.tokenHash)) return null;

    if (session.expiresAt.getTime() <= this.clock().getTime() || !session.user.active) {
      await this.repository.deleteSessionByTokenHash(session.tokenHash);
      return null;
    }

    return principalFromUser(session.user);
  }
}
