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
}
