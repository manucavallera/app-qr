import { randomBytes } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { DomainError } from "../orders/errors";
import { tableInputSchema } from "../catalog/catalog-schemas";

export type DiningTableRecord = {
  id: string;
  label: string;
  qrToken: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class PrismaTableRepository {
  constructor(private readonly db: PrismaClient) {}

  list(): Promise<DiningTableRecord[]> {
    return this.db.diningTable.findMany({ orderBy: { label: "asc" } });
  }

  findById(id: string): Promise<DiningTableRecord | null> {
    return this.db.diningTable.findUnique({ where: { id } });
  }

  async create(input: { label: string }, actorStaffId: string): Promise<DiningTableRecord> {
    const qrToken = randomBytes(24).toString("base64url");
    return this.db.$transaction(async (tx) => {
      const table = await tx.diningTable.create({ data: { label: input.label, qrToken } });
      await tx.auditEvent.create({
        data: {
          actorStaffId,
          action: "TABLE_CREATED",
          entityType: "DiningTable",
          entityId: table.id,
          metadata: { label: table.label },
        },
      });
      return table;
    });
  }

  async regenerateQr(id: string, actorStaffId: string): Promise<DiningTableRecord> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.diningTable.findUnique({ where: { id }, select: { id: true, label: true } });
      if (!existing) throw new DomainError("TABLE_NOT_FOUND", "No encontramos esa mesa.");

      const table = await tx.diningTable.update({
        where: { id },
        data: { qrToken: randomBytes(24).toString("base64url") },
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId,
          action: "TABLE_QR_REGENERATED",
          entityType: "DiningTable",
          entityId: table.id,
          metadata: { label: table.label },
        },
      });
      return table;
    });
  }
}

export class TableService {
  constructor(private readonly repository: PrismaTableRepository) {}

  list() {
    return this.repository.list();
  }

  findById(id: string) {
    return this.repository.findById(id);
  }

  create(input: unknown, actorStaffId: string) {
    return this.repository.create(tableInputSchema.parse(input), actorStaffId);
  }

  regenerateQr(id: string, actorStaffId: string) {
    return this.repository.regenerateQr(id, actorStaffId);
  }
}

export const tableService = new TableService(new PrismaTableRepository(prisma));
