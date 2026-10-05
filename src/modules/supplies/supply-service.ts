import { z } from "zod";
import { prisma } from "../../lib/db";
import { DomainError } from "../orders/errors";

/** Quantities are whole numbers in the base unit (units, grams or milliliters). */
const quantity = z.number().int().min(0).max(100_000_000);
const positiveQuantity = quantity.min(1);
const name = z.string().trim().min(1).max(80);
const note = z.string().trim().max(200).optional();

export const supplyInputSchema = z.object({
  name,
  unit: z.enum(["UNIT", "GRAM", "MILLILITER"]),
  quantity: quantity.default(0),
  minQuantity: quantity.default(0),
});
export const supplyUpdateSchema = z.object({ name: name.optional(), minQuantity: quantity.optional(), active: z.boolean().optional() }).refine((value) => Object.keys(value).length > 0);
export const supplyMovementSchema = z.discriminatedUnion("reason", [
  z.object({ reason: z.literal("PURCHASE"), quantity: positiveQuantity, note }),
  z.object({ reason: z.literal("WASTE"), quantity: positiveQuantity, note }),
  z.object({ reason: z.literal("ADJUSTMENT"), newQuantity: quantity, note }),
]);

export type SupplyView = { id: string; name: string; unit: "UNIT" | "GRAM" | "MILLILITER"; quantity: number; minQuantity: number; active: boolean; low: boolean };

const toView = (supply: Omit<SupplyView, "low">): SupplyView => ({ ...supply, low: supply.active && supply.quantity <= supply.minQuantity });
const select = { id: true, name: true, unit: true, quantity: true, minQuantity: true, active: true } as const;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function listSupplies(): Promise<SupplyView[]> {
  const supplies = await prisma.supply.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], select });
  return supplies.map(toView);
}

/** Active supplies at or below their minimum, most urgent first. */
export async function listLowSupplies(): Promise<SupplyView[]> {
  return (await listSupplies()).filter((supply) => supply.low).sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name));
}

export async function createSupply(input: unknown, actorStaffId: string): Promise<SupplyView> {
  const data = supplyInputSchema.parse(input);
  try {
    return await prisma.$transaction(async (tx) => {
      const supply = await tx.supply.create({ data, select });
      if (data.quantity > 0) await tx.supplyMovement.create({ data: { supplyId: supply.id, delta: data.quantity, reason: "ADJUSTMENT", note: "Stock inicial", actorStaffId } });
      await tx.auditEvent.create({ data: { actorStaffId, action: "SUPPLY_CREATED", entityType: "Supply", entityId: supply.id, metadata: { name: supply.name, unit: supply.unit, quantity: data.quantity } } });
      return toView(supply);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError("SUPPLY_NAME_TAKEN", "Ya existe un insumo con ese nombre.");
    throw error;
  }
}

export async function updateSupply(id: string, input: unknown, actorStaffId: string): Promise<SupplyView> {
  const data = supplyUpdateSchema.parse(input);
  try {
    return await prisma.$transaction(async (tx) => {
      const exists = await tx.supply.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new DomainError("SUPPLY_NOT_FOUND", "No encontramos ese insumo.");
      const supply = await tx.supply.update({ where: { id }, data, select });
      await tx.auditEvent.create({ data: { actorStaffId, action: "SUPPLY_UPDATED", entityType: "Supply", entityId: id, metadata: data } });
      return toView(supply);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError("SUPPLY_NAME_TAKEN", "Ya existe un insumo con ese nombre.");
    throw error;
  }
}

/** Records a purchase, waste or manual count and moves the stock in the same transaction. */
export async function registerSupplyMovement(id: string, input: unknown, actorStaffId: string): Promise<SupplyView> {
  const movement = supplyMovementSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const current = await tx.supply.findUnique({ where: { id }, select: { quantity: true } });
    if (!current) throw new DomainError("SUPPLY_NOT_FOUND", "No encontramos ese insumo.");

    const delta = movement.reason === "PURCHASE" ? movement.quantity : movement.reason === "WASTE" ? -movement.quantity : movement.newQuantity - current.quantity;
    // The quantity is part of the filter so a concurrent change makes this fail instead of overwriting it.
    const updated = await tx.supply.updateMany({ where: { id, quantity: movement.reason === "ADJUSTMENT" ? current.quantity : { gte: -delta } }, data: { quantity: { increment: delta } } });
    if (updated.count === 0) {
      throw movement.reason === "ADJUSTMENT"
        ? new DomainError("SUPPLY_CONFLICT", "El stock cambió mientras lo editabas. Probá de nuevo.")
        : new DomainError("INSUFFICIENT_SUPPLY", "No hay tanto stock de ese insumo.");
    }
    if (delta !== 0) await tx.supplyMovement.create({ data: { supplyId: id, delta, reason: movement.reason, note: movement.note || null, actorStaffId } });
    await tx.auditEvent.create({ data: { actorStaffId, action: "SUPPLY_STOCK_CHANGED", entityType: "Supply", entityId: id, metadata: { reason: movement.reason, delta } } });
    return toView(await tx.supply.findUniqueOrThrow({ where: { id }, select }));
  });
}
