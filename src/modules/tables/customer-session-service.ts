import type { PrismaClient } from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { hashToken, createSessionToken } from "../../lib/security/token";
import { DomainError } from "../orders/errors";
import { sessionRepository } from "../auth/session-repository";

export const CUSTOMER_SESSION_COOKIE = "customer_session";
export const CUSTOMER_SESSION_TTL_SECONDS = 4 * 60 * 60;

export type CustomerPrincipal = Readonly<{
  id: string;
  tableId: string;
  nickname: string;
  expiresAt: Date;
}>;

export type CreatedCustomerSession = Readonly<{
  token: string;
  principal: CustomerPrincipal;
}>;

function normalizedNickname(value: unknown): string {
  if (typeof value !== "string") throw new DomainError("INVALID_NICKNAME", "Ingresá un nombre de hasta 40 caracteres.");
  const nickname = value.trim().replace(/\s+/g, " ");
  if (nickname.length < 1 || nickname.length > 40) {
    throw new DomainError("INVALID_NICKNAME", "Ingresá un nombre de hasta 40 caracteres.");
  }
  return nickname;
}

/** Same person for the purposes of a table: "beto" and "Beto" are one name. */
function sameNickname(a: string, b: string): boolean {
  return a.toLocaleLowerCase("es-AR") === b.toLocaleLowerCase("es-AR");
}

export class CustomerSessionService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * People at the table who still owe something on its open tab. A customer who lost the
   * session (closed tab, another phone) can continue as one of them. Whoever already paid
   * or belongs to an earlier party is never offered.
   */
  private rejoinable(tableId: string) {
    return this.db.customerSession.findMany({
      where: {
        tableId,
        orders: { some: { status: { not: "CANCELLED" }, tab: { closedAt: null }, payments: { some: { method: "ON_TAB", status: "UNPAID" } } } },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, nickname: true },
    });
  }

  async listRejoinable(qrToken: string): Promise<string[]> {
    const table = await this.db.diningTable.findFirst({ where: { qrToken, active: true }, select: { id: true } });
    if (!table) return [];
    return [...new Set((await this.rejoinable(table.id)).map((session) => session.nickname))];
  }

  /**
   * Starts a session. If the name belongs to someone who still owes on the table's tab, the
   * caller has to say so: `rejoin` continues as that person (their other device is signed
   * out, because a session has one token), anything else is refused so two people never
   * share a name on one bill.
   */
  async create(qrToken: string, nicknameInput: unknown, clientIp: string, now = new Date(), rejoin = false): Promise<CreatedCustomerSession> {
    const nickname = normalizedNickname(nicknameInput);
    const table = await this.db.diningTable.findFirst({ where: { qrToken, active: true } });
    if (!table) throw new DomainError("TABLE_NOT_FOUND", "No encontramos una mesa activa para este QR.");

    const rateLimitKey = `customer-session:${hashToken(`${qrToken}:${clientIp || "unknown"}`)}`;
    const rateLimit = await sessionRepository.consumeRateLimit(rateLimitKey, 10, 60 * 60);
    if (!rateLimit.allowed) throw new DomainError("RATE_LIMITED", "Esperá un momento antes de volver a intentarlo.");

    const token = createSessionToken();
    const expiresAt = new Date(now.getTime() + CUSTOMER_SESSION_TTL_SECONDS * 1000);
    const existing = (await this.rejoinable(table.id)).find((session) => sameNickname(session.nickname, nickname));
    if (existing) {
      if (!rejoin) throw new DomainError("NICKNAME_IN_USE", "Ya hay alguien con ese nombre en la mesa.");
      const session = await this.db.customerSession.update({
        where: { id: existing.id },
        data: { tokenHash: hashToken(token), expiresAt, closedAt: null },
        select: { id: true, tableId: true, nickname: true, expiresAt: true },
      });
      return { token, principal: session };
    }
    const session = await this.db.customerSession.create({
      data: { tableId: table.id, nickname, tokenHash: hashToken(token), expiresAt },
      select: { id: true, tableId: true, nickname: true, expiresAt: true },
    });
    return { token, principal: session };
  }

  async authenticate(token: string | undefined, qrToken?: string, now = new Date()): Promise<CustomerPrincipal | null> {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const session = await this.db.customerSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { table: true },
    });
    if (
      !session || session.closedAt || session.expiresAt <= now || !session.table.active ||
      (qrToken !== undefined && session.table.qrToken !== qrToken)
    ) {
      return null;
    }
    return { id: session.id, tableId: session.tableId, nickname: session.nickname, expiresAt: session.expiresAt };
  }

  async close(token: string): Promise<void> {
    await this.db.customerSession.updateMany({
      where: { tokenHash: hashToken(token), closedAt: null },
      data: { closedAt: new Date() },
    });
  }
}

export const customerSessionService = new CustomerSessionService(prisma);
