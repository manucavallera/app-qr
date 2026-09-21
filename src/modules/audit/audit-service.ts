import type { PrismaClient } from "../../generated/prisma/client";
export class AuditService {
  constructor(private readonly db: PrismaClient) {}
  search(query: { action?: string; actorStaffId?: string; entityType?: string; entityId?: string; take?: number }) { return this.db.auditEvent.findMany({ where: { ...(query.action ? { action: query.action } : {}), ...(query.actorStaffId ? { actorStaffId: query.actorStaffId } : {}), ...(query.entityType ? { entityType: query.entityType } : {}), ...(query.entityId ? { entityId: query.entityId } : {}) }, orderBy: { createdAt: "desc" }, take: Math.min(Math.max(query.take ?? 50, 1), 100) }); }
}
