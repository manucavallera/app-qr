import { hashPassword } from "./password";
import { DomainError } from "../orders/errors";
import type { PrismaClient } from "../../generated/prisma/client";

export class UserAdminService {
  constructor(private readonly db: PrismaClient) {}
  async create(input: { email: string; displayName: string; password: string; role: "ADMIN" | "OPERATOR" }, actorId: string) {
    const user = await this.db.staffUser.create({ data: { email: input.email.trim().toLowerCase(), displayName: input.displayName.trim(), passwordHash: await hashPassword(input.password), role: input.role } });
    await this.db.auditEvent.create({ data: { actorStaffId: actorId, action: "STAFF_USER_CREATED", entityType: "StaffUser", entityId: user.id, metadata: { role: user.role } } });
    return { id: user.id, email: user.email, displayName: user.displayName, role: user.role, active: user.active };
  }
  async deactivate(userId: string, actorId: string) {
    const user = await this.db.staffUser.findUnique({ where: { id: userId } });
    if (!user) throw new DomainError("USER_NOT_FOUND", "No encontramos ese usuario.");
    if (user.role === "ADMIN" && user.active && await this.db.staffUser.count({ where: { role: "ADMIN", active: true } }) <= 1) throw new DomainError("LAST_ADMIN", "No se puede desactivar el último administrador.");
    await this.db.$transaction([this.db.staffUser.update({ where: { id: userId }, data: { active: false } }), this.db.staffSession.deleteMany({ where: { userId } }), this.db.auditEvent.create({ data: { actorStaffId: actorId, action: "STAFF_USER_DEACTIVATED", entityType: "StaffUser", entityId: userId, metadata: {} } })]);
  }

  async update(input: { id: string; email?: string; displayName?: string; password?: string; role?: "ADMIN" | "OPERATOR"; active?: boolean }, actorId: string) {
    const current = await this.db.staffUser.findUnique({ where: { id: input.id } });
    if (!current) throw new DomainError("USER_NOT_FOUND", "No encontramos ese usuario.");

    const becomesInactiveAdmin = current.role === "ADMIN" && current.active && input.active === false;
    const becomesNonAdmin = current.role === "ADMIN" && current.active && input.role === "OPERATOR";
    if ((becomesInactiveAdmin || becomesNonAdmin) && await this.db.staffUser.count({ where: { role: "ADMIN", active: true } }) <= 1) {
      throw new DomainError("LAST_ADMIN", "No se puede quitar el último administrador activo.");
    }

    const data: { email?: string; displayName?: string; passwordHash?: string; role?: "ADMIN" | "OPERATOR"; active?: boolean } = {};
    if (input.email !== undefined) data.email = input.email.trim().toLowerCase();
    if (input.displayName !== undefined) data.displayName = input.displayName.trim();
    if (input.password) data.passwordHash = await hashPassword(input.password);
    if (input.role !== undefined) data.role = input.role;
    if (input.active !== undefined) data.active = input.active;

    const user = await this.db.staffUser.update({ where: { id: input.id }, data });
    // A new password signs that user out everywhere. Admins changing their own keep their session.
    const passwordChangedForOther = Boolean(input.password) && input.id !== actorId;
    if (input.active === false || passwordChangedForOther) await this.db.staffSession.deleteMany({ where: { userId: input.id } });
    await this.db.auditEvent.create({ data: { actorStaffId: actorId, action: input.active === true && !current.active ? "STAFF_USER_ACTIVATED" : "STAFF_USER_UPDATED", entityType: "StaffUser", entityId: user.id, metadata: { role: user.role, active: user.active } } });
    return { id: user.id, email: user.email, displayName: user.displayName, role: user.role, active: user.active };
  }
}
